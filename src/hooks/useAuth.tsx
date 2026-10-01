import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { isSupabaseConfigured, requireSupabase } from '../lib/supabase'
import { useAuth } from './useAuthContext'
import { AuthContext, type MusicGroup } from '../contexts/authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [group, setGroup] = useState<MusicGroup | null>(null)
  const [loading, setLoading] = useState(true)
  const [groupLoading, setGroupLoading] = useState(isSupabaseConfigured)
  const [groupError, setGroupError] = useState('')
  const [passwordRecovery, setPasswordRecovery] = useState(false)
  const userId = user?.id

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      setGroupLoading(false)
      return
    }

    const client = requireSupabase()
    let active = true
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      setGroupLoading(Boolean(session?.user))
      setPasswordRecovery(event === 'PASSWORD_RECOVERY')
      setGroup(null)
    })

    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (!error) {
        setUser(data.session?.user ?? null)
        setGroupLoading(Boolean(data.session?.user))
      } else setGroupLoading(false)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const refreshGroup = useCallback(async () => {
    if (!userId) {
      setGroup(null)
      return
    }
    setGroupLoading(true)
    setGroupError('')
    try {
      const { data, error } = await requireSupabase()
        .from('group_members')
        .select('group_id, member_role, music_groups(name)')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      const groupData = data?.music_groups as unknown as { name: string } | null
      setGroup(data && groupData ? { id: data.group_id, name: groupData.name, role: data.member_role } : null)
    } catch (error) {
      setGroupError(error instanceof Error ? error.message : 'The group membership could not be loaded.')
      throw error
    } finally {
      setGroupLoading(false)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setGroup(null)
      return
    }
    void refreshGroup().catch(() => undefined)
  }, [refreshGroup, userId])

  const signIn = async (email: string, password: string) => {
    const { error } = await requireSupabase().auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (email: string, password: string) => {
    const { data, error } = await requireSupabase().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) throw error
    return Boolean(data.session)
  }

  const signOut = async () => {
    const { error } = await requireSupabase().auth.signOut()
    if (error) throw error
  }

  const resetPassword = async (email: string) => {
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
    if (error) throw error
  }

  const updatePassword = async (password: string) => {
    const { error } = await requireSupabase().auth.updateUser({ password })
    if (error) throw error
    setPasswordRecovery(false)
  }

  const createGroup = async (name: string) => {
    const { error } = await requireSupabase().rpc('create_music_group', { p_name: name.trim() })
    if (error) throw error
    await refreshGroup()
  }

  const joinGroup = async (inviteCode: string) => {
    const { error } = await requireSupabase().rpc('redeem_music_group_invite', { p_invite_code: inviteCode.trim() })
    if (error) throw error
    await refreshGroup()
  }

  const createInvite = async () => {
    if (!group) throw new Error('Create or join a group first.')
    const { data, error } = await requireSupabase().rpc('create_music_group_invite', { p_group_id: group.id, p_expires_in_days: 7 })
    if (error) throw error
    return data as string
  }

  return (
    <AuthContext.Provider value={{
      user, group, loading, groupLoading, groupError, isConfigured: isSupabaseConfigured, passwordRecovery,
      refreshGroup, signIn, signUp, signOut, resetPassword, updatePassword,
      createGroup, joinGroup, createInvite,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

function AuthForm({ recovery = false }: { recovery?: boolean }) {
  const auth = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset' | 'new-password'>(recovery ? 'new-password' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setMessage('')
    setError('')
    setBusy(true)
    try {
      if (mode === 'new-password') {
        await auth.updatePassword(password)
        setMessage('Your password has been updated.')
        setPassword('')
      } else if (mode === 'signin') await auth.signIn(email, password)
      else if (mode === 'signup') {
        const signedIn = await auth.signUp(email, password)
        setMessage(signedIn ? 'Account created. You can now set up or join your group.' : 'Check your email to confirm your account, then sign in to continue.')
      } else {
        await auth.resetPassword(email)
        setMessage('If an account exists for that address, a password reset link is on its way.')
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Authentication failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const title = recovery ? 'Choose a new password' : mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Make an account' : 'Reset your password'

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="auth-brand"><span className="brand-mark">F</span><span>folio<span className="brand-period">.</span></span></div>
        <p className="page-kicker"><span className="kicker-line" /> A LIBRARY FOR YOUR GROUP</p>
        <h1>{title}<span className="heading-period">.</span></h1>
        <p className="page-intro">Keep and play the music your group brings together.</p>
        {!auth.isConfigured ? (
          <p className="auth-message" role="status">Supabase is not configured. Add the project URL and publishable key to your local and Vercel environments.</p>
        ) : (
          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            <label htmlFor="auth-email">Email</label>
            <input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            {mode !== 'reset' && <><label htmlFor="auth-password">{mode === 'new-password' ? 'New password' : 'Password'}</label><input id="auth-password" type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            {message && <p className="auth-message" role="status">{message}</p>}
            <button className="button button-accent" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : mode === 'new-password' ? 'Update password' : 'Send reset link'}</button>
            {!recovery && mode === 'signin' && <button className="auth-link" type="button" onClick={() => setMode('reset')}>Forgot password?</button>}
          </form>
        )}
        {auth.isConfigured && !recovery && <div className="auth-switch">{mode === 'signin' ? 'New here?' : 'Already have an account?'} <button className="auth-link" type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage('') }}>{mode === 'signin' ? 'Create an account' : 'Sign in'}</button></div>}
      </section>
    </main>
  )
}

function GroupSetup() {
  const auth = useAuth()
  const [name, setName] = useState('Our music room')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try { await action() } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'That action could not be completed.')
    } finally { setBusy(false) }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel group-panel">
        <div className="auth-brand"><span className="brand-mark">F</span><span>folio<span className="brand-period">.</span></span></div>
        <p className="page-kicker"><span className="kicker-line" /> SET UP YOUR GROUP</p>
        <h1>Make room for music<span className="heading-period">.</span></h1>
        <p className="page-intro">Create a group for your friends, or join one with an invite code.</p>
        <div className="group-choice">
          <form className="auth-form" onSubmit={(event) => { event.preventDefault(); void run(() => auth.createGroup(name)) }}>
            <label htmlFor="group-name">Create a new group</label>
            <input id="group-name" maxLength={80} required value={name} onChange={(event) => setName(event.target.value)} />
            <button className="button button-accent" type="submit" disabled={busy}>Create group</button>
          </form>
          <form className="auth-form" onSubmit={(event) => { event.preventDefault(); void run(() => auth.joinGroup(inviteCode)) }}>
            <label htmlFor="group-invite">Join with an invite code</label>
            <input id="group-invite" autoComplete="off" required value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} />
            <button className="button button-outline" type="submit" disabled={busy}>Join group</button>
          </form>
        </div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-link" type="button" onClick={() => void auth.signOut()}>Sign out</button>
      </section>
    </main>
  )
}

export function AuthenticatedApp({ children }: { children: ReactNode }) {
  const auth = useAuth()
  if (auth.loading || (auth.user && auth.groupLoading)) return <main className="auth-page"><p role="status">Checking your library…</p></main>
  if (auth.passwordRecovery) return <AuthForm recovery />
  if (!auth.user) return <AuthForm />
  if (auth.groupError) return <main className="auth-page"><section className="auth-panel"><h1>Couldn’t load your group<span className="heading-period">.</span></h1><p className="auth-error" role="alert">{auth.groupError}</p><button className="button button-accent" onClick={() => void auth.refreshGroup().catch(() => undefined)}>Try again</button><button className="auth-link" onClick={() => void auth.signOut()}>Sign out</button></section></main>
  if (!auth.group) return <GroupSetup />
  return <>{children}</>
}

