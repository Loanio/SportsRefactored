export const ExerciseKind = Object.freeze({
  RUN: "run",
  OTHER: "other"
});

export const SessionStatus = Object.freeze({
  DRAFT: "draft",
  ACTIVE: "active",
  PAUSED: "paused",
  FINISHED_LOCAL: "finished_local",
  UPLOADING: "uploading",
  SYNCED: "synced",
  EXPIRED: "expired"
});

export const ResumeWindowMs = 30 * 60 * 1000;

export function nowIso() {
  return new Date().toISOString();
}

export function createSession({ event, place, user, startedAt = nowIso() }) {
  const isRun = event.kind === ExerciseKind.RUN;
  return {
    id: `${isRun ? "run" : "other"}-${Date.now()}`,
    kind: event.kind,
    eventId: event.id,
    eventName: event.name,
    userId: user.id,
    jobNum: user.jobNum,
    bindId: user.bindId,
    placeName: place?.name || "未选择场地",
    venueId: place?.venueId || "",
    exerciseLocationId: place?.id || "",
    centralPoint: place?.centralPoint || "",
    startTime: startedAt,
    endTime: startedAt,
    heartRate: [],
    status: SessionStatus.ACTIVE,
    runInfo: isRun ? { points: [], distance: 0, time: 0, pace: 0 } : null,
    otherInfo: isRun ? null : { time: 0, validTime: 0, timePool: [] }
  };
}

export function finishSession(session, metrics, endedAt = nowIso()) {
  const next = {
    ...session,
    endTime: endedAt,
    heartRate: metrics.heartRate || session.heartRate,
    status: SessionStatus.FINISHED_LOCAL
  };

  if (session.kind === ExerciseKind.RUN) {
    const time = Math.max(1, Number(metrics.time || session.runInfo.time || 1));
    const distance = Number(metrics.distance || session.runInfo.distance || 0);
    next.runInfo = {
      points: metrics.points || session.runInfo.points,
      distance,
      time,
      pace: metrics.pace || calculatePace(distance, time)
    };
  } else {
    const time = Number(metrics.time || session.otherInfo.time || 0);
    next.otherInfo = {
      time,
      validTime: Number(metrics.validTime || time),
      timePool: metrics.timePool || session.otherInfo.timePool
    };
  }

  return next;
}

export function canResume(session, reference = new Date()) {
  const end = new Date(session.endTime || session.startTime);
  return reference - end < ResumeWindowMs;
}

export function markExpired(session, reference = new Date()) {
  return canResume(session, reference) ? session : { ...session, status: SessionStatus.EXPIRED };
}

export function buildUploadPayload(session) {
  const info = {
    id: session.id,
    userId: session.userId,
    jobNum: session.jobNum,
    bindId: session.bindId,
    eventId: session.eventId,
    startTime: session.startTime,
    endTime: session.endTime,
    heartRate: session.heartRate
  };

  if (session.kind === ExerciseKind.RUN) {
    return {
      info,
      runInfo: {
        points: session.runInfo.points,
        distance: Number(session.runInfo.distance),
        time: Number(session.runInfo.time),
        pace: Number(session.runInfo.pace)
      }
    };
  }

  return {
    info: {
      ...info,
      time: Number(session.otherInfo.time),
      placeName: session.placeName,
      venueId: session.venueId,
      exerciseLocationId: session.exerciseLocationId,
      validTime: Number(session.otherInfo.validTime),
      timePool: session.otherInfo.timePool
    }
  };
}

export function calculatePace(distanceKm, seconds) {
  if (!distanceKm || !seconds) return 0;
  return Number((seconds / 60 / distanceKm).toFixed(2));
}

export function percent(value, total) {
  if (!total) return 0;
  return Math.min(100, Math.round(Number(value) / Number(total) * 100));
}

export function formatTime(seconds) {
  const value = Math.max(0, Number(seconds || 0));
  const h = Math.floor(value / 3600);
  const m = Math.floor(value % 3600 / 60);
  const s = Math.floor(value % 60);
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatDateTime(iso) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}
