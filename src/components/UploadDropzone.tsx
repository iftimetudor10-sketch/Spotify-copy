import { FileAudio2, FolderOpen } from 'lucide-react'
import { useRef, useState } from 'react'

export function UploadDropzone({ onFiles }: { onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const acceptFiles = (files: FileList | null) => {
    if (files) onFiles(Array.from(files).filter((file) => file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3')))
  }
  return (
    <div className={`upload-dropzone ${dragging ? 'is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFiles(event.dataTransfer.files) }}>
      <input ref={inputRef} type="file" accept="audio/mpeg,.mp3" multiple hidden onChange={(event) => { acceptFiles(event.target.files); event.target.value = '' }} />
      <div className="upload-icon"><FileAudio2 size={24} /></div>
      <h2>Bring your collection in</h2>
      <p>Drop MP3 files here, or open a folder from your device.</p>
      <button className="button button-light" onClick={() => inputRef.current?.click()}><FolderOpen size={17} /> Choose MP3s</button>
      <small>Files stay on this device. Nothing is uploaded to a server.</small>
    </div>
  )
}