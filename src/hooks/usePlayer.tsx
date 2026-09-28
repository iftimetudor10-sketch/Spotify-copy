import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { db, getSettings, saveSettings } from '../db/indexedDb'
import { createObjectUrl } from '../lib/audio'
import { defaultSettings, type AppSettings, type RepeatMode, type Track } from '../types'

interface PlayerContextValue {
  trackIds: string[]
  currentIndex: number
  currentTrack: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  repeat: RepeatMode
  shuffle: boolean
  queueOpen: boolean
  setQueueOpen: (open: boolean) => void
  toggle: () => void
  playTrack: (id: string, nextQueue?: string[]) => Promise<void>
  playAt: (index: number) => Promise<void>
  next: () => Promise<void>
  previous: () => void
  seek: (seconds: number) => void
  enqueue: (ids: string[]) => void
  playNext: (id: string) => void
  removeFromQueue: (index: number) => void
  reorderQueue: (from: number, to: number) => void
  clearQueue: () => void
  cycleRepeat: () => void
  toggleShuffle: () => void
}

const PlayerContext = createContext<PlayerContextValue | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const objectUrlRef = useRef<string | null>(null)
  const requestRef = useRef(0)
  const currentTimeRef = useRef(0)
  const savedPositionBucketRef = useRef(-1)
  const [trackIds, setTrackIds] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const [shuffle, setShuffle] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)

  const persist = useCallback(
    (overrides: Partial<AppSettings> = {}) => {
      void saveSettings({
        ...defaultSettings,
        queue: trackIds,
        currentIndex,
        repeat,
        shuffle,
        lastTrackId: currentTrack?.id,
        lastPosition: currentTime,
        ...overrides,
      })
    }, [currentIndex, currentTime, currentTrack, repeat, shuffle, trackIds],
  )

  const loadTrack = useCallback(async (id: string, autoplay: boolean, startAt = 0) => {
    const requestId = ++requestRef.current
    const [track, audioBlob] = await Promise.all([db.tracks.get(id), db.blobs.get(id)])
    if (requestId !== requestRef.current) return
    if (!track || !audioBlob) {
      setIsPlaying(false)
      return
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    objectUrlRef.current = createObjectUrl(audioBlob.blob)
    setCurrentTrack(track)
    setCurrentTime(startAt)
    currentTimeRef.current = startAt
    setDuration(track.duration)
    const audio = audioRef.current
    if (!audio) return
    audio.src = objectUrlRef.current
    audio.load()
    if (startAt > 0) {
      audio.addEventListener('loadedmetadata', () => { audio.currentTime = startAt }, { once: true })
    }
    if (autoplay) {
      try {
        await audio.play()
        setIsPlaying(true)
      } catch {
        setIsPlaying(false)
      }
    } else {
      setIsPlaying(false)
    }
  }, [])

  const playTrack = useCallback(async (id: string, nextQueue?: string[]) => {
    const queue = nextQueue ?? (trackIds.includes(id) ? trackIds : [...trackIds, id])
    const index = queue.indexOf(id)
    setTrackIds(queue)
    setCurrentIndex(index)
    await loadTrack(id, true)
  }, [loadTrack, trackIds])

  const playAt = useCallback(async (index: number) => {
    const id = trackIds[index]
    if (!id) return
    setCurrentIndex(index)
    await loadTrack(id, true)
  }, [loadTrack, trackIds])

  const next = useCallback(async () => {
    if (repeat === 'one' && audioRef.current) {
      audioRef.current.currentTime = 0
      await audioRef.current.play()
      return
    }
    if (!trackIds.length) return
    let nextIndex = currentIndex + 1
    if (shuffle && trackIds.length > 1) {
      do { nextIndex = Math.floor(Math.random() * trackIds.length) } while (nextIndex === currentIndex)
    } else if (nextIndex >= trackIds.length) {
      if (repeat !== 'all') {
        setIsPlaying(false)
        return
      }
      nextIndex = 0
    }
    await playAt(nextIndex)
  }, [currentIndex, playAt, repeat, shuffle, trackIds])

  const previous = useCallback(() => {
    const audio = audioRef.current
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    if (currentIndex > 0) void playAt(currentIndex - 1)
    else if (audio) audio.currentTime = 0
  }, [currentIndex, playAt])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio?.src && currentTrack) {
      void loadTrack(currentTrack.id, true)
    } else if (audio?.paused) {
      void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false))
    } else {
      audio?.pause()
      setIsPlaying(false)
    }
  }, [currentTrack, loadTrack])

  const enqueue = useCallback((ids: string[]) => {
    setTrackIds((queue) => {
      const nextQueue = [...queue, ...ids.filter((id) => !queue.includes(id))]
      setTimeout(() => persist({ queue: nextQueue }), 0)
      return nextQueue
    })
  }, [persist])

  const playNext = useCallback((id: string) => {
    setTrackIds((queue) => {
      const currentId = queue[currentIndex]
      const without = queue.filter((item) => item !== id)
      const nextIndex = currentId ? without.indexOf(currentId) : -1
      const insertion = nextIndex < 0 ? 0 : nextIndex + 1
      without.splice(insertion, 0, id)
      setCurrentIndex(nextIndex)
      setTimeout(() => persist({ queue: without, currentIndex: nextIndex }), 0)
      return without
    })
  }, [currentIndex, persist])

  const removeFromQueue = useCallback((index: number) => {
    setTrackIds((queue) => {
      const nextQueue = queue.filter((_, itemIndex) => itemIndex !== index)
      const nextIndex = index < currentIndex ? currentIndex - 1 : index === currentIndex ? Math.min(index, nextQueue.length - 1) : currentIndex
      setCurrentIndex(nextIndex)
      if (index === currentIndex && nextQueue[nextIndex]) void loadTrack(nextQueue[nextIndex], true)
      setTimeout(() => persist({ queue: nextQueue, currentIndex: nextIndex }), 0)
      return nextQueue
    })
  }, [currentIndex, loadTrack, persist])

  const reorderQueue = useCallback((from: number, to: number) => {
    setTrackIds((queue) => {
      if (from === to || !queue[from]) return queue
      const nextQueue = [...queue]
      const [moved] = nextQueue.splice(from, 1)
      nextQueue.splice(to, 0, moved)
      const nextIndex = currentIndex === from ? to : from < currentIndex && to >= currentIndex ? currentIndex - 1 : from > currentIndex && to <= currentIndex ? currentIndex + 1 : currentIndex
      setCurrentIndex(nextIndex)
      setTimeout(() => persist({ queue: nextQueue, currentIndex: nextIndex }), 0)
      return nextQueue
    })
  }, [currentIndex, persist])

  const clearQueue = useCallback(() => {
    setTrackIds(currentTrack ? [currentTrack.id] : [])
    setCurrentIndex(currentTrack ? 0 : -1)
    persist({ queue: currentTrack ? [currentTrack.id] : [], currentIndex: currentTrack ? 0 : -1 })
  }, [currentTrack, persist])

  const cycleRepeat = useCallback(() => {
    setRepeat((mode) => {
      const nextMode = mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off'
      setTimeout(() => persist({ repeat: nextMode }), 0)
      return nextMode
    })
  }, [persist])

  const toggleShuffle = useCallback(() => {
    setShuffle((value) => {
      setTimeout(() => persist({ shuffle: !value }), 0)
      return !value
    })
  }, [persist])

  useEffect(() => {
    let active = true
    void getSettings().then((settings) => {
      if (!active || !settings) return
      setTrackIds(settings.queue ?? [])
      setCurrentIndex(settings.currentIndex ?? -1)
      setRepeat(settings.repeat ?? 'off')
      setShuffle(settings.shuffle ?? false)
      if (settings.lastTrackId) void loadTrack(settings.lastTrackId, false, settings.lastPosition ?? 0)
    })
    return () => { active = false }
  }, [loadTrack])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !('mediaSession' in navigator) || !currentTrack) return
    const mediaSession = navigator.mediaSession
    let artworkUrl: string | undefined
    let active = true
    const publishMetadata = (artwork: MediaImage[]) => {
      if (!active) return
      mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.album,
        artwork,
      })
    }
    publishMetadata([{ src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' }])
    if (currentTrack.artworkBlobId) {
      void db.blobs.get(currentTrack.artworkBlobId).then((record) => {
        if (!active || !record) return
        artworkUrl = URL.createObjectURL(record.blob)
        publishMetadata([{ src: artworkUrl, sizes: '512x512', type: record.blob.type || 'image/jpeg' }])
      })
    }
    const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => toggle()],
      ['pause', () => toggle()],
      ['nexttrack', () => void next()],
      ['previoustrack', () => previous()],
      ['seekto', (details) => { if (details.seekTime != null) audio.currentTime = details.seekTime }],
    ]
    for (const [action, handler] of actions) {
      try { mediaSession.setActionHandler(action, handler) } catch { /* Unsupported action */ }
    }
    return () => {
      active = false
      if (artworkUrl) URL.revokeObjectURL(artworkUrl)
    }
  }, [currentTrack, next, previous, toggle])

  useEffect(() => {
    void saveSettings({
      ...defaultSettings,
      queue: trackIds,
      currentIndex,
      repeat,
      shuffle,
      lastTrackId: currentTrack?.id,
      lastPosition: currentTimeRef.current,
    })
  }, [currentIndex, repeat, shuffle, trackIds, currentTrack])

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
  }, [])

  const value: PlayerContextValue = {
    trackIds, currentIndex, currentTrack, isPlaying, currentTime, duration, repeat, shuffle,
    queueOpen, setQueueOpen, toggle, playTrack, playAt, next, previous,
    seek: (seconds) => { if (audioRef.current) audioRef.current.currentTime = seconds },
    enqueue, playNext, removeFromQueue, reorderQueue, clearQueue, cycleRepeat, toggleShuffle,
  }

  return (
    <PlayerContext.Provider value={value}>
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={(event) => {
          const time = event.currentTarget.currentTime
          currentTimeRef.current = time
          setCurrentTime(time)
          const bucket = Math.floor(time / 10)
          if (bucket !== savedPositionBucketRef.current) {
            savedPositionBucketRef.current = bucket
            void saveSettings({ ...defaultSettings, queue: trackIds, currentIndex, repeat, shuffle, lastTrackId: currentTrack?.id, lastPosition: time })
          }
        }}
        onDurationChange={(event) => setDuration(event.currentTarget.duration || 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => { if (repeat === 'one') void next(); else void next() }}
      />
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const value = useContext(PlayerContext)
  if (!value) throw new Error('usePlayer must be used inside PlayerProvider')
  return value
}