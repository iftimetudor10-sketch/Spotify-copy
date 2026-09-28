import { Navigate, Route, Routes } from 'react-router-dom'
import { PlayerBar } from './components/PlayerBar'
import { QueueDrawer } from './components/QueueDrawer'
import { ToastProvider } from './components/Toast'
import { TopBar } from './components/TopBar'
import { NowPlaying } from './pages/NowPlaying'
import { PlaylistDetail } from './pages/PlaylistDetail'
import { Playlists } from './pages/Playlists'
import { Songs } from './pages/Songs'
import { Upload } from './pages/Upload'

export default function App() {
  return <ToastProvider><div className="app-shell"><TopBar /><main className="main-content"><Routes><Route path="/" element={<Navigate to="/songs" replace />} /><Route path="/upload" element={<Upload />} /><Route path="/songs" element={<Songs />} /><Route path="/playlists" element={<Playlists />} /><Route path="/playlists/:id" element={<PlaylistDetail />} /><Route path="/now-playing" element={<NowPlaying />} /><Route path="*" element={<Navigate to="/songs" replace />} /></Routes></main><QueueDrawer /><PlayerBar /></div></ToastProvider>
}