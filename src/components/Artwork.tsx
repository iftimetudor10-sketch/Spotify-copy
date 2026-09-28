import { useEffect, useState } from 'react'
import { db } from '../db/indexedDb'
import { initials, placeholderColor } from '../lib/audio'
import type { Track } from '../types'

export function Artwork({ track, className = '' }: { track: Track; className?: string }) {
  const [src, setSrc] = useState<string>()
  useEffect(() => {
    let active = true
    let url: string | undefined
    if (track.artworkBlobId) {
      void db.blobs.get(track.artworkBlobId).then((record) => {
        if (!active || !record) return
        url = URL.createObjectURL(record.blob)
        setSrc(url)
      })
    } else setSrc(undefined)
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [track.artworkBlobId])

  return (
    <div className={`artwork ${className}`} style={{ background: placeholderColor(track) }}>
      {src ? <img src={src} alt={`${track.album} cover`} /> : <span aria-hidden="true">{initials(track)}</span>}
    </div>
  )
}