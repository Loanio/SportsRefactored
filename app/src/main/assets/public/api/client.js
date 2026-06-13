export const ApiModeKey = "restored.api.mode";
export const SessionKey = "restored.auth.session";
export const SchoolKey = "restored.auth.school";

const DefaultBaseUrl = "http://10.66.22.119:80";

export class ApiError extends Error {
  constructor(message, response = null) {
    super(message);
    this.name = "ApiError";
    this.response = response;
    this.statusCode = response?.statusCode;
  }
}

export class ApiClient {
  constructor(storage = window.localStorage) {
    this.storage = storage;
  }

  isRealMode() {
    return this.storage.getItem(ApiModeKey) === "real";
  }

  setRealMode(enabled) {
    this.storage.setItem(ApiModeKey, enabled ? "real" : "mock");
  }

  getBaseUrl() {
    const school = this.readJson(SchoolKey);
    return normalizeBaseUrl(school?.url || school?.configUrl || DefaultBaseUrl);
  }

  async get(path, data = {}, options = {}) {
    return this.request("GET", path, data, options);
  }

  async post(path, data = {}, options = {}) {
    return this.request("POST", path, data, options);
  }

  async request(method, path, data = {}, options = {}) {
    const url = new URL(`${this.getBaseUrl()}${path}`);
    if (method === "GET" && data && Object.keys(data).length) {
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) url.searchParams.set(key, value);
      });
    }

    const session = this.readJson(SessionKey);
    const headers = {
      token: session?.sysToken || session?.token || "",
      "Content-Type": options.contentType || "application/json",
      ...options.headers
    };

    if (shouldUseNativeHttp()) {
      return this.nativeRequest({ method, url: url.toString(), headers, data, options });
    }

    const response = await fetch(url, {
      method,
      headers,
      body: method === "GET" ? undefined : JSON.stringify(data || {}),
      signal: AbortSignal.timeout(options.timeout || 15000)
    });

    if (!response.ok) throw new ApiError(`网络请求失败：${response.status}`, { statusCode: response.status });

    const payload = await response.json();
    if ((payload.statusCode === -3 || payload.statusCode === -4) && headers.token) {
      this.storage.removeItem(SessionKey);
      throw new ApiError(payload.statusCode === -4 ? "您已在其他设备登录" : "登录已过期，请重新登录", payload);
    }
    return payload;
  }

  async nativeRequest({ method, url, headers, data, options }) {
    const http = window.Capacitor?.Plugins?.CapacitorHttp;
    const response = await http.request({
      method,
      url,
      headers,
      data: method === "GET" ? undefined : data || {},
      connectTimeout: options.timeout || 15000,
      readTimeout: options.timeout || 15000
    });

    if (response.status < 200 || response.status >= 300) {
      throw new ApiError(`网络请求失败：${response.status}`, { statusCode: response.status });
    }

    const payload = parseNativeData(response.data);
    if ((payload.statusCode === -3 || payload.statusCode === -4) && headers.token) {
      this.storage.removeItem(SessionKey);
      throw new ApiError(payload.statusCode === -4 ? "您已在其他设备登录" : "登录已过期，请重新登录", payload);
    }
    return payload;
  }

  readJson(key) {
    try {
      return JSON.parse(this.storage.getItem(key) || "null");
    } catch {
      return null;
    }
  }
}

export async function aesMinEncrypt(value) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode("hzwolf0571jmlKey"), "AES-CBC", false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv: encoder.encode("hzwolf0571jml_Iv") },
    key,
    encoder.encode(String(value))
  );
  return base64FromBytes(new Uint8Array(encrypted));
}

export function normalizeApiResult(payload) {
  if (!payload || typeof payload !== "object") return { statusCode: -1, message: "接口返回为空", obj: null };
  return {
    statusCode: Number(payload.statusCode ?? payload.code ?? payload.status ?? -1),
    message: payload.message || payload.msg || "",
    obj: payload.obj ?? payload.data ?? payload.result ?? null,
    raw: payload
  };
}

function normalizeBaseUrl(value) {
  return String(value || DefaultBaseUrl).replace(/\/$/, "");
}

function shouldUseNativeHttp() {
  return Boolean(window.Capacitor?.isNativePlatform?.() && window.Capacitor?.Plugins?.CapacitorHttp);
}

function parseNativeData(data) {
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return { statusCode: -1, message: data };
    }
  }
  return data || {};
}

function base64FromBytes(bytes) {
  let binary = "";
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}
