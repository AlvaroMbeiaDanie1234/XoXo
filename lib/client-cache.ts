'use client'

export type TimedCacheEntry<T> = {
  timestamp: number
  data: T
}

export function readTimedCache<T>(key: string, ttlMs: number): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as TimedCacheEntry<T>
    if (!parsed?.timestamp) return null
    if (Date.now() - parsed.timestamp > ttlMs) return null
    return parsed.data
  } catch {
    return null
  }
}

export function writeTimedCache<T>(key: string, data: T) {
  if (typeof window === 'undefined') return
  try {
    const payload: TimedCacheEntry<T> = {
      timestamp: Date.now(),
      data,
    }
    window.sessionStorage.setItem(key, JSON.stringify(payload))
  } catch {
    // Ignore storage quota and serialization errors.
  }
}
