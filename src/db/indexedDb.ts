import Dexie, { type Table } from 'dexie'
import type { AppRecord, BlobDoc, Playlist, Track } from '../types'

class MusicDatabase extends Dexie {
  tracks!: Table<Track, string>
  blobs!: Table<BlobDoc, string>
  playlists!: Table<Playlist, string>
  app!: Table<AppRecord, string>

  constructor() {
    super('folio-music-library')
    this.version(1).stores({
      tracks: 'id, title, artist, album, duration, contentHash, createdAt',
      blobs: 'id, type',
      playlists: 'id, name, updatedAt',
      app: 'id',
    })
    this.version(2).stores({
      tracks: 'id, title, artist, album, duration, contentHash, fileName, createdAt',
      blobs: 'id, type',
      playlists: 'id, name, updatedAt',
      app: 'id',
    })
  }
}

export const db = new MusicDatabase()

export async function getSettings() {
  const record = await db.app.get('settings')
  return record?.value
}

export async function saveSettings(value: AppRecord['value']) {
  await db.app.put({ id: 'settings', value })
}