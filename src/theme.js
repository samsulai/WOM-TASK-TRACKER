// Shared between App.jsx (the dark/light toggle) and AuthGate.jsx (the
// login screen needs the same theme applied even though App.jsx -- which
// used to be the only place this lived -- doesn't render at all while
// showing the login form).
export function getInitialTheme() {
  try {
    const saved = localStorage.getItem('wtt-theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // localStorage unavailable (private browsing, etc.) -- fall through
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}
