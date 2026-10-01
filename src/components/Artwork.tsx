import { useEffect, useState } from 'react'
import { loadTrackArtwork } from '../lib/library'
import { initials, placeholderColor } from '../lib/audio'
import type { Track } from '../types'

export function Artwork({ track, className = '' }: { track: Track; className?: string }) {
  const [src, setSrc] = useState<string>()
  useEffect(() => {
    let active = true
    let url: string | undefined
    if (track.artworkPath) {
      void loadTrackArtwork(track).then((blob) => {
        if (!active || !blob) return
        url = URL.createObjectURL(blob)
        setSrc(url)
      }).catch(() => setSrc(undefined))
    } else setSrc(undefined)
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [track])

  return (
    <div className={`artwork ${className}`} style={{ background: placeholderColor(track) }}>
      {src ? <img src={src} alt={`${track.album} cover`} /> : <span aria-hidden="true">{initials(track)}</span>}
    </div>
  )
}