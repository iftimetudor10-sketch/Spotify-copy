export type BlobKind = 'audio' | 'artwork'
export type RepeatMode = 'off' | 'all' | 'one'
export type ThemeMode = 'dark' | 'light'

export interface Track {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  year?: number
  genre?: string
  artworkBlobId?: string
  contentHash?: string
  fileName: string
  createdAt: number
  updatedAt: number
}

export interface BlobDoc {
  id: string
  type: BlobKind
  blob: Blob
}

export interface Playlist {
  id: string
  name: string
  trackIds: string[]
  createdAt: number
  updatedAt: number
}

export interface AppSettings {
  theme: ThemeMode
  repeat: RepeatMode
  shuffle: boolean
  queue: string[]
  currentIndex: number
  lastTrackId?: string
  lastPosition: number
}

export interface AppRecord {
  id: 'settings'
  value: AppSettings
}

export interface QueueState {
  trackIds: string[]
  currentIndex: number
}

export const defaultSettings: AppSettings = {
  theme: 'dark',
  repeat: 'off',
  shuffle: false,
  queue: [],
  currentIndex: -1,
  lastPosition: 0,
}