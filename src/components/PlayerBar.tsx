import { ListMusic, Pause, Play, Repeat, Repeat1, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePlayer } from '../hooks/usePlayer'
import { formatTime } from '../lib/audio'
import { Artwork } from './Artwork'

export function PlayerBar() {
  const player = usePlayer()
  const track = player.currentTrack
  if (!track) return <div className="player-bar player-empty"><span>Choose a track to start listening</span><span className="player-empty-mark">F</span></div>
  return (
    <footer className="player-bar">
      <div className="player-track">
        <Link to="/now-playing" aria-label={`Now playing ${track.title}`}><Artwork track={track} className="player-artwork" /></Link>
        <div className="player-track-copy"><strong>{track.title}</strong><small>{track.artist}</small></div>
      </div>
      <div className="player-controls">
        <div className="transport">
          <button className={`icon-button ${player.shuffle ? 'is-active' : ''}`} onClick={player.toggleShuffle} aria-label="Toggle shuffle" aria-pressed={player.shuffle}><span aria-hidden="true" className="shuffle-symbol">⇄</span></button>
          <button className="icon-button" onClick={player.previous} aria-label="Previous track"><SkipBack size={17} fill="currentColor" /></button>
          <button className="play-button small-play" onClick={player.toggle} aria-label={player.isPlaying ? 'Pause' : 'Play'}>{player.isPlaying ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button>
          <button className="icon-button" onClick={() => void player.next()} aria-label="Next track"><SkipForward size={17} fill="currentColor" /></button>
          <button className={`icon-button ${player.repeat !== 'off' ? 'is-active' : ''}`} onClick={player.cycleRepeat} aria-label={`Repeat ${player.repeat}`}>{player.repeat === 'one' ? <Repeat1 size={17} /> : <Repeat size={17} />}</button>
        </div>
        <div className="timeline"><span>{formatTime(player.currentTime)}</span><input aria-label="Playback position" type="range" min="0" max={player.duration || 0} value={Math.min(player.currentTime, player.duration || 0)} onChange={(event) => player.seek(Number(event.target.value))} /><span>{formatTime(player.duration)}</span></div>
      </div>
      <div className="player-tools"><Volume2 size={17} aria-hidden="true" /><button className="icon-button queue-toggle" onClick={() => player.setQueueOpen(!player.queueOpen)} aria-label="Toggle queue" aria-expanded={player.queueOpen}><ListMusic size={19} /></button></div>
    </footer>
  )
}