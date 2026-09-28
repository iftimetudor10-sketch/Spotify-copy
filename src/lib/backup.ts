import { db } from '../db/indexedDb'
import type { AppSettings, Playlist, Track } from '../types'

interface LibraryBackup {
  version: 1
  exportedAt: string
  tracks: Track[]
  playlists: Playlist[]
  settings?: AppSettings
}

export async function exportLibrary() {
  const [tracks, playlists, settings] = await Promise.all([
    db.tracks.toArray(),
    db.playlists.toArray(),
    db.app.get('settings'),
  ])
  const backup: LibraryBackup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    tracks,
    playlists,
    ...(settings ? { settings: settings.value } : {}),
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'folio-library-backup.json'
  link.click()
  URL.revokeObjectURL(url)
}

export async function importLibrary(file: File) {
  const backup = JSON.parse(await file.text()) as LibraryBackup
  if (backup.version !== 1 || !Array.isArray(backup.tracks) || !Array.isArray(backup.playlists)) {
    throw new Error('This backup file is not a supported Folio library export.')
  }
  await db.transaction('rw', db.tracks, db.playlists, db.app, async () => {
    await db.tracks.bulkPut(backup.tracks)
    await db.playlists.bulkPut(backup.playlists)
    if (backup.settings) await db.app.put({ id: 'settings', value: backup.settings })
  })
}