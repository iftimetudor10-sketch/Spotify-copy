import { ArrowUp, ListMusic, Pause, Play, Repeat, Repeat1, SkipBack, SkipForward } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePlayer } from '../hooks/usePlayer'
import { useIndexedDb } from '../hooks/useIndexedDb'
import { formatTime } from '../lib/audio'
import { Artwork } from '../components/Artwork'

export function NowPlaying() {
  const player = usePlayer()
  const { tracks } = useIndexedDb()
  const track = player.currentTrack
  if (!track) return <section className="page now-playing-empty"><div className="page-kicker"><span className="kicker-line" /> THE LISTENING ROOM</div><div className="empty-state"><div className="empty-orbit"><ListMusic size={28} /></div><h2>Nothing playing yet</h2><p>Pick a song from your archive and make this room yours.</p><Link className="button button-accent" to="/songs">Browse all songs</Link></div></section>
  const upcoming = player.trackIds.slice(player.currentIndex + 1, player.currentIndex + 4).map((id) => tracks.find((item) => item.id === id)).filter((item) => item !== undefined)
  return <section className="now-playing-page">
    <div className="page-kicker"><span className="kicker-line" /> THE LISTENING ROOM <span className="live-label"><span /> PLAYING FROM YOUR DEVICE</span></div>
    <div className="now-playing-layout"><div className="now-art-stage"><div className="art-glow" /><Artwork track={track} className="now-artwork" /><span className="vinyl-label">FOLIO · SIDE A</span></div>
      <div className="now-copy"><p className="eyebrow">NOW PLAYING</p><h1>{track.title}</h1><p className="now-artist">{track.artist}<span> / </span>{track.album}</p><div className="now-progress"><div className="timeline"><span>{formatTime(player.currentTime)}</span><input aria-label="Playback position" type="range" min="0" max={player.duration || 0} value={Math.min(player.currentTime, player.duration || 0)} onChange={(event) => player.seek(Number(event.target.value))} /><span>{formatTime(player.duration)}</span></div></div><div className="now-controls"><button className={`icon-button ${player.shuffle ? 'is-active' : ''}`} onClick={player.toggleShuffle} aria-label="Toggle shuffle" aria-pressed={player.shuffle}><span aria-hidden="true" className="shuffle-symbol">⇄</span></button><button className="icon-button transport-large" onClick={player.previous} aria-label="Previous track"><SkipBack size={22} fill="currentColor" /></button><button className="play-button main-play" onClick={player.toggle} aria-label={player.isPlaying ? 'Pause' : 'Play'}>{player.isPlaying ? <Pause size={23} fill="currentColor" /> : <Play size={23} fill="currentColor" />}</button><button className="icon-button transport-large" onClick={() => void player.next()} aria-label="Next track"><SkipForward size={22} fill="currentColor" /></button><button className={`icon-button ${player.repeat !== 'off' ? 'is-active' : ''}`} onClick={player.cycleRepeat} aria-label={`Repeat ${player.repeat}`}>{player.repeat === 'one' ? <Repeat1 size={19} /> : <Repeat size={19} />}</button></div>
        <div className="up-next-block"><div className="up-next-title"><span>UP NEXT</span><button className="icon-button" onClick={() => player.setQueueOpen(!player.queueOpen)} aria-label="Toggle queue" aria-expanded={player.queueOpen}><ListMusic size={18} /></button></div>{upcoming.length ? upcoming.map((nextTrack) => <div className="up-next-track" key={nextTrack.id}><Artwork track={nextTrack} className="queue-artwork" /><div><strong>{nextTrack.title}</strong><small>{nextTrack.artist}</small></div><button className="icon-button" onClick={() => player.playNext(nextTrack.id)} aria-label={`Move ${nextTrack.title} to play next`}><ArrowUp size={16} /></button></div>) : <p className="up-next-empty">End of the queue. <Link to="/songs">Find another track</Link></p>}</div>
      </div>
    </div>
  </section>
}