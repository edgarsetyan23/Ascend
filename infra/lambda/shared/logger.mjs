/**
 * Structured JSON logger.
 *
 * Outputs one JSON line per call — CloudWatch Logs Insights can query these
 * fields directly (e.g. filter latencyMs > 1000, count errors by trackerId).
 *
 * Usage:
 *   const { log, startTimer } = makeLogger(event)
 *   const stop = startTimer()
 *   log('info', 'entries-list', { itemCount: 5, ...stop() })
 */
export function makeLogger(event) {
  const requestId = event.requestContext?.requestId ?? 'local'

  function log(level, message, fields = {}) {
    console.log(JSON.stringify({
      level,
      message,
      requestId,
      timestamp: new Date().toISOString(),
      ...fields,
    }))
  }

  function startTimer() {
    const t0 = Date.now()
    return () => ({ latencyMs: Date.now() - t0 })
  }

  return { log, startTimer, requestId }
}
