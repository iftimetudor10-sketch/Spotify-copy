import { Disc3, Headphones, Library, Moon, Music2, Sun, Upload } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { db, getSettings, saveSettings } from '../db/indexedDb'
import { defaultSettings, type ThemeMode } from '../types'

const links = [
  { to: '/upload', label: 'Import music', icon: Upload },
  { to: '/songs', label: 'All songs', icon: Library },
  { to: '/playlists', label: 'Playlists', icon: Disc3 },
  { to: '/now-playing', label: 'Now playing', icon: Headphones },
]

export function TopBar() {
  const [theme, setTheme] = useState<ThemeMode>('dark')
  const [count, setCount] = useState(0)
  useEffect(() => {
    void getSettings().then((settings) => {
      if (settings?.theme) setTheme(settings.theme)
    })
    const updateCount = () => void db.tracks.count().then(setCount)
    updateCount()
    window.addEventListener('folio:library-change', updateCount)
    return () => window.removeEventListener('folio:library-change', updateCount)
  }, [])
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    const settings = await getSettings() ?? defaultSettings
    await saveSettings({ ...settings, theme: next })
  }
  return (
    <aside className="sidebar">
      <NavLink className="brand" to="/songs"><span className="brand-mark"><Music2 size={20} /></span><span>folio<span className="brand-period">.</span></span></NavLink>
      <div className="library-label">YOUR SPACE</div>
      <nav aria-label="Main navigation" className="primary-nav">
        {links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}><Icon size={18} /><span>{label}</span>{to === '/songs' && <small>{count}</small>}</NavLink>)}
      </nav>
      <div className="sidebar-bottom"><button className="theme-toggle" onClick={() => void toggleTheme()} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}<span>{theme === 'dark' ? 'Daylight' : 'After hours'}</span></button><span className="local-badge"><span /> Stored on this device</span></div>
    </aside>
  )
}