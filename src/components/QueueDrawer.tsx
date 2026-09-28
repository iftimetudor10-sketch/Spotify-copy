import { GripVertical, ListMusic, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useIndexedDb } from '../hooks/useIndexedDb'
import { usePlayer } from '../hooks/usePlayer'
import { Artwork } from './Artwork'

export function QueueDrawer() {
  const player = usePlayer()
  const { tracks } = useIndexedDb()
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  if (!player.queueOpen) return null
  const queueTracks = player.trackIds.map((id) => tracks.find((track) => track.id === id)).filter((track) => track !== undefined)
  return (
    <aside className="queue-drawer" aria-label="Playback queue">
      <div className="queue-heading"><div><ListMusic size={18} /><h2>Up next</h2><span>{queueTracks.length}</span></div><div><button className="icon-button" onClick={player.clearQueue} aria-label="Clear queue"><Trash2 size={17} /></button><button className="icon-button" onClick={() => player.setQueueOpen(false)} aria-label="Close queue"><X size={18} /></button></div></div>
      {queueTracks.length === 0 ? <div className="queue-empty">Your queue is clear. Add something from your library.</div> : <div className="queue-items">
        {queueTracks.map((track, index) => <div className={`queue-item ${index === player.currentIndex ? 'is-current' : ''}`} key={`${track.id}-${index}`} draggable onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragIndex !== null) player.reorderQueue(dragIndex, index); setDragIndex(null) }} onDragEnd={() => setDragIndex(null)}>
          <GripVertical size={16} className="drag-handle" aria-hidden="true" />
          <button className="queue-item-main" onClick={() => void player.playAt(index)}><Artwork track={track} className="queue-artwork" /><span><strong>{track.title}</strong><small>{track.artist}</small></span></button>
          <button className="icon-button" onClick={() => player.removeFromQueue(index)} aria-label={`Remove ${track.title} from queue`}><X size={15} /></button>
        </div>)}
      </div>}
    </aside>
  )
}