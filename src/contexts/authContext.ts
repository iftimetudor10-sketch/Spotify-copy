import { createContext } from 'react'
import type { User } from '@supabase/supabase-js'

export interface MusicGroup {
  id: string
  name: string
  role: 'admin' | 'member'
}

export interface AuthContextValue {
  user: User | null
  group: MusicGroup | null
  loading: boolean
  groupLoading: boolean
  groupError: string
  isConfigured: boolean
  passwordRecovery: boolean
  refreshGroup: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  createGroup: (name: string) => Promise<void>
  joinGroup: (inviteCode: string) => Promise<void>
  createInvite: () => Promise<string>
}

export const AuthContext = createContext<AuthContextValue | null>(null)