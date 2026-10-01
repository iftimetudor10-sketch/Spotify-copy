import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuthContext'
import { listPlaylists, listTracks } from '../lib/library'
import type { Playlist, Track } from '../types'

export function notifyLibraryChanged() {
  window.dispatchEvent(new Event('folio:library-change'))
}

export function useIndexedDb() {
  const { group } = useAuth()
  const groupId = group?.id
  const [tracks, setTracks] = useState<Track[]>([])
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!groupId) {
      setTracks([])
      setPlaylists([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [nextTracks, nextPlaylists] = await Promise.all([
        listTracks(groupId),
        listPlaylists(groupId),
      ])
      setTracks(nextTracks)
      setPlaylists(nextPlaylists)
    } catch (error) {
      console.error('Could not load the group library', error)
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    void refresh()
    window.addEventListener('folio:library-change', refresh)
    return () => window.removeEventListener('folio:library-change', refresh)
  }, [refresh])

  return { tracks, playlists, loading, refresh }
}