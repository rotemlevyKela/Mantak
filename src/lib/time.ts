export function formatElapsed(fromEpochMs: number, now: number): string {
  const elapsedSec = Math.max(0, Math.floor((now - fromEpochMs) / 1000))
  if (elapsedSec < 60) {
    return `${elapsedSec}s`
  }
  const min = Math.floor(elapsedSec / 60)
  const sec = elapsedSec % 60
  if (min < 60) {
    return `${min}m ${sec}s`
  }
  const hr = Math.floor(min / 60)
  const remMin = min % 60
  return `${hr}h ${remMin}m`
}

export function formatClock(epochMs: number): string {
  const d = new Date(epochMs)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
