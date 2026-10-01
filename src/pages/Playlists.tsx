import { Disc3, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlaylistCard } from '../components/PlaylistCard'
import { useToast } from '../components/Toast'
import { useIndexedDb, notifyLibraryChanged } from '../hooks/useIndexedDb'
import { useAuth } from '../hooks/useAuthContext'
import { createPlaylist as createGroupPlaylist, deletePlaylist as removePlaylist, updatePlaylistName } from '../lib/library'
import type { Playlist } from '../types'

export function Playlists() {
  const { tracks, playlists } = useIndexedDb()
  const { group, user } = useAuth()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const createPlaylist = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (!group || !user) return
    await createGroupPlaylist(group.id, user.id, trimmed, [])
    notifyLibraryChanged()
    setName('')
    setCreating(false)
    toast(`Created ${trimmed}`)
  }
  const deletePlaylist = async (playlist: Playlist) => {
    if (!window.confirm(`Delete “${playlist.name}”? Its songs will stay in your library.`)) return
    if (!group) return
    await removePlaylist(group.id, playlist.id)
    notifyLibraryChanged()
    toast(`Deleted ${playlist.name}`)
  }
  const renamePlaylist = async (playlist: Playlist) => {
    const name = window.prompt('Rename playlist', playlist.name)?.trim()
    if (!name || name === playlist.name) return
    if (!group) return
    await updatePlaylistName(group.id, playlist.id, name)
    notifyLibraryChanged()
    toast(`Renamed playlist to ${name}`)
  }
  return <section className="page">
    <div className="page-kicker"><span className="kicker-line" /> MADE BY YOU</div>
    <div className="page-heading-row"><div><h1>Playlists<span className="heading-period">.</span></h1><p className="page-intro">Small worlds made from the songs you keep.</p></div><button className="button button-accent" onClick={() => setCreating((value) => !value)}><Plus size={17} /> New playlist</button></div>
    {creating && <form className="create-playlist-form" onSubmit={(event) => void createPlaylist(event)}><label htmlFor="playlist-name">Playlist name</label><input id="playlist-name" autoFocus maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="A name that feels right" /><button className="button button-dark" type="submit">Create</button><button className="button button-quiet" type="button" onClick={() => setCreating(false)}>Cancel</button></form>}
    {playlists.length ? <div className="playlist-grid">{playlists.map((playlist) => <PlaylistCard key={playlist.id} playlist={playlist} tracks={tracks} canManage={group?.role === 'admin' || playlist.createdBy === user?.id} onDelete={(item) => void deletePlaylist(item)} onRename={(item) => void renamePlaylist(item)} />)}</div> : <div className="empty-state playlist-empty"><div className="empty-orbit"><Disc3 size={27} /></div><h2>No playlists yet</h2><p>Start with a feeling, a season, or a long way home.</p><button className="button button-accent" onClick={() => setCreating(true)}>Create a playlist</button></div>}
    <div className="backup-panel"><div><span className="eyebrow">SHARED GROUP LIBRARY</span><h2>Your group’s music, in one place</h2><p>Tracks and playlists are saved to the group library. Keep your original audio files as a separate backup.</p></div></div>
    {tracks.length === 0 && <p className="subtle-note">Import songs from <Link to="/upload">your device</Link> to fill these playlists.</p>}
  </section>
}