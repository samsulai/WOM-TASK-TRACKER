import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// The only way into the admin dashboard (see AuthGate) -- there's no
// sign-up form here on purpose, this just signs in whoever already has an
// account (created once, by hand, in the Supabase dashboard).
export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Wrong email or password.')
    setSubmitting(false)
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-12">
      <div className="w-full md:w-[480px]">
        <Card className="p-8 md:p-10">
          <div className="mb-8 flex flex-col items-center gap-2 text-center">
            <h1 className="text-2xl font-bold text-foreground md:text-3xl">WordOut Admin</h1>
            <p className="text-[15px] font-medium text-muted-foreground">Weekly Task Tracker</p>
          </div>

          <form onSubmit={onSubmit} className="flex w-full flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-email">Email</Label>
              <Input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
                className="h-12 rounded-lg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-password">Password</Label>
              <Input
                id="login-password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                className="h-12 rounded-lg"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" size="lg" disabled={submitting} className="mt-1 h-12 rounded-lg font-semibold">
              {submitting ? 'Logging in…' : 'Log In'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  )
}
