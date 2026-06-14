import { ExerciseKind, finishSession, formatTime } from "./domain.js";
import { ExerciseRepository } from "./repository.js";

const repository = new ExerciseRepository();
const params = new URLSearchParams(location.search);
const sessionId = params.get("id");
const kind = params.get("kind") || ExerciseKind.RUN;
const AMAP_KEY = "10cc57c5c4abecb4c526db3198de18f1";

const state = {
  session: null,
  seconds: 0,
  timer: null,
  watchId: null,
  rangeData: null,
  fencePoints: [],
  gpsPoints: [],
  displayGpsPoints: [],
  distance: 0,
  validSeconds: 0,
  lastPoint: null,
  lastAcceptedAt: 0,
  persistTimer: null,
  mapZoom: 18
};

const $ = selector => document.querySelector(selector);

init();

async function init() {
  state.session = findSession();
  if (!state.session) {
    toast("未找到锻炼记录");
    setTimeout(() => location.href = "./exercise.html", 800);
    return;
  }
  bindEvents();
  hydrateExistingTrack();
  await loadRuntimeData();
  startTimer();
  render();
}

function bindEvents() {
  $("#backBtn").addEventListener("click", () => location.href = "./exercise.html");
  $("#finishBtn").addEventListener("click", finish);
  $("#pauseBtn").addEventListener("click", togglePause);
  $("#nativeMapBtn").addEventListener("click", openNativeMap);
}

function findSession() {
  const rows = repository.read(kind);
  return rows.find(row => row.id === sessionId) || null;
}

function hydrateExistingTrack() {
  const points = state.session.runInfo?.points || [];
  state.gpsPoints = points.map(item => Array.isArray(item)
    ? { lng: Number(item[0]), lat: Number(item[1]), accuracy: 0, time: Date.now(), isCheckPoint: false }
    : { lng: Number(item.lng ?? item.longitude), lat: Number(item.lat ?? item.latitude), accuracy: Number(item.accuracy || 0), time: item.time || Date.now(), isCheckPoint: Boolean(item.isCheckPoint) }
  ).filter(point => Number.isFinite(point.lng) && Number.isFinite(point.lat));
  state.displayGpsPoints = state.gpsPoints.map(point => ({ ...toGcjPoint(point), isCheckPoint: point.isCheckPoint }));
  state.lastPoint = state.gpsPoints[state.gpsPoints.length - 1] || null;
  state.distance = Number(state.session.runInfo?.distance || 0) * 1000;
  state.seconds = Number(state.session.runInfo?.time || state.session.otherInfo?.time || 0);
  state.validSeconds = Number(state.session.otherInfo?.validTime || 0);
}

async function loadRuntimeData() {
  try {
    const payload = {
      eventId: state.session.eventId,
      venueId: state.session.venueId,
      exerciseLocationId: state.session.exerciseLocationId
    };
    state.rangeData = state.session.kind === ExerciseKind.RUN
      ? await repository.getRunPolygonsMarker(payload)
      : await repository.getPolygonsMarker(payload);
    state.fencePoints = extractGeoPoints(state.rangeData);
  } catch (error) {
    state.rangeData = { statusCode: -1, message: error.message };
  }
}

function startTimer() {
  clearInterval(state.timer);
  clearInterval(state.persistTimer);
  state.timer = setInterval(() => {
    state.seconds = Math.floor((Date.now() - new Date(state.session.startTime)) / 1000);
    if (state.session.kind !== ExerciseKind.RUN) {
      state.validSeconds = calculateValidSeconds();
    }
    render();
  }, 1000);
  state.persistTimer = setInterval(persistActiveSession, 5000);
  startLocationWatch();
}

function togglePause() {
  if (state.timer) {
    clearInterval(state.timer);
    clearInterval(state.persistTimer);
    stopLocationWatch();
    state.timer = null;
    state.persistTimer = null;
    $("#pauseBtn").textContent = "继续";
    toast("已暂停计时");
  } else {
    startTimer();
    $("#pauseBtn").textContent = "暂停";
  }
}

