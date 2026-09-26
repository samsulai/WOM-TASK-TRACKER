// Talks to the `weekly-report` Edge Function (supabase/functions/weekly-report).
// The function is protected by a shared secret sent as `x-report-key`; the
// secret is typed into the app once and kept only in this browser.

const baseUrl = import.meta.env.VITE_SUPABASE_URL

export async function callReport(body, adminKey) {
  let res
  try {
    res = await fetch(`${baseUrl}/functions/v1/weekly-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        'x-report-key': adminKey,
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error("Couldn't reach the report function. Has it been deployed yet? (See README → Weekly reports.)")
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    // non-JSON error body -- fall through to the generic message below
  }
  if (!res.ok) {
    if (res.status === 404 && !data?.error) throw new Error('The weekly-report function is not deployed yet. (See README → Weekly reports.)')
    throw new Error(data?.error || `Report function failed (${res.status}).`)
  }
  return data
}
