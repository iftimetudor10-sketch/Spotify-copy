import { ArrowDownToLine, ArrowUpFromLine, Disc3, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlaylistCard } from '../components/PlaylistCard'
import { useToast } from '../components/Toast'
import { useIndexedDb, notifyLibraryChanged } from '../hooks/useIndexedDb'
import { db } from '../db/indexedDb'
import { exportLibrary, importLibrary } from '../lib/backup'
import type { Playlist } from '../types'

export function Playlists() {
  const { tracks, playlists } = useIndexedDb()
  const toast = useToast()
  const importRef = useRef<HTMLInputElement>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const createPlaylist = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const now = Date.now()
    await db.playlists.add({ id: crypto.randomUUID(), name: trimmed, trackIds: [], createdAt: now, updatedAt: now })
    notifyLibraryChanged()
    setName('')
    setCreating(false)
    toast(`Created ${trimmed}`)
  }
  const deletePlaylist = async (playlist: Playlist) => {
    if (!window.confirm(`Delete “${playlist.name}”? Its songs will stay in your library.`)) return
    await db.playlists.delete(playlist.id)
    notifyLibraryChanged()
    toast(`Deleted ${playlist.name}`)
  }
  const renamePlaylist = async (playlist: Playlist) => {
    const name = window.prompt('Rename playlist', playlist.name)?.trim()
    if (!name || name === playlist.name) return
    await db.playlists.update(playlist.id, { name, updatedAt: Date.now() })
    notifyLibraryChanged()
    toast(`Renamed playlist to ${name}`)
  }
  const restore = async (file?: File) => {
    if (!file) return
    try {
      await importLibrary(file)
      notifyLibraryChanged()
      toast('Library metadata restored. Original audio files must be imported again.')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'The backup could not be read.')
    }
    if (importRef.current) importRef.current.value = ''
  }
  return <section className="page">
    <div className="page-kicker"><span className="kicker-line" /> MADE BY YOU</div>
    <div className="page-heading-row"><div><h1>Playlists<span className="heading-period">.</span></h1><p className="page-intro">Small worlds made from the songs you keep.</p></div><button className="button button-accent" onClick={() => setCreating((value) => !value)}><Plus size={17} /> New playlist</button></div>
    {creating && <form className="create-playlist-form" onSubmit={(event) => void createPlaylist(event)}><label htmlFor="playlist-name">Playlist name</label><input id="playlist-name" autoFocus maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="A name that feels right" /><button className="button button-dark" type="submit">Create</button><button className="button button-quiet" type="button" onClick={() => setCreating(false)}>Cancel</button></form>}
    {playlists.length ? <div className="playlist-grid">{playlists.map((playlist) => <PlaylistCard key={playlist.id} playlist={playlist} tracks={tracks} onDelete={(item) => void deletePlaylist(item)} onRename={(item) => void renamePlaylist(item)} />)}</div> : <div className="empty-state playlist-empty"><div className="empty-orbit"><Disc3 size={27} /></div><h2>No playlists yet</h2><p>Start with a feeling, a season, or a long way home.</p><button className="button button-accent" onClick={() => setCreating(true)}>Create a playlist</button></div>}
    <div className="backup-panel"><div><span className="eyebrow">YOUR DATA, YOUR DEVICE</span><h2>Keep a copy of your library</h2><p>Metadata and playlist structure only. Audio stays in this browser unless you import the original files again.</p></div><div className="backup-actions"><button className="button button-outline" onClick={() => void exportLibrary()}><ArrowDownToLine size={16} /> Export JSON</button><input ref={importRef} hidden type="file" accept="application/json,.json" onChange={(event) => void restore(event.target.files?.[0])} /><button className="button button-outline" onClick={() => importRef.current?.click()}><ArrowUpFromLine size={16} /> Restore JSON</button></div></div>
    {tracks.length === 0 && <p className="subtle-note">Import songs from <Link to="/upload">your device</Link> to fill these playlists.</p>}
  </section>
}