async function finish() {
  clearInterval(state.timer);
  clearInterval(state.persistTimer);
  stopLocationWatch();
  const seconds = Math.max(60, state.seconds);
  const metrics = state.session.kind === ExerciseKind.RUN
    ? {
        time: seconds,
        distance: Number(Math.max(state.distance / 1000, 0).toFixed(2)),
        points: state.gpsPoints.length ? state.gpsPoints.map(point => ({
          lng: point.lng,
          lat: point.lat,
          time: point.time,
          accuracy: point.accuracy,
          isCheckPoint: Boolean(point.isCheckPoint)
        })) : buildMockPoints(),
        heartRate: [92, 106, 118, 124]
      }
    : {
        time: seconds,
        validTime: calculateValidSeconds(seconds),
        timePool: [{ start: state.session.startTime, end: new Date().toISOString() }],
        heartRate: [88, 96, 104]
      };
  let finished = finishSession(state.session, metrics);
  if (finished.kind === ExerciseKind.RUN) {
    finished = {
      ...finished,
      runInfo: {
        ...finished.runInfo,
        staticMapUrl: buildStaticMapUrl(state.displayGpsPoints),
        paths: generatePaths(douglasPeucker(state.displayGpsPoints))
      }
    };
  }
  await repository.saveLocalSession(finished);
  toast("已保存到本地待上传");
  setTimeout(() => location.href = "./exercise.html#local", 700);
}

function render() {
  $("#runtimeTitle").textContent = state.session.eventName;
  $("#runtimePlace").textContent = state.session.placeName;
  $("#runtimeTime").textContent = formatTime(Math.max(0, state.seconds));
  $("#runtimeMode").textContent = state.session.kind === ExerciseKind.RUN ? "GPS跑步" : "计时运动";
  $("#runtimeMetric").textContent = state.session.kind === ExerciseKind.RUN
    ? `${Number(Math.max(state.distance / 1000, 0).toFixed(2))} km · ${paceText()}`
    : `有效 ${formatTime(calculateValidSeconds())}`;
  $("#runtimeApi").textContent = JSON.stringify(state.rangeData || {}, null, 2);
  renderMap();
}

async function startLocationWatch() {
  if (state.watchId) return;
  if (window.Capacitor?.isNativePlatform?.() && window.Capacitor?.Plugins?.Geolocation) {
    const geo = window.Capacitor.Plugins.Geolocation;
    try {
      await geo.requestPermissions();
      state.watchId = await geo.watchPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }, position => {
        if (position?.coords) addGpsPoint(position.coords.longitude, position.coords.latitude, position.coords.accuracy);
      });
      return;
    } catch (error) {
      toast(`定位权限异常：${error.message || error}`);
    }
  }

  if (navigator.geolocation) {
    state.watchId = navigator.geolocation.watchPosition(position => {
      addGpsPoint(position.coords.longitude, position.coords.latitude, position.coords.accuracy);
    }, error => toast(`定位失败：${error.message}`), { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 });
  }
}

function stopLocationWatch() {
  if (!state.watchId) return;
  if (window.Capacitor?.isNativePlatform?.() && window.Capacitor?.Plugins?.Geolocation) {
    window.Capacitor.Plugins.Geolocation.clearWatch({ id: state.watchId }).catch(() => {});
  } else if (navigator.geolocation) {
    navigator.geolocation.clearWatch(state.watchId);
  }
  state.watchId = null;
}

function addGpsPoint(lng, lat, accuracy = 0) {
  const now = Date.now();
  const interval = state.session.kind === ExerciseKind.RUN ? 500 : 2000;
  if (state.lastAcceptedAt && now - state.lastAcceptedAt < interval) return;
  const point = { lng: Number(lng), lat: Number(lat), accuracy: Number(accuracy || 0), time: Date.now() };
  const displayPoint = toDisplayTrackPoint(point);
  if (state.lastPoint) {
    const delta = distanceMeters(state.lastPoint, point);
    if (state.session.kind === ExerciseKind.RUN && delta < 200) state.distance += delta;
  }
  point.isCheckPoint = displayPoint.isCheckPoint;
  state.lastPoint = point;
  state.lastAcceptedAt = now;
  state.gpsPoints.push(point);
  state.displayGpsPoints.push(displayPoint);
  state.gpsPoints = state.gpsPoints.slice(-1000);
  state.displayGpsPoints = state.displayGpsPoints.slice(-1000);
  render();
}

function renderMap() {
  const svg = $("#mapSvg");
  if (!svg) return;
  const fencePoints = state.fencePoints.map(toGcjPoint);
  const trackPoints = state.displayGpsPoints;
  const center = getMapCenter([...fencePoints, ...trackPoints]);
  const zoom = chooseZoom(fencePoints, trackPoints);
  renderTiles(center, zoom);

  const fence = projectList(fencePoints, center, zoom);
  const track = projectList(trackPoints, center, zoom);
  const segments = buildTrackSegments(track);
  const start = track[0];
  const end = track.length > 1 ? track[track.length - 1] : null;
  const latest = track[track.length - 1];
  const outsideCount = trackPoints.filter(point => point.isCheckPoint).length;
  $("#mapStatus").textContent = state.session.kind === ExerciseKind.RUN
    ? `GPS ${trackPoints.length}点 · ${outsideCount ? `偏离${outsideCount}点` : "围栏内"}`
    : `GPS ${trackPoints.length}点 · 有效 ${formatTime(calculateValidSeconds())}`;
  svg.innerHTML = `
    ${fence.length >= 3 ? `<polygon points="${toPointString(fence)}" fill="rgba(26,135,95,.18)" stroke="#1a875f" stroke-width="5" stroke-dasharray="12 8" />` : ""}
    ${segments.map(segment => `<polyline points="${toPointString(segment.points)}" fill="none" stroke="rgba(255,255,255,.96)" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" />`).join("")}
    ${segments.map(segment => `<polyline points="${toPointString(segment.points)}" fill="none" stroke="${segment.isCheckPoint ? "#ff0000" : "#009afe"}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />`).join("")}
    ${start ? markerSvg(start, "#16a05f", "起") : ""}
    ${end ? markerSvg(end, "#f05545", "终") : ""}
    ${latest ? `<circle cx="${latest.x}" cy="${latest.y}" r="18" fill="#1e88e5" stroke="#fff" stroke-width="6" />` : ""}
    ${latest ? `<circle cx="${latest.x}" cy="${latest.y}" r="34" fill="rgba(30,136,229,.18)" />` : ""}
  `;
}

function renderTiles(center, zoom) {
  const el = $("#mapTiles");
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const width = Math.max(1, rect.width || 360);
  const height = Math.max(1, rect.height || 270);
  const centerWorld = lngLatToWorld(center.lng, center.lat, zoom);
  const startX = centerWorld.x - width / 2;
  const startY = centerWorld.y - height / 2;
  const minTileX = Math.floor(startX / 256) - 1;
  const maxTileX = Math.floor((startX + width) / 256) + 1;
  const minTileY = Math.floor(startY / 256) - 1;
  const maxTileY = Math.floor((startY + height) / 256) + 1;
  const tiles = [];

  for (let x = minTileX; x <= maxTileX; x += 1) {
    for (let y = minTileY; y <= maxTileY; y += 1) {
      const left = x * 256 - startX;
      const top = y * 256 - startY;
      const sub = Math.abs(x + y) % 4 + 1;
      tiles.push(`<img class="map-tile" src="https://webrd0${sub}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x=${x}&y=${y}&z=${zoom}" style="left:${left.toFixed(1)}px;top:${top.toFixed(1)}px" alt="">`);
    }
  }
  el.innerHTML = tiles.join("");
}

async function openNativeMap() {
  const plugin = window.Capacitor?.Plugins?.NativeAmap;
  if (!plugin) {
    toast("原生高德插件不可用，当前使用页面地图");
    return;
  }
  await plugin.open({
    title: state.session.eventName,
    points: state.displayGpsPoints.map(point => ({ longitude: point.lng, latitude: point.lat, isCheckPoint: point.isCheckPoint })),
    polygons: state.fencePoints.map(toGcjPoint).map(point => ({ longitude: point.lng, latitude: point.lat }))
  });
}

function buildMockPoints() {
  return [
    { lng: 121.4700, lat: 31.2300, isCheckPoint: false },
    { lng: 121.4708, lat: 31.2306, isCheckPoint: false },
    { lng: 121.4715, lat: 31.2310, isCheckPoint: false }
  ];
}

function buildStaticMapUrl(points) {
  const simplified = douglasPeucker(points);
  const center = getMapCenter(simplified.length ? simplified : points);
  const start = simplified[0];
  const end = simplified[simplified.length - 1];
  const markers = [];
  if (start) markers.push(`-1,https://a.amap.com/jsapi/static/image/plugin/marker/start.png,0:${start.lng},${start.lat}`);
  if (end && end !== start) markers.push(`-1,https://a.amap.com/jsapi/static/image/plugin/marker/end.png,0:${end.lng},${end.lat}`);
  const query = new URLSearchParams({
    location: `${center.lng},${center.lat}`,
    zoom: String(chooseZoom([], simplified)),
    scale: "2",
    size: "300*200",
    paths: generatePaths(simplified),
    key: AMAP_KEY
  });
  if (markers.length) query.set("markers", markers.join("|"));
  return `https://restapi.amap.com/v3/staticmap?${query.toString()}`;
}

function generatePaths(trackPoints) {
  let result = "";
  let currentColor = "";
  let coords = "";
  trackPoints.forEach((point, index) => {
    const color = point.isCheckPoint ? "0xFF0000" : "0x009AFE";
    if (color !== currentColor) {
      if (coords) result += `5,${currentColor},1,,:${coords}|`;
      currentColor = color;
      coords = `${point.lng},${point.lat}`;
    } else {
      coords += `;${point.lng},${point.lat}`;
    }
    if (index === trackPoints.length - 1) {
      result += `5,${currentColor},1,,:${coords}`;
    }
  });
  return result;
}

function douglasPeucker(points) {
  if (points.length <= 2) return points;
  const epsilon = pickEpsilon(points.length);
  let maxDistance = 0;
  let maxIndex = 0;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(points[index], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = index;
    }
  }
  if (maxDistance > epsilon) {
    const left = douglasPeucker(points.slice(0, maxIndex + 1));
    const right = douglasPeucker(points.slice(maxIndex));
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

function pickEpsilon(count) {
  if (count >= 5000) return 2e-5;
  if (count >= 4000) return 15e-6;
  if (count >= 3000) return 1e-5;
  if (count >= 2000) return 5e-6;
  if (count >= 1000) return 1e-6;
  return 2e-5;
}

function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.lng - lineStart.lng;
  const dy = lineEnd.lat - lineStart.lat;
  const denominator = Math.sqrt(dy * dy + dx * dx);
  if (!denominator) return 0;
  const numerator = Math.abs(
    dy * point.lng - dx * point.lat + lineEnd.lng * lineStart.lat - lineEnd.lat * lineStart.lng
  );
  return numerator / denominator;
}

function paceText() {
  const km = state.distance / 1000;
  if (!km || !state.seconds) return "配速 --";
  const min = state.seconds / 60 / km;
  return `配速 ${Math.floor(min)}'${String(Math.round((min % 1) * 60)).padStart(2, "0")}''`;
}

function distanceMeters(a, b) {
  const r = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRad(value) {
  return value * Math.PI / 180;
}

function extractGeoPoints(value) {
  const raw = value?.obj ?? value?.raw?.obj ?? value;
  const candidates = [
    raw?.points,
    raw?.pointList,
    raw?.polygons,
    raw?.polygon,
    raw?.list,
    raw?.data,
    raw
  ];
  for (const item of candidates) {
    const points = parsePoints(item);
    if (points.length) return points;
  }
  return [];
}

function parsePoints(value) {
  if (!value) return [];
  if (typeof value === "string") {
    try {
      return parsePoints(JSON.parse(value));
    } catch {
      return value.split(/[;|]/).map(pair => {
        const [lng, lat] = pair.split(",").map(Number);
        return Number.isFinite(lng) && Number.isFinite(lat) ? { lng, lat } : null;
      }).filter(Boolean);
    }
  }
  if (Array.isArray(value)) {
    return value.flatMap(item => {
      if (Array.isArray(item)) return Number.isFinite(Number(item[0])) ? [{ lng: Number(item[0]), lat: Number(item[1]) }] : parsePoints(item);
      const lng = Number(item.lng ?? item.longitude ?? item.lon ?? item.x);
      const lat = Number(item.lat ?? item.latitude ?? item.y);
      return Number.isFinite(lng) && Number.isFinite(lat) ? [{ lng, lat }] : parsePoints(item.points || item.list || item.polygon);
    });
  }
  if (typeof value === "object") return parsePoints(value.points || value.list || value.polygon || value.latLngs);
  return [];
}

function getMapCenter(points) {
  if (points.length) {
    return {
      lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
      lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length
    };
  }
  const placePoint = parsePoints(state.session.centralPoint || state.session.point || "")[0];
  return placePoint || { lng: 121.4708, lat: 31.2306 };
}

function chooseZoom(fencePoints, trackPoints) {
  const count = fencePoints.length + trackPoints.length;
  if (count < 2) return state.mapZoom;
  const points = [...fencePoints, ...trackPoints];
  const lngSpan = Math.max(...points.map(p => p.lng)) - Math.min(...points.map(p => p.lng));
  const latSpan = Math.max(...points.map(p => p.lat)) - Math.min(...points.map(p => p.lat));
  const span = Math.max(lngSpan, latSpan);
  if (span > 0.05) return 14;
  if (span > 0.02) return 15;
  if (span > 0.008) return 16;
  if (span > 0.003) return 17;
  return 18;
}

function projectList(points, center, zoom) {
  const centerWorld = lngLatToWorld(center.lng, center.lat, zoom);
  return points.map(point => {
    const world = lngLatToWorld(point.lng, point.lat, zoom);
    return {
      x: 500 + (world.x - centerWorld.x) * 1000 / getMapPixelWidth(),
      y: 350 + (world.y - centerWorld.y) * 700 / getMapPixelHeight(),
      isCheckPoint: Boolean(point.isCheckPoint)
    };
  });
}

function toDisplayTrackPoint(point) {
  const displayPoint = toGcjPoint(point);
  const fencePoints = state.fencePoints.map(toGcjPoint);
  const isCheckPoint = fencePoints.length >= 3 ? !inPolygon(displayPoint, fencePoints) : false;
  return { ...displayPoint, isCheckPoint };
}

function buildTrackSegments(points) {
  if (points.length < 2) return [];
  const segments = [];
  let current = { isCheckPoint: Boolean(points[0].isCheckPoint), points: [points[0]] };
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index];
    const flag = Boolean(point.isCheckPoint);
    if (flag !== current.isCheckPoint) {
      current.points.push(point);
      segments.push(current);
      current = { isCheckPoint: flag, points: [points[index - 1], point] };
    } else {
      current.points.push(point);
    }
  }
  segments.push(current);
  return segments.filter(segment => segment.points.length >= 2);
}

