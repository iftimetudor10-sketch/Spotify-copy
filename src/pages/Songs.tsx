import { ArrowDownWideNarrow, ListPlus, Music2, Play, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SongList } from '../components/SongList'
import { SearchBar } from '../components/SearchBar'
import { useToast } from '../components/Toast'
import { useIndexedDb } from '../hooks/useIndexedDb'
import { usePlayer } from '../hooks/usePlayer'
import { db } from '../db/indexedDb'
import type { Track } from '../types'

export function Songs() {
  const { tracks, playlists } = useIndexedDb()
  const player = usePlayer()
  const toast = useToast()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('recent')
  const [selected, setSelected] = useState<string[]>([])
  const [playlistId, setPlaylistId] = useState('')
  const shownTracks = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return [...tracks].filter((track) => `${track.title} ${track.artist} ${track.album} ${track.genre ?? ''}`.toLowerCase().includes(normalized)).sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'artist') return a.artist.localeCompare(b.artist)
      if (sort === 'album') return a.album.localeCompare(b.album)
      return b.createdAt - a.createdAt
    })
  }, [query, sort, tracks])
  const toggleSelection = (id: string) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const playTrack = (track: Track) => void player.playTrack(track.id, [track.id, ...tracks.filter((item) => item.id !== track.id).map((item) => item.id)])
  const addSelected = async () => {
    if (!selected.length) return
    if (!playlistId) {
      const name = window.prompt('Name your new playlist')?.trim()
      if (!name) return
      const now = Date.now()
      await db.playlists.add({ id: crypto.randomUUID(), name, trackIds: selected, createdAt: now, updatedAt: now })
      window.dispatchEvent(new Event('folio:library-change'))
      toast(`Added ${selected.length} tracks to ${name}`)
    } else {
      const playlist = await db.playlists.get(playlistId)
      if (!playlist) return
      const additions = selected.filter((id) => !playlist.trackIds.includes(id))
      await db.playlists.update(playlistId, { trackIds: [...playlist.trackIds, ...additions], updatedAt: Date.now() })
      window.dispatchEvent(new Event('folio:library-change'))
      toast(`Added ${additions.length} tracks to ${playlist.name}`)
    }
    setSelected([])
  }
  return <section className="page">
    <div className="page-kicker"><span className="kicker-line" /> THE ARCHIVE</div>
    <div className="songs-hero"><div className="hero-disc"><Music2 size={27} /></div><div><p className="eyebrow">YOUR LIBRARY</p><h1>All songs<span className="heading-period">.</span></h1><p className="page-intro">{tracks.length} track{tracks.length === 1 ? '' : 's'}, all yours.</p></div><button className="button button-accent hero-play" disabled={!tracks.length} onClick={() => shownTracks[0] && playTrack(shownTracks[0])}><Play size={17} fill="currentColor" /> Play all</button></div>
    <div className="library-toolbar"><SearchBar value={query} onChange={setQuery} /><label className="sort-select"><ArrowDownWideNarrow size={16} /><span className="sr-only">Sort songs</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="recent">Recently added</option><option value="title">Title</option><option value="artist">Artist</option><option value="album">Album</option></select></label></div>
    {selected.length > 0 && <div className="selection-toolbar"><span>{selected.length} selected</span><button className="button button-dark" onClick={() => { player.enqueue(selected); toast(`Added ${selected.length} tracks to queue`) }}><ListPlus size={16} /> Add to queue</button><select aria-label="Choose playlist" value={playlistId} onChange={(event) => setPlaylistId(event.target.value)}><option value="">New playlist…</option>{playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}</select><button className="button button-outline" onClick={() => void addSelected()}><Plus size={16} /> Add to playlist</button></div>}
    {!tracks.length ? <div className="empty-state"><div className="empty-orbit"><Music2 size={28} /></div><h2>Your library begins here</h2><p>Bring in a few MP3s and they’ll be waiting here, even offline.</p><button className="button button-accent" onClick={() => navigate('/upload')}>Import your music</button></div> : <SongList tracks={shownTracks} selected={selected} onSelect={toggleSelection} onPlay={playTrack} onQueue={(track) => { player.enqueue([track.id]); toast(`Added ${track.title} to queue`) }} onPlayNext={(track) => { player.playNext(track.id); toast(`${track.title} will play next`) }} activeId={player.currentTrack?.id} />}
  </section>
}