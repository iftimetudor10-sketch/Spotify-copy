import { ListPlus, Play, PlayCircle, X } from 'lucide-react'
import { useState } from 'react'
import { formatTime } from '../lib/audio'
import type { Track } from '../types'
import { Artwork } from './Artwork'

interface SongListProps {
  tracks: Track[]
  onPlay: (track: Track) => void
  onQueue?: (track: Track) => void
  onPlayNext?: (track: Track) => void
  selected?: string[]
  onSelect?: (id: string) => void
  onRemove?: (index: number) => void
  activeId?: string
  showHeader?: boolean
  onReorder?: (fromId: string, toId: string) => void
}

export function SongList({ tracks, onPlay, onQueue, onPlayNext, selected = [], onSelect, onRemove, activeId, showHeader = true, onReorder }: SongListProps) {
  const [dragId, setDragId] = useState<string | null>(null)
  if (!tracks.length) return <div className="empty-row">Nothing here yet. Add a few tracks to get started.</div>
  return (
    <div className="song-list">
      {showHeader && <div className="song-head"><span>#</span><span>Title</span><span>Album</span><span>Duration</span><span /></div>}
      {tracks.map((track, index) => (
        <div className={`song-row ${activeId === track.id ? 'is-current' : ''}`} key={`${track.id}-${index}`} draggable={Boolean(onReorder)} onDragStart={() => setDragId(track.id)} onDragOver={(event) => { if (onReorder) event.preventDefault() }} onDrop={() => { if (dragId && dragId !== track.id) onReorder?.(dragId, track.id); setDragId(null) }} onDragEnd={() => setDragId(null)}>
          <span className="song-number">
            {onSelect ? <input aria-label={`Select ${track.title}`} type="checkbox" checked={selected.includes(track.id)} onChange={() => onSelect(track.id)} /> : <span>{String(index + 1).padStart(2, '0')}</span>}
          </span>
          <button className="song-title-cell" onClick={() => onPlay(track)} aria-label={`Play ${track.title}`}>
            <Artwork track={track} className="song-artwork" />
            <span className="song-copy"><strong>{track.title}</strong><small>{track.artist}</small></span>
          </button>
          <span className="song-album">{track.album}</span>
          <span className="song-duration">{formatTime(track.duration)}</span>
          <span className="song-actions">
            {onQueue && <button className="icon-button" aria-label={`Add ${track.title} to queue`} onClick={() => onQueue(track)}><ListPlus size={17} /></button>}
            {onPlayNext && <button className="icon-button" aria-label={`Play ${track.title} next`} onClick={() => onPlayNext(track)}><PlayCircle size={17} /></button>}
            {onRemove && <button className="icon-button" aria-label={`Remove ${track.title}`} onClick={() => onRemove(index)}><X size={16} /></button>}
            {!onQueue && !onPlayNext && !onRemove && <button className="icon-button" aria-label={`Play ${track.title}`} onClick={() => onPlay(track)}><Play size={16} /></button>}
          </span>
        </div>
      ))}
    </div>
  )
}