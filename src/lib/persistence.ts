import type { InterestArea, Preferences, StreamId } from '../domain/types'

const PREFS_KEY = 'mantak:prefs:v1'
const ZONES_KEY = 'mantak:zones:v1'

export const defaultPreferences: Preferences = {
  selectedStreamId: 'front',
  sortMode: 'priority',
  soundEnabled: true,
  colorScale: 'yellow-red',
  showVelocity: true,
}

export function readPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) {
      return defaultPreferences
    }
    const parsed = JSON.parse(raw) as Partial<Preferences>
    const selectedStreamId = parseStream(parsed.selectedStreamId)
    return {
      selectedStreamId,
      sortMode: parsed.sortMode === 'time' ? 'time' : 'priority',
      soundEnabled: parsed.soundEnabled ?? true,
      colorScale: parsed.colorScale === 'black-white' ? 'black-white' : 'yellow-red',
      showVelocity: parsed.showVelocity ?? true,
    }
  } catch {
    return defaultPreferences
  }
}

export function writePreferences(prefs: Preferences) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

export function readZones(): InterestArea[] {
  try {
    const raw = localStorage.getItem(ZONES_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw) as InterestArea[]
    return parsed.filter((zone) => zone.vertices.length >= 3)
  } catch {
    return []
  }
}

export function writeZones(zones: InterestArea[]) {
  localStorage.setItem(ZONES_KEY, JSON.stringify(zones))
}

function parseStream(input: unknown): StreamId {
  if (input === 'left' || input === 'back' || input === 'right') {
    return input
  }
  return 'front'
}
