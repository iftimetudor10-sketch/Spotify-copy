import type { BlobDoc, Track } from '../types'

export interface ParsedAudio {
  track: Omit<Track, 'id' | 'createdAt' | 'updatedAt' | 'artworkBlobId' | 'contentHash'>
  artwork?: BlobDoc
}

export async function parseAudioFile(file: File): Promise<ParsedAudio> {
  const fallbackTitle = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim()
  try {
    const { parseBlob } = await import('music-metadata-browser')
    const metadata = await parseBlob(file, { duration: true })
    const common = metadata.common
    const picture = common.picture?.[0]
    return {
      track: {
        title: common.title?.trim() || fallbackTitle || 'Untitled track',
        artist: common.artist?.trim() || 'Unknown artist',
        album: common.album?.trim() || 'Unknown album',
        duration: metadata.format.duration ?? 0,
        ...(common.year ? { year: common.year } : {}),
        ...(common.genre?.[0] ? { genre: common.genre[0] } : {}),
        fileName: file.name,
      },
      ...(picture
        ? {
            artwork: {
              id: crypto.randomUUID(),
              type: 'artwork' as const,
              blob: new Blob([picture.data], { type: picture.format || 'image/jpeg' }),
            },
          }
        : {}),
    }
  } catch {
    return {
      track: {
        title: fallbackTitle || 'Untitled track',
        artist: 'Unknown artist',
        album: 'Unknown album',
        duration: 0,
        fileName: file.name,
      },
    }
  }
}

export async function hashFile(file: File) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}