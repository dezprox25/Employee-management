type Level = "info" | "warn" | "error"

export function logSecurityEvent(event: string, details: Record<string, any> = {}, level: Level = "info") {
  const payload = {
    ts: new Date().toISOString(),
    event,
    ...details,
  }
  try {
    const line = JSON.stringify(payload)
    if (level === "error") console.error(line)
    else if (level === "warn") console.warn(line)
    else console.log(line)
  } catch (e) {
    // Fallback to raw logging if JSON serialization fails
    if (level === "error") console.error("SECURITY_EVENT", event, details)
    else if (level === "warn") console.warn("SECURITY_EVENT", event, details)
    else console.log("SECURITY_EVENT", event, details)
  }
}