function markerSvg(point, color, label) {
  return `
    <g>
      <path d="M ${point.x} ${point.y - 42} C ${point.x - 25} ${point.y - 42}, ${point.x - 38} ${point.y - 18}, ${point.x} ${point.y + 30} C ${point.x + 38} ${point.y - 18}, ${point.x + 25} ${point.y - 42}, ${point.x} ${point.y - 42} Z" fill="${color}" stroke="#fff" stroke-width="5" />
      <text x="${point.x}" y="${point.y - 11}" text-anchor="middle" fill="#fff" font-size="26" font-weight="700">${label}</text>
    </g>
  `;
}

function inPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersects = ((yi > point.lat) !== (yj > point.lat)) &&
      (point.lng < (xj - xi) * (point.lat - yi) / ((yj - yi) || 1e-12) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function calculateValidSeconds(seconds = state.seconds) {
  if (state.session.kind === ExerciseKind.RUN) return seconds;
  const latest = state.displayGpsPoints[state.displayGpsPoints.length - 1];
  const inside = latest ? !latest.isCheckPoint : true;
  return Math.max(0, inside ? seconds : Math.min(state.validSeconds || 0, seconds));
}

async function persistActiveSession() {
  if (!state.session || state.session.status !== "active") return;
  const runInfo = state.session.kind === ExerciseKind.RUN
    ? {
        ...state.session.runInfo,
        points: state.gpsPoints.map(point => ({
          lng: point.lng,
          lat: point.lat,
          time: point.time,
          accuracy: point.accuracy,
          isCheckPoint: Boolean(point.isCheckPoint)
        })),
        distance: Number(Math.max(state.distance / 1000, 0).toFixed(2)),
        time: state.seconds
      }
    : state.session.runInfo;
  const otherInfo = state.session.kind === ExerciseKind.RUN
    ? state.session.otherInfo
    : { ...state.session.otherInfo, time: state.seconds, validTime: calculateValidSeconds() };
  state.session = { ...state.session, runInfo, otherInfo, endTime: new Date().toISOString() };
  await repository.saveLocalSession(state.session);
}

function toPointString(points) {
  return points.map(point => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function getMapPixelWidth() {
  return $("#mapTiles")?.getBoundingClientRect().width || 360;
}

function getMapPixelHeight() {
  return $("#mapTiles")?.getBoundingClientRect().height || 270;
}

function lngLatToWorld(lng, lat, zoom) {
  const sin = Math.sin(lat * Math.PI / 180);
  const scale = 256 * 2 ** zoom;
  return {
    x: (lng + 180) / 360 * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale
  };
}

function toGcjPoint(point) {
  if (!point || outOfChina(point.lng, point.lat)) return point;
  const dLat = transformLat(point.lng - 105, point.lat - 35);
  const dLng = transformLng(point.lng - 105, point.lat - 35);
  const radLat = point.lat / 180 * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - 0.00669342162296594323 * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  const mgLat = point.lat + (dLat * 180) / ((6335552.717000426 * magic) / (sqrtMagic * magic) * Math.PI);
  const mgLng = point.lng + (dLng * 180) / (6378245 / sqrtMagic * Math.cos(radLat) * Math.PI);
  return { ...point, lng: mgLng, lat: mgLat };
}

function outOfChina(lng, lat) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x, y) {
  let ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  ret += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3;
  ret += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3;
  return ret;
}

function transformLng(x, y) {
  let ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  ret += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3;
  ret += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3;
  return ret;
}

function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"), 1800);
}
