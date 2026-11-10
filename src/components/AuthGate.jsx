import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import Login from './Login'

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
