import { Check, Copy, Disc3, Headphones, Library, LogOut, Moon, Music2, Sun, Upload, UserRoundPlus, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { defaultSettings, type ThemeMode } from '../types'
import { useAuth } from '../hooks/useAuthContext'
import { useIndexedDb } from '../hooks/useIndexedDb'
import { getUserSettings, saveUserSettings } from '../lib/library'

const links = [
  { to: '/upload', label: 'Import music', icon: Upload },
  { to: '/songs', label: 'All songs', icon: Library },
  { to: '/playlists', label: 'Playlists', icon: Disc3 },
  { to: '/now-playing', label: 'Now playing', icon: Headphones },
]

export function TopBar() {
  const auth = useAuth()
  const { tracks } = useIndexedDb()
  const [theme, setTheme] = useState<ThemeMode>('dark')
  const [inviteCode, setInviteCode] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [accountError, setAccountError] = useState('')
  useEffect(() => {
    let active = true
    if (!auth.user) return
    void getUserSettings(auth.user.id).then((settings) => {
      if (!active) return
      if (settings?.theme) setTheme(settings.theme)
    }).catch((error: unknown) => console.error('Could not load preferences', error))
    return () => { active = false }
  }, [auth.user])
  useEffect(() => { document.documentElement.dataset.theme = theme }, [theme])
  const toggleTheme = async () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    if (!auth.user) return
    try {
      const settings = await getUserSettings(auth.user.id) ?? defaultSettings
      await saveUserSettings(auth.user.id, { ...settings, theme: next })
    } catch (error) {
      setTheme(theme)
      setAccountError(error instanceof Error ? error.message : 'Theme preference could not be saved.')
    }
  }
  const makeInvite = async () => {
    setInviteBusy(true)
    setAccountError('')
    try {
      setInviteCode(await auth.createInvite())
      setCopied(false)
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : 'Invite could not be created.')
    } finally { setInviteBusy(false) }
  }
  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
    } catch {
      setAccountError('Clipboard access is unavailable. Select and copy the invite code.')
    }
  }
  return (
    <aside className="sidebar">
      <NavLink className="brand" to="/songs"><span className="brand-mark"><Music2 size={20} /></span><span>folio<span className="brand-period">.</span></span></NavLink>
      <div className="library-label">YOUR SPACE</div>
      <nav aria-label="Main navigation" className="primary-nav">
        {links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'is-active' : ''}`}><Icon size={18} /><span>{label}</span>{to === '/songs' && <small>{tracks.length}</small>}</NavLink>)}
      </nav>
      <div className="sidebar-bottom">
        <button className="theme-toggle" onClick={() => void toggleTheme()} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}<span>{theme === 'dark' ? 'Daylight' : 'After hours'}</span></button>
        <div className="account-summary"><strong>{auth.group?.name}</strong><small>{auth.user?.email}</small></div>
        <div className="account-actions">
          {auth.group?.role === 'admin' && <button className="icon-button" title="Invite a friend" aria-label="Invite a friend" onClick={() => void makeInvite()} disabled={inviteBusy}><UserRoundPlus size={17} /></button>}
          <button className="icon-button" title="Sign out" aria-label="Sign out" onClick={() => void auth.signOut()}><LogOut size={17} /></button>
        </div>
        {accountError && <p className="account-error" role="alert">{accountError}</p>}
      </div>
      {inviteCode && <div className="invite-backdrop" role="presentation" onClick={() => setInviteCode('')}>
        <section className="invite-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-title" onClick={(event) => event.stopPropagation()}>
          <button className="icon-button invite-close" aria-label="Close invite" onClick={() => setInviteCode('')}><X size={18} /></button>
          <p className="page-kicker"><span className="kicker-line" /> ONE-TIME INVITE</p>
          <h2 id="invite-title">Bring someone in<span className="heading-period">.</span></h2>
          <p>This code works once and expires in 7 days. Share it only with someone you trust.</p>
          <code className="invite-code">{inviteCode}</code>
          <button className="button button-accent" onClick={() => void copyInvite()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : 'Copy invite code'}</button>
        </section>
      </div>}
    </aside>
  )
}