import { ArrowLeft, ListPlus, Play, Search, Shuffle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SearchBar } from '../components/SearchBar'
import { SongList } from '../components/SongList'
import { useToast } from '../components/Toast'
import { useIndexedDb, notifyLibraryChanged } from '../hooks/useIndexedDb'
import { usePlayer } from '../hooks/usePlayer'
import { useAuth } from '../hooks/useAuthContext'
import { setPlaylistTracks } from '../lib/library'
import type { Track } from '../types'

export function PlaylistDetail() {
  const { id } = useParams()
  const { playlists, tracks } = useIndexedDb()
  const playlist = playlists.find((item) => item.id === id)
  const player = usePlayer()
  const { group, user } = useAuth()
  const canManage = Boolean(playlist && user && (group?.role === 'admin' || playlist.createdBy === user.id))
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [selection, setSelection] = useState<string[]>([])
  const playlistTracks = useMemo(() => (playlist?.trackIds ?? []).map((trackId) => tracks.find((track) => track.id === trackId)).filter((track): track is Track => Boolean(track)), [playlist, tracks])
  const filtered = playlistTracks.filter((track) => `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(query.trim().toLowerCase()))
  if (!playlist) return <section className="page"><Link to="/playlists" className="back-link"><ArrowLeft size={16} /> All playlists</Link><div className="empty-state"><h2>Playlist not found</h2><p>It may have been removed from this device.</p></div></section>
  const persistOrder = async (fromId: string, toId: string) => {
    const ids = [...playlist.trackIds]
    const from = ids.indexOf(fromId)
    const to = ids.indexOf(toId)
    if (from < 0 || to < 0) return
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved)
    if (!group || !canManage) return
    await setPlaylistTracks(group.id, playlist.id, ids)
    notifyLibraryChanged()
  }
  const removeTrack = async (index: number) => {
    const track = filtered[index]
    if (!track) return
    if (!group || !canManage) return
    await setPlaylistTracks(group.id, playlist.id, playlist.trackIds.filter((trackId) => trackId !== track.id))
    notifyLibraryChanged()
    toast(`Removed ${track.title}`)
  }
  const addSelected = async () => {
    const additions = selection.filter((trackId) => !playlist.trackIds.includes(trackId))
    if (!group || !canManage) return
    await setPlaylistTracks(group.id, playlist.id, [...playlist.trackIds, ...additions])
    notifyLibraryChanged()
    setSelection([])
    setAddOpen(false)
    toast(`Added ${additions.length} tracks to ${playlist.name}`)
  }
  const playPlaylist = (shuffle = false) => {
    const ids = playlistTracks.map((track) => track.id)
    if (shuffle) ids.sort(() => Math.random() - 0.5)
    if (ids[0]) void player.playTrack(ids[0], ids)
  }
  return <section className="page">
    <Link to="/playlists" className="back-link"><ArrowLeft size={16} /> All playlists</Link>
    <div className="playlist-detail-hero"><div className="detail-record"><span>{playlist.name.slice(0, 1).toUpperCase()}</span></div><div><p className="eyebrow">PLAYLIST</p><h1>{playlist.name}<span className="heading-period">.</span></h1><p className="page-intro">{playlistTracks.length} tracks · Folio group</p><div className="detail-buttons"><button className="button button-accent" disabled={!playlistTracks.length} onClick={() => playPlaylist()}><Play size={16} fill="currentColor" /> Play</button><button className="button button-outline" disabled={!playlistTracks.length} onClick={() => playPlaylist(true)}><Shuffle size={16} /> Shuffle</button>{canManage && <button className="button button-outline" onClick={() => setAddOpen((value) => !value)}><ListPlus size={16} /> Add songs</button>}</div></div></div>
    {canManage && addOpen && <div className="add-songs-panel"><div className="add-songs-heading"><div><Search size={17} /><strong>Add to {playlist.name}</strong></div><button className="button button-dark" disabled={!selection.length} onClick={() => void addSelected()}>Add {selection.length || ''}</button></div><div className="add-songs-list">{tracks.filter((track) => !playlist.trackIds.includes(track.id)).map((track) => <label key={track.id}><input type="checkbox" checked={selection.includes(track.id)} onChange={() => setSelection((current) => current.includes(track.id) ? current.filter((item) => item !== track.id) : [...current, track.id])} /><span><strong>{track.title}</strong><small>{track.artist}</small></span></label>)}</div></div>}
    <div className="library-toolbar"><SearchBar value={query} onChange={setQuery} placeholder="Search this playlist" />{canManage && <span className="reorder-hint">Drag rows to reorder</span>}</div>
    <SongList tracks={filtered} onPlay={(track) => { const ids = playlist.trackIds; void player.playTrack(track.id, ids) }} onQueue={(track) => { player.enqueue([track.id]); toast(`Added ${track.title} to queue`) }} onRemove={canManage ? (index) => void removeTrack(index) : undefined} onReorder={canManage ? (fromId, toId) => void persistOrder(fromId, toId) : undefined} activeId={player.currentTrack?.id} />
  </section>
}