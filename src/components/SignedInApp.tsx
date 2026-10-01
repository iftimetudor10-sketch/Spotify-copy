import App from '../App'
import { AuthenticatedApp } from '../hooks/useAuth'
import { useAuth } from '../hooks/useAuthContext'
import { PlayerProvider } from '../hooks/usePlayer'

export function SignedInApp() {
  const { user } = useAuth()
  return <AuthenticatedApp><PlayerProvider key={user?.id}><App /></PlayerProvider></AuthenticatedApp>
}