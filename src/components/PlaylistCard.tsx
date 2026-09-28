import { Disc3, Pencil, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Playlist, Track } from '../types'
import { Artwork } from './Artwork'

export function PlaylistCard({ playlist, tracks, onDelete, onRename }: { playlist: Playlist; tracks: Track[]; onDelete: (playlist: Playlist) => void; onRename: (playlist: Playlist) => void }) {
  const first = playlist.trackIds.map((id) => tracks.find((track) => track.id === id)).find((track) => track !== undefined)
  return (
    <article className="playlist-card">
      <Link className="playlist-cover" to={`/playlists/${playlist.id}`} aria-label={`Open ${playlist.name}`}>
        {first ? <Artwork track={first} /> : <Disc3 size={38} />}
        <span>{String(playlist.trackIds.length).padStart(2, '0')}</span>
      </Link>
      <div className="playlist-card-copy"><Link to={`/playlists/${playlist.id}`}><strong>{playlist.name}</strong></Link><small>{playlist.trackIds.length} tracks</small></div>
      <button className="icon-button" aria-label={`Rename ${playlist.name}`} onClick={() => onRename(playlist)}><Pencil size={15} /></button>
      <button className="icon-button" aria-label={`Delete ${playlist.name}`} onClick={() => onDelete(playlist)}><Trash2 size={15} /></button>
    </article>
  )
}