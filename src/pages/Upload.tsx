import { Check, CircleAlert, Database, FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { db } from '../db/indexedDb'
import { hashFile, parseAudioFile } from '../lib/id3'
import { notifyLibraryChanged, useIndexedDb } from '../hooks/useIndexedDb'
import { useToast } from '../components/Toast'
import { UploadDropzone } from '../components/UploadDropzone'
import type { Track } from '../types'

interface ImportState { done: number; total: number; added: Track[]; skipped: number; error?: string }

export function Upload() {
  const { tracks } = useIndexedDb()
  const toast = useToast()
  const [progress, setProgress] = useState<ImportState | null>(null)
  const [busy, setBusy] = useState(false)

  const importFiles = async (files: File[]) => {
    if (!files.length || busy) return
    setBusy(true)
    const state: ImportState = { done: 0, total: files.length, added: [], skipped: 0 }
    setProgress(state)
    for (const file of files) {
      try {
        const [parsed, contentHash] = await Promise.all([parseAudioFile(file), hashFile(file)])
        const duplicate = await db.tracks.where('contentHash').equals(contentHash).first()
        const fallbackDuplicate = duplicate ?? (await db.tracks.where('fileName').equals(file.name).toArray()).find((track) => Math.abs(track.duration - parsed.track.duration) <= 1)
        if (fallbackDuplicate) state.skipped += 1
        else {
          const now = Date.now()
          const id = crypto.randomUUID()
          const track: Track = { ...parsed.track, id, contentHash, ...(parsed.artwork ? { artworkBlobId: parsed.artwork.id } : {}), createdAt: now, updatedAt: now }
          await db.transaction('rw', db.tracks, db.blobs, async () => {
            await db.tracks.add(track)
            await db.blobs.add({ id, type: 'audio', blob: file })
            if (parsed.artwork) await db.blobs.add(parsed.artwork)
          })
          state.added.push(track)
        }
      } catch (error) {
        state.error = error instanceof DOMException && error.name === 'QuotaExceededError'
          ? 'Storage is full. Remove some tracks or use a device with more browser storage.'
          : error instanceof Error ? error.message : 'This file could not be imported.'
      }
      state.done += 1
      setProgress({ ...state, added: [...state.added] })
    }
    setBusy(false)
    if (state.added.length) notifyLibraryChanged()
    toast(`${state.added.length} imported · ${state.skipped} duplicate${state.skipped === 1 ? '' : 's'} skipped`)
  }

  const seedDemo = async () => {
    const now = Date.now()
    const demoItems = [
      { title: 'Soft Signal', artist: 'The Sunday Edit', album: 'Little Hours', frequency: 220 },
      { title: 'Greenhouse', artist: 'Mira Sol', album: 'Little Hours', frequency: 277 },
      { title: 'After the Rain', artist: 'June North', album: 'Open Windows', frequency: 330 },
    ]
    const makeWave = (frequency: number) => {
      const sampleRate = 8000
      const samples = sampleRate
      const buffer = new ArrayBuffer(44 + samples * 2)
      const view = new DataView(buffer)
      const write = (offset: number, text: string) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)))
      write(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); write(8, 'WAVE'); write(12, 'fmt ')
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
      view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
      write(36, 'data'); view.setUint32(40, samples * 2, true)
      for (let index = 0; index < samples; index += 1) view.setInt16(44 + index * 2, Math.sin((index * frequency * 2 * Math.PI) / sampleRate) * 1800, true)
      return new Blob([buffer], { type: 'audio/wav' })
    }
    const pending = demoItems.filter((item) => !tracks.some((track) => track.title === item.title))
    for (const item of pending) {
      const id = crypto.randomUUID()
      const track: Track = { id, title: item.title, artist: item.artist, album: item.album, duration: 1, fileName: `${item.title}.wav`, createdAt: now, updatedAt: now }
      await db.transaction('rw', db.tracks, db.blobs, async () => {
        await db.tracks.add(track)
        await db.blobs.add({ id, type: 'audio', blob: makeWave(item.frequency) })
      })
    }
    notifyLibraryChanged()
    toast(`${pending.length} demo tracks added`)
  }

  return <section className="page upload-page">
    <div className="page-kicker"><span className="kicker-line" /> YOUR COLLECTION</div>
    <div className="page-heading-row"><div><h1>Import music<span className="heading-period">.</span></h1><p className="page-intro">A little space for the songs you already love.</p></div><span className="storage-chip"><Database size={15} /> Local library</span></div>
    <UploadDropzone onFiles={(files) => void importFiles(files)} />
    {busy && progress && <div className="import-progress"><div className="progress-copy"><span>Reading tags and saving tracks</span><strong>{progress.done} / {progress.total}</strong></div><progress value={progress.done} max={progress.total} /></div>}
    {progress && !busy && <div className={`import-result ${progress.error ? 'has-error' : ''}`}><div className="result-icon">{progress.error ? <CircleAlert size={18} /> : <Check size={18} />}</div><div><strong>{progress.added.length} added, {progress.skipped} duplicates skipped</strong>{progress.error && <p>{progress.error}</p>}</div></div>}
    {import.meta.env.DEV && <button className="dev-seed" onClick={() => void seedDemo()}><FlaskConical size={15} /> Add demo tracks</button>}
  </section>
}