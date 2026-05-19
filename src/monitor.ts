import type { Context, Next } from 'hono'

export interface LogEntry {
  timestamp: string
  method: string
  path: string
  status: number | null
  durationMs: number | null
  ip: string | null
  error?: string
}

const logs: LogEntry[] = []
const MAX_LOG_ENTRIES = 200
let errorCount = 0

export async function monitorMiddleware(c: Context, next: Next) {
  const start = Date.now()
  const ip = c.req.header('x-forwarded-for') || c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || null
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    method: c.req.method,
    path: c.req.path,
    status: null,
    durationMs: null,
    ip,
  }

  try {
    await next()
    entry.status = c.res.status
  } catch (err) {
    entry.status = 500
    entry.error = err instanceof Error ? err.message : String(err)
    throw err
  } finally {
    entry.durationMs = Date.now() - start
    logs.push(entry)
    if (logs.length > MAX_LOG_ENTRIES) {
      logs.shift()
    }
  }
}

export function recordError() {
  errorCount += 1
}

export function getLogs() {
  return logs.slice().reverse()
}

export function getLogSummary() {
  return {
    logCount: logs.length,
    errorCount,
    lastLog: logs[logs.length - 1] ?? null,
  }
}
