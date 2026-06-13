export function normalizeBracelet(item = {}) {
  return {
    bindId: item.bindId || item.braceletId || item.id || "",
    macAddress: item.macAddress || item.deviceId || item.address || "",
    name: item.name || item.braceletId || item.model || "未知手环",
    model: item.model || item.name || "M6w",
    electric: item.electric || item.battery || "--",
    raw: item
  };
}

export function buildHeartRatePayload({ bindId, data }) {
  return {
    bindId,
    data: data || [
      { time: new Date().toISOString(), heartRate: 86 },
      { time: new Date(Date.now() - 300000).toISOString(), heartRate: 92 }
    ]
  };
}

export function buildSleepPayload({ bindId, data }) {
  return {
    bindId,
    data: data || [
      { startTime: new Date(Date.now() - 8 * 3600000).toISOString(), endTime: new Date().toISOString(), type: "deep" }
    ]
  };
}
