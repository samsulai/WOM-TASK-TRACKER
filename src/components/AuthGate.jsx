import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { getInitialTheme } from '../theme'
import Login from './Login'

// App.jsx applies the saved/preferred theme on its own mount -- but it
// doesn't render at all while the login screen is up, so without this the
// login screen would always render in the CSS's base (dark) theme
// regardless of what's saved. Applied at module scope (not inside a
// useEffect) so it runs before first paint, no flash of the wrong theme.
document.documentElement.dataset.theme = getInitialTheme()

// Gates the admin dashboard behind a Supabase Auth session -- but only the
// admin dashboard. A client link (?client=<id> in the URL) is meant to be
// opened with no account at all, so it's let through here unconditionally,
// exactly as before this existed; see README "Admin login" for the
// reasoning and one-time setup.
export default function AuthGate({ children }) {
  const isClientLink = Boolean(new URLSearchParams(window.location.search).get('client'))
  const [session, setSession] = useState(undefined) // undefined = still checking

  useEffect(() => {
    if (isClientLink) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })
    return () => subscription.subscription.unsubscribe()
  }, [isClientLink])

  if (isClientLink) return children
  if (session === undefined) return null
  if (!session) return <Login />
  return children
}
