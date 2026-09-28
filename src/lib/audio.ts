import type { Track } from '../types'

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remainder}`
}

export function placeholderColor(track: Track) {
  const hash = [...track.id].reduce((value, char) => value + char.charCodeAt(0), 0)
  const hues = [12, 215, 338, 42, 188, 255]
  return `hsl(${hues[hash % hues.length]} 48% 30%)`
}

export function initials(track: Track) {
  return track.title.slice(0, 1).toUpperCase()
}

export function createObjectUrl(blob: Blob) {
  return URL.createObjectURL(blob)
}