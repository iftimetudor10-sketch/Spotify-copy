import { Check, CircleAlert, Database } from 'lucide-react'
import { useEffect, useState } from 'react'
import { db } from '../db/indexedDb'
import { hashFile, parseAudioFile } from '../lib/id3'
import { notifyLibraryChanged } from '../hooks/useIndexedDb'
import { useAuth } from '../hooks/useAuthContext'
import { findDuplicateTrack, MAX_AUDIO_BYTES, uploadTrack } from '../lib/library'
import { useToast } from '../components/Toast'
import { UploadDropzone } from '../components/UploadDropzone'
import type { Track } from '../types'

interface ImportState { done: number; total: number; added: Track[]; skipped: number; error?: string }

export function Upload() {
  const { group, user } = useAuth()
  const toast = useToast()
  const [localTracks, setLocalTracks] = useState<Track[]>([])
  const [progress, setProgress] = useState<ImportState | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    void db.tracks.toArray().then((tracks) => { if (active) setLocalTracks(tracks) })
    return () => { active = false }
  }, [])

  const importFiles = async (files: File[]) => {
    if (!files.length || busy) return
    setBusy(true)
    const state: ImportState = { done: 0, total: files.length, added: [], skipped: 0 }
    setProgress(state)
    for (const file of files) {
      try {
        if (file.size > MAX_AUDIO_BYTES) throw new Error('This MP3 is larger than the 50 MB upload limit.')
        const [parsed, contentHash] = await Promise.all([parseAudioFile(file), hashFile(file)])
        if (!group || !user) throw new Error('Sign in and join a group before uploading music.')
        const duplicate = await findDuplicateTrack(group.id, contentHash, file.name, parsed.track.duration)
        if (duplicate) state.skipped += 1
        else {
          const track = await uploadTrack(group.id, user.id, file, parsed, contentHash)
          state.added.push(track)
        }
      } catch (error) {
        state.error = error instanceof Error ? error.message : 'This file could not be imported.'
      }
      state.done += 1
      setProgress({ ...state, added: [...state.added] })
    }
    setBusy(false)
    if (state.added.length) notifyLibraryChanged()
    toast(`${state.added.length} imported · ${state.skipped} duplicate${state.skipped === 1 ? '' : 's'} skipped`)
  }

  const migrateLocalTracks = async () => {
    if (!localTracks.length || busy || !group || !user) return
    setBusy(true)
    const state: ImportState = { done: 0, total: localTracks.length, added: [], skipped: 0 }
    setProgress(state)
    for (const track of localTracks) {
      try {
        const audio = await db.blobs.get(track.id)
        if (!audio || !track.fileName.toLowerCase().endsWith('.mp3')) {
          state.skipped += 1
        } else {
          if (audio.blob.size > MAX_AUDIO_BYTES) throw new Error(`${track.fileName} is larger than the 50 MB upload limit.`)
          const file = new File([audio.blob], track.fileName, { type: audio.blob.type || 'audio/mpeg' })
          const contentHash = track.contentHash || await hashFile(file)
          const duplicate = await findDuplicateTrack(group.id, contentHash, track.fileName, track.duration)
          if (duplicate) state.skipped += 1
          else {
            const artwork = track.artworkBlobId ? await db.blobs.get(track.artworkBlobId) : undefined
            const parsed = {
              track: {
                title: track.title,
                artist: track.artist,
                album: track.album,
                duration: track.duration,
                fileName: track.fileName,
                ...(track.year ? { year: track.year } : {}),
                ...(track.genre ? { genre: track.genre } : {}),
              },
              ...(artwork?.type === 'artwork' ? { artwork } : {}),
            }
            state.added.push(await uploadTrack(group.id, user.id, file, parsed, contentHash))
          }
        }
      } catch (error) {
        state.error = error instanceof Error ? error.message : 'A local track could not be uploaded.'
      }
      state.done += 1
      setProgress({ ...state, added: [...state.added] })
    }
    setBusy(false)
    if (state.added.length) notifyLibraryChanged()
    toast(`${state.added.length} uploaded · ${state.skipped} skipped`)
  }

  return <section className="page upload-page">
    <div className="page-kicker"><span className="kicker-line" /> YOUR COLLECTION</div>
    <div className="page-heading-row"><div><h1>Import music<span className="heading-period">.</span></h1><p className="page-intro">A little space for the songs your group loves.</p></div><span className="storage-chip"><Database size={15} /> Group library</span></div>
    <UploadDropzone onFiles={(files) => void importFiles(files)} />
    {localTracks.length > 0 && <div className="legacy-import"><div><strong>Music already on this device</strong><p>{localTracks.length} local track{localTracks.length === 1 ? '' : 's'} found. Upload MP3s to make them available to your group. Local originals are kept.</p></div><button className="button button-outline" onClick={() => void migrateLocalTracks()} disabled={busy}>Upload local MP3s</button></div>}
    {busy && progress && <div className="import-progress"><div className="progress-copy"><span>Uploading tracks to the group library</span><strong>{progress.done} / {progress.total}</strong></div><progress value={progress.done} max={progress.total} /></div>}
    {progress && !busy && <div className={`import-result ${progress.error ? 'has-error' : ''}`}><div className="result-icon">{progress.error ? <CircleAlert size={18} /> : <Check size={18} />}</div><div><strong>{progress.added.length} added, {progress.skipped} duplicates skipped</strong>{progress.error && <p>{progress.error}</p>}</div></div>}
  </section>
}