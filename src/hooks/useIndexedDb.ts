import { useCallback, useEffect, useState } from 'react'
import { db } from '../db/indexedDb'
import type { Playlist, Track } from '../types'

export function notifyLibraryChanged() {
  window.dispatchEvent(new Event('folio:library-change'))
}

export function useIndexedDb() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [nextTracks, nextPlaylists] = await Promise.all([
        db.tracks.orderBy('createdAt').reverse().toArray(),
        db.playlists.orderBy('updatedAt').reverse().toArray(),
      ])
      setTracks(nextTracks)
      setPlaylists(nextPlaylists)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    window.addEventListener('folio:library-change', refresh)
    return () => window.removeEventListener('folio:library-change', refresh)
  }, [refresh])

  return { tracks, playlists, loading, refresh }
}