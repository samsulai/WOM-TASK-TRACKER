import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import WeekCard from './components/WeekCard'
import Totals from './components/Totals'
import StatsBar from './components/StatsBar'
import WeekNav from './components/WeekNav'
import ClientsPanel from './components/ClientsPanel'
import ReportsPanel from './components/ReportsPanel'
import ViewSwitcher from './components/ViewSwitcher'
import ExportMenu from './components/ExportMenu'
import { buildXlsxBlob } from './exportXlsx'
import { Mail, Moon, Plus, Sun, Users } from 'lucide-react'
import { formatWeekStart } from './format'
import { INTERNAL_SCOPE } from './scope'
import './App.css'

const SAVE_DEBOUNCE_MS = 600
const RETRY_SAVE_DELAY_MS = 300

function upsertById(list, row) {
  const idx = list.findIndex((item) => item.id === row.id)
  if (idx === -1) return [...list, row]
  const next = list.slice()
  next[idx] = { ...next[idx], ...row }
  return next
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function todayAsWeekStart() {
  // Default the "new week" date picker to the most recent Monday.
  const now = new Date()
  const day = now.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  now.setDate(now.getDate() + diff)
  return now.toISOString().slice(0, 10)
}

// Runs once per app load: any task still not Done in a week before the
// current one gets moved into the current week, so overdue work surfaces
// where it'll actually be seen rather than staying buried in a past week.
// Jumps straight to the current week (not one hop forward) so it stays
// correct even if nobody opened the app for several weeks in a row.
//
// weeksData/tasksData may span multiple clients at once (the admin view
// loads everything unfiltered), so rollover is grouped by each task's own
// week's client_id -- a client's overdue task only ever moves into that
// *same* client's current week (or the internal bucket's, for client_id
// null), never across that boundary.
async function rolloverIncompleteTasks(weeksData, tasksData) {
  const currentWeekStart = todayAsWeekStart()
  const weekById = new Map(weeksData.map((w) => [w.id, w]))

  const tasksToMoveByScope = new Map() // client_id (or '' for internal) -> tasks
  for (const t of tasksData) {
    if (t.done) continue
    const week = weekById.get(t.week_id)
    if (!week || week.week_start >= currentWeekStart) continue
    const scopeKey = week.client_id || ''
    if (!tasksToMoveByScope.has(scopeKey)) tasksToMoveByScope.set(scopeKey, [])
    tasksToMoveByScope.get(scopeKey).push(t)
  }

  if (tasksToMoveByScope.size === 0) {
    return { weeks: weeksData, tasks: tasksData, movedCount: 0 }
  }

  let weeks = weeksData
  let tasks = tasksData
  let movedCount = 0

  for (const [scopeKey, tasksToMove] of tasksToMoveByScope) {
    const scopeClientId = scopeKey || null
    let currentWeek = weeks.find(
      (w) => w.week_start === currentWeekStart && (w.client_id || '') === scopeKey
    )

    if (!currentWeek) {
      const { data, error } = await supabase
        .from('weeks')
        .insert({ week_start: currentWeekStart, label: '', client_id: scopeClientId })
        .select()
        .single()
      if (error) {
        if (error.code === '23505') {
          let query = supabase.from('weeks').select('*').eq('week_start', currentWeekStart).limit(1)
          query = scopeClientId ? query.eq('client_id', scopeClientId) : query.is('client_id', null)
          const { data: existing } = await query
          currentWeek = existing?.[0]
        }
      } else {
        currentWeek = data
      }
      if (!currentWeek) continue // couldn't create/find a week for this scope; skip it, try the rest
      weeks = [currentWeek, ...weeks]
    }

    const taskIds = tasksToMove.map((t) => t.id)
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ week_id: currentWeek.id })
      .in('id', taskIds)
    if (updateError) continue

    const movedIds = new Set(taskIds)
    tasks = tasks.map((t) => (movedIds.has(t.id) ? { ...t, week_id: currentWeek.id } : t))
    movedCount += taskIds.length
  }

  return { weeks, tasks, movedCount }
}

function getInitialTheme() {
  try {
    const saved = localStorage.getItem('wtt-theme')
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // localStorage unavailable (private browsing, etc.) -- fall through
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export default function App() {
  const [theme, setTheme] = useState(getInitialTheme)
  // A client link looks like https://yourapp.com/?client=<uuid>. No param
  // means the internal/admin view (all "unassigned" weeks + client mgmt).
  const [clientId] = useState(() => new URLSearchParams(window.location.search).get('client'))
  const [clients, setClients] = useState([])
  const [clientsPanelOpen, setClientsPanelOpen] = useState(false)
  const [reportsPanelOpen, setReportsPanelOpen] = useState(false)
  const [weeks, setWeeks] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [globalNotice, setGlobalNotice] = useState(null)
  const [savingIds, setSavingIds] = useState(() => new Set())
  const [fieldErrors, setFieldErrors] = useState(() => new Map())
  const [exportMonth, setExportMonth] = useState('')
  const [selectedWeekId, setSelectedWeekId] = useState(null)
  // Admin-only, local UI filter (the "Viewing" switcher in the top bar):
  // null = everything, INTERNAL_SCOPE = weeks with no client, or a client id.
  // Narrows the weeks list/stats/totals/export without leaving your own admin
  // session (unlike clientId, which comes from the URL and can't change).
  const [viewScope, setViewScope] = useState(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('wtt-theme', theme)
    } catch {
      // ignore -- theme just won't persist across sessions
    }
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))

  // Refs mirror latest state so debounced/async callbacks never read stale
  // closures. dirtyIds tracks rows with an unsaved or in-flight local edit;
  // incoming realtime updates for those ids are ignored until the save
  // settles, so a remote change can't clobber keystrokes mid-edit.
  const weeksRef = useRef(weeks)
  const tasksRef = useRef(tasks)
  const dirtyWeekIds = useRef(new Set())
  const dirtyTaskIds = useRef(new Set())
  const editVersion = useRef(new Map()) // id -> monotonically increasing counter
  const saveTimers = useRef(new Map()) // id -> timeout handle

  // Setting state via a functional updater (setTasks(prev => ...)) doesn't
  // run the updater synchronously -- React defers it to the render phase.
  // So any code that needs the *current* tasks/weeks synchronously (e.g. an
  // "immediate" save firing right after a local edit, in the same tick)
  // must go through these refs instead, updated here rather than mirrored
  // from state after the fact.
  const applyTasks = (next) => {
    tasksRef.current = next
    setTasks(next)
  }
  const applyWeeks = (next) => {
    weeksRef.current = next
    setWeeks(next)
  }

  // ---------------------------------------------------------------------
  // Initial load + realtime subscription
  // ---------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false

    async function loadInitial() {
      setLoading(true)
      setLoadError(null)
      const clientsQuery = clientId
        ? supabase.from('clients').select('*').eq('id', clientId)
        : supabase.from('clients').select('*').order('created_at', { ascending: true })
      const [weeksRes, tasksRes, clientsRes] = await Promise.all([
        supabase.from('weeks').select('*').order('week_start', { ascending: false }),
        supabase.from('tasks').select('*').order('created_at', { ascending: true }),
        clientsQuery,
      ])
      if (cancelled) return
      if (weeksRes.error || tasksRes.error || clientsRes.error) {
        setLoadError((weeksRes.error || tasksRes.error || clientsRes.error).message)
        setLoading(false)
        return
      }

      setClients(clientsRes.data)

      let weeksData = weeksRes.data
      let tasksData = tasksRes.data
      if (clientId) {
        weeksData = weeksData.filter((w) => w.client_id === clientId)
        const weekIds = new Set(weeksData.map((w) => w.id))
        tasksData = tasksData.filter((t) => weekIds.has(t.week_id))
      }

      const rolled = await rolloverIncompleteTasks(weeksData, tasksData)
      if (cancelled) return
      if (rolled.movedCount > 0) {
        setGlobalNotice({
          type: 'info',
          text: `Moved ${rolled.movedCount} incomplete task${rolled.movedCount === 1 ? '' : 's'} into this week.`,
        })
      }

      applyWeeks(rolled.weeks)
      applyTasks(rolled.tasks)
      setLoading(false)
    }

    loadInitial()

    const channel = supabase
      .channel('wtt-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'weeks' }, (payload) => {
        if (payload.eventType !== 'DELETE' && clientId && payload.new.client_id !== clientId) return
        if (payload.eventType === 'INSERT') {
          applyWeeks(upsertById(weeksRef.current, payload.new))
        } else if (payload.eventType === 'UPDATE') {
          if (dirtyWeekIds.current.has(payload.new.id)) return
          applyWeeks(upsertById(weeksRef.current, payload.new))
        } else if (payload.eventType === 'DELETE') {
          applyWeeks(weeksRef.current.filter((w) => w.id !== payload.old.id))
          dirtyWeekIds.current.delete(payload.old.id)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (payload.eventType !== 'DELETE' && clientId) {
          const weekIds = new Set(weeksRef.current.map((w) => w.id))
          if (!weekIds.has(payload.new.week_id)) return
        }
        if (payload.eventType === 'INSERT') {
          applyTasks(upsertById(tasksRef.current, payload.new))
        } else if (payload.eventType === 'UPDATE') {
          if (dirtyTaskIds.current.has(payload.new.id)) return
          applyTasks(upsertById(tasksRef.current, payload.new))
        } else if (payload.eventType === 'DELETE') {
          applyTasks(tasksRef.current.filter((t) => t.id !== payload.old.id))
          dirtyTaskIds.current.delete(payload.old.id)
          const timer = saveTimers.current.get(payload.old.id)
          if (timer) {
            clearTimeout(timer)
            saveTimers.current.delete(payload.old.id)
          }
        }
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
      // saveTimers.current is a Map mutated in place for the component's
      // whole lifetime (never reassigned), so reading it here is safe.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const timers = saveTimers.current
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
    // clientId is set once via lazy useState initializer and never changes,
    // so this effect still only runs once on mount.
  }, [clientId])

  // ---------------------------------------------------------------------
  // Task editing: optimistic local update + debounced save, with retry on
  // failure and re-entrancy handling if the row changes again mid-save.
  // ---------------------------------------------------------------------
  const bumpVersion = (id) => {
    const next = (editVersion.current.get(id) || 0) + 1
    editVersion.current.set(id, next)
    return next
  }

  const flushTaskSave = useCallback(async (taskId) => {
    const timer = saveTimers.current.get(taskId)
    if (timer) {
      clearTimeout(timer)
      saveTimers.current.delete(taskId)
    }
    const task = tasksRef.current.find((t) => t.id === taskId)
    if (!task) {
      dirtyTaskIds.current.delete(taskId)
      return
    }
    const versionAtSave = editVersion.current.get(taskId) || 0
    setSavingIds((prev) => new Set(prev).add(taskId))

    const { project, status, hours, notes, done } = task
    const { error } = await supabase
      .from('tasks')
      .update({ project, status, hours, notes, done })
      .eq('id', taskId)

    setSavingIds((prev) => {
      const next = new Set(prev)
      next.delete(taskId)
      return next
    })

    if (error) {
      setFieldErrors((prev) => new Map(prev).set(taskId, error.message))
      // Keep dirty flag set: we don't want a stale realtime UPDATE to
      // overwrite the edit the user is still trying to save.
      return
    }

    setFieldErrors((prev) => {
      if (!prev.has(taskId)) return prev
      const next = new Map(prev)
      next.delete(taskId)
      return next
    })

    if ((editVersion.current.get(taskId) || 0) === versionAtSave) {
      dirtyTaskIds.current.delete(taskId)
    } else {
      // More edits landed while this save was in flight; save again.
      scheduleTaskSave(taskId, RETRY_SAVE_DELAY_MS)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scheduleTaskSave = useCallback(
    (taskId, delay = SAVE_DEBOUNCE_MS) => {
      const existing = saveTimers.current.get(taskId)
      if (existing) clearTimeout(existing)
      const timer = setTimeout(() => flushTaskSave(taskId), delay)
      saveTimers.current.set(taskId, timer)
    },
    [flushTaskSave]
  )

  const updateTaskField = useCallback(
    (taskId, patch, { immediate = false } = {}) => {
      dirtyTaskIds.current.add(taskId)
      bumpVersion(taskId)
      applyTasks(tasksRef.current.map((t) => (t.id === taskId ? { ...t, ...patch } : t)))
      if (immediate) flushTaskSave(taskId)
      else scheduleTaskSave(taskId)
    },
    [flushTaskSave, scheduleTaskSave]
  )

  const addTask = useCallback(async (weekId) => {
    const { data, error } = await supabase
      .from('tasks')
      .insert({ week_id: weekId, project: '', status: 'Not Started', hours: 0, notes: '', done: false })
      .select()
      .single()
    if (error) {
      setGlobalNotice({ type: 'error', text: `Couldn't add task: ${error.message}` })
      return
    }
    applyTasks(upsertById(tasksRef.current, data))
  }, [])

  const deleteTask = useCallback(async (taskId) => {
    const backup = tasksRef.current.find((t) => t.id === taskId)
    const label = backup?.project?.trim() || 'this task'
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return
    applyTasks(tasksRef.current.filter((t) => t.id !== taskId))
    dirtyTaskIds.current.delete(taskId)
    const timer = saveTimers.current.get(taskId)
    if (timer) {
      clearTimeout(timer)
      saveTimers.current.delete(taskId)
    }
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (error && backup) {
      applyTasks(upsertById(tasksRef.current, backup))
      setGlobalNotice({ type: 'error', text: `Couldn't delete task: ${error.message}` })
    }
  }, [])

  // ---------------------------------------------------------------------
  // Week editing (label) + add/delete, mirroring the task logic above.
  // ---------------------------------------------------------------------
  const flushWeekSave = useCallback(async (weekId) => {
    const timer = saveTimers.current.get(`week:${weekId}`)
    if (timer) {
      clearTimeout(timer)
      saveTimers.current.delete(`week:${weekId}`)
    }
    const week = weeksRef.current.find((w) => w.id === weekId)
    if (!week) {
      dirtyWeekIds.current.delete(weekId)
      return
    }
    const versionAtSave = editVersion.current.get(`week:${weekId}`) || 0
    const { label, week_start, client_id } = week
    const { error } = await supabase
      .from('weeks')
      .update({ label, week_start, client_id })
      .eq('id', weekId)
    if (error) {
      const message =
        error.code === '23505' ? 'A week starting on that date already exists.' : error.message
      setFieldErrors((prev) => new Map(prev).set(`week:${weekId}`, message))
      return
    }
    setFieldErrors((prev) => {
      if (!prev.has(`week:${weekId}`)) return prev
      const next = new Map(prev)
      next.delete(`week:${weekId}`)
      return next
    })
    if ((editVersion.current.get(`week:${weekId}`) || 0) === versionAtSave) {
      dirtyWeekIds.current.delete(weekId)
    }
  }, [])

  const updateWeekField = useCallback(
    (weekId, patch) => {
      dirtyWeekIds.current.add(weekId)
      bumpVersion(`week:${weekId}`)
      applyWeeks(weeksRef.current.map((w) => (w.id === weekId ? { ...w, ...patch } : w)))
      const key = `week:${weekId}`
      const existing = saveTimers.current.get(key)
      if (existing) clearTimeout(existing)
      const timer = setTimeout(() => flushWeekSave(weekId), SAVE_DEBOUNCE_MS)
      saveTimers.current.set(key, timer)
    },
    [flushWeekSave]
  )

  // New weeks belong to whoever you're currently viewing: the client link's
  // client, or the client picked in the admin "Viewing" switcher. Under
  // "All" or "Internal only" they start out internal.
  const newWeekClientId = clientId || (viewScope && viewScope !== INTERNAL_SCOPE ? viewScope : null)

  // The DB's unique (client_id, week_start) index can't catch duplicates for
  // internal weeks (client_id is NULL, and NULLs never collide), so check
  // here that an owner doesn't end up with two weeks starting the same day.
  const ownerHasWeekStarting = (ownerId, weekStart, exceptWeekId) =>
    weeksRef.current.some(
      (w) => w.id !== exceptWeekId && (w.client_id || null) === ownerId && w.week_start === weekStart
    )

  const addWeek = useCallback(async () => {
    const weekStart = todayAsWeekStart()
    if (ownerHasWeekStarting(newWeekClientId, weekStart)) {
      setGlobalNotice({ type: 'error', text: 'A week starting on that date already exists.' })
      return
    }
    const { data, error } = await supabase
      .from('weeks')
      .insert({ week_start: weekStart, label: '', client_id: newWeekClientId })
      .select()
      .single()
    if (error) {
      const text = error.code === '23505'
        ? 'A week starting on that date already exists.'
        : `Couldn't add week: ${error.message}`
      setGlobalNotice({ type: 'error', text })
      return
    }
    applyWeeks(upsertById(weeksRef.current, data))
    setSelectedWeekId(data.id)
  }, [newWeekClientId])

  const moveWeek = useCallback(
    (weekId, newClientId) => {
      const week = weeksRef.current.find((w) => w.id === weekId)
      if (!week || (week.client_id || null) === newClientId) return
      const destination = newClientId ? clients.find((c) => c.id === newClientId)?.name || 'that client' : 'Internal'
      if (ownerHasWeekStarting(newClientId, week.week_start, weekId)) {
        setGlobalNotice({
          type: 'error',
          text: `Can't move it: ${destination} already has a week starting on ${formatWeekStart(week.week_start)}. Change this week's date first.`,
        })
        return
      }
      updateWeekField(weekId, { client_id: newClientId })
      setGlobalNotice({ type: 'info', text: `Moved this week to ${destination}.` })
    },
    [clients, updateWeekField]
  )

  const deleteWeek = useCallback(async (weekId) => {
    if (!window.confirm('Delete this week and all its tasks? This cannot be undone.')) return
    const backupWeek = weeksRef.current.find((w) => w.id === weekId)
    const backupTasks = tasksRef.current.filter((t) => t.week_id === weekId)
    applyWeeks(weeksRef.current.filter((w) => w.id !== weekId))
    applyTasks(tasksRef.current.filter((t) => t.week_id !== weekId))
    setSelectedWeekId((prev) => (prev === weekId ? null : prev))
    const { error } = await supabase.from('weeks').delete().eq('id', weekId)
    if (error && backupWeek) {
      applyWeeks(upsertById(weeksRef.current, backupWeek))
      let next = tasksRef.current
      for (const t of backupTasks) next = upsertById(next, t)
      applyTasks(next)
      setGlobalNotice({ type: 'error', text: `Couldn't delete week: ${error.message}` })
    }
  }, [])

  const addClient = useCallback(async (name) => {
    const { data, error } = await supabase.from('clients').insert({ name }).select().single()
    if (error) {
      setGlobalNotice({ type: 'error', text: `Couldn't add client: ${error.message}` })
      return
    }
    setClients((prev) => [...prev, data])
  }, [])

  const updateClientEmail = useCallback(
    async (clientIdToUpdate, email) => {
      const previous = clients.find((c) => c.id === clientIdToUpdate)?.email ?? null
      const next = email || null
      if (next && !/^\S+@\S+\.\S+$/.test(next)) {
        setGlobalNotice({ type: 'error', text: `"${email}" doesn't look like an email address.` })
        return
      }
      setClients((prev) => prev.map((c) => (c.id === clientIdToUpdate ? { ...c, email: next } : c)))
      const { error } = await supabase.from('clients').update({ email: next }).eq('id', clientIdToUpdate)
      if (error) {
        setClients((prev) => prev.map((c) => (c.id === clientIdToUpdate ? { ...c, email: previous } : c)))
        setGlobalNotice({
          type: 'error',
          text: /email/i.test(error.message)
            ? "Couldn't save the email — the database hasn't been updated for weekly reports yet (see README → Weekly reports)."
            : `Couldn't save the email: ${error.message}`,
        })
      }
    },
    [clients]
  )

  const deleteClient = useCallback(
    async (clientIdToDelete) => {
      const backupClient = clients.find((c) => c.id === clientIdToDelete)
      if (!backupClient) return
      if (
        !window.confirm(
          `Delete "${backupClient.name}"? Their weeks and tasks will NOT be deleted -- they'll become internal (unassigned) instead.`
        )
      ) {
        return
      }
      const affectedWeekIds = weeksRef.current
        .filter((w) => w.client_id === clientIdToDelete)
        .map((w) => w.id)

      setClients((prev) => prev.filter((c) => c.id !== clientIdToDelete))
      setViewScope((prev) => (prev === clientIdToDelete ? null : prev))
      applyWeeks(
        weeksRef.current.map((w) => (w.client_id === clientIdToDelete ? { ...w, client_id: null } : w))
      )

      const { error } = await supabase.from('clients').delete().eq('id', clientIdToDelete)
      if (error) {
        setClients((prev) => [...prev, backupClient])
        applyWeeks(
          weeksRef.current.map((w) =>
            affectedWeekIds.includes(w.id) ? { ...w, client_id: clientIdToDelete } : w
          )
        )
        setGlobalNotice({ type: 'error', text: `Couldn't delete client: ${error.message}` })
      }
    },
    [clients]
  )

  // ---------------------------------------------------------------------
  // Derived view data
  // ---------------------------------------------------------------------
  const tasksByWeek = useMemo(() => {
    const map = new Map()
    for (const task of tasks) {
      if (!map.has(task.week_id)) map.set(task.week_id, [])
      map.get(task.week_id).push(task)
    }
    return map
  }, [tasks])

  const weekHoursById = useMemo(() => {
    const map = new Map()
    for (const [weekId, weekTasks] of tasksByWeek) {
      map.set(weekId, weekTasks.reduce((sum, t) => sum + Number(t.hours || 0), 0))
    }
    return map
  }, [tasksByWeek])

  // "Viewing" filter (admin only): narrows weeks/tasks down to just one
  // client's data (or just internal weeks), same idea as clientId but
  // toggleable from the UI instead of fixed by the URL.
  const visibleWeeks = useMemo(() => {
    if (clientId || !viewScope) return weeks
    if (viewScope === INTERNAL_SCOPE) return weeks.filter((w) => !w.client_id)
    return weeks.filter((w) => w.client_id === viewScope)
  }, [weeks, clientId, viewScope])

  const visibleTasks = useMemo(() => {
    if (clientId || !viewScope) return tasks
    const visibleWeekIds = new Set(visibleWeeks.map((w) => w.id))
    return tasks.filter((t) => visibleWeekIds.has(t.week_id))
  }, [tasks, clientId, viewScope, visibleWeeks])

  // Newest first. Realtime inserts and new weeks arrive at the end of the
  // array, so keep the list (and prev/next stepping) ordered by date here.
  const sortedWeeks = useMemo(
    () =>
      [...visibleWeeks].sort(
        (a, b) => b.week_start.localeCompare(a.week_start) || a.created_at?.localeCompare(b.created_at || '') || 0
      ),
    [visibleWeeks]
  )

  const currentWeekStart = useMemo(() => todayAsWeekStart(), [])
  const currentWeek = useMemo(
    () => sortedWeeks.find((w) => w.week_start === currentWeekStart),
    [sortedWeeks, currentWeekStart]
  )
  const selectedWeek =
    (selectedWeekId && sortedWeeks.find((w) => w.id === selectedWeekId)) || currentWeek
  const selectedIndex = selectedWeek ? sortedWeeks.findIndex((w) => w.id === selectedWeek.id) : -1
  // "Previous" steps back in time (further down the newest-first list).
  const olderWeek = selectedIndex >= 0 ? sortedWeeks[selectedIndex + 1] : undefined
  const newerWeek = selectedIndex > 0 ? sortedWeeks[selectedIndex - 1] : undefined
  const clientName = clientId ? clients.find((c) => c.id === clientId)?.name : null
  // Anyone on a client link gets a view-only experience: they can browse
  // weeks, see totals, and export CSV, but never add/edit/delete anything.
  // Only the admin's own link (no clientId) can make changes.
  const readOnly = Boolean(clientId)
  const scopeName =
    viewScope === INTERNAL_SCOPE ? 'Internal' : viewScope ? clients.find((c) => c.id === viewScope)?.name || null : null

  // Per-client rollup for the admin Clients panel: how much is going on with
  // each client at a glance, without having to open their link.
  const clientStats = useMemo(() => {
    const stats = new Map()
    for (const week of weeks) {
      if (!week.client_id) continue
      const entry = stats.get(week.client_id) || { weeksCount: 0, hoursTotal: 0, tasksOpen: 0, tasksDone: 0 }
      entry.weeksCount += 1
      for (const task of tasksByWeek.get(week.id) || []) {
        entry.hoursTotal += Number(task.hours || 0)
        if (task.done) entry.tasksDone += 1
        else entry.tasksOpen += 1
      }
      stats.set(week.client_id, entry)
    }
    return stats
  }, [weeks, tasksByWeek])

  const projectTotals = useMemo(() => {
    const totals = new Map()
    for (const task of visibleTasks) {
      const key = task.project.trim() || '(no project)'
      totals.set(key, (totals.get(key) || 0) + Number(task.hours || 0))
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1])
  }, [visibleTasks])

  const taskStats = useMemo(
    () => ({
      tasksOpen: visibleTasks.filter((t) => !t.done).length,
      tasksDone: visibleTasks.filter((t) => t.done).length,
    }),
    [visibleTasks]
  )

  const grandTotal = useMemo(
    () => visibleTasks.reduce((sum, t) => sum + Number(t.hours || 0), 0),
    [visibleTasks]
  )

  const exportRows = useMemo(() => {
    const rows = []
    for (const week of visibleWeeks) {
      for (const task of tasksByWeek.get(week.id) || []) {
        rows.push({
          client: week.client_id ? clients.find((c) => c.id === week.client_id)?.name || 'Client' : 'Internal',
          weekStart: week.week_start,
          weekLabel: week.label,
          project: task.project,
          status: task.status,
          hours: task.hours,
          notes: task.notes,
          done: task.done,
        })
      }
    }
    return rows
  }, [visibleWeeks, tasksByWeek, clients])

  const filteredExportRows = useMemo(
    () => exportRows.filter((r) => !exportMonth || r.weekStart.slice(0, 7) === exportMonth),
    [exportRows, exportMonth]
  )

  const exportFileBase = `weekly-task-tracker-${exportMonth || new Date().toISOString().slice(0, 10)}`

  const exportCsv = useCallback(() => {
    const escapeCsv = (value) => {
      const str = String(value ?? '')
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
    }
    const header = ['Client', 'Week Start', 'Week Label', 'Project', 'Status', 'Hours', 'Notes', 'Done']
    const lines = [
      header,
      ...filteredExportRows.map((r) => [
        r.client,
        r.weekStart,
        r.weekLabel,
        r.project,
        r.status,
        r.hours,
        r.notes,
        r.done ? 'Yes' : 'No',
      ]),
    ]
    const csv = lines.map((line) => line.map(escapeCsv).join(',')).join('\r\n')
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${exportFileBase}.csv`)
  }, [filteredExportRows, exportFileBase])

  const exportXlsx = useCallback(async () => {
    try {
      downloadBlob(await buildXlsxBlob(filteredExportRows), `${exportFileBase}.xlsx`)
    } catch (err) {
      setGlobalNotice({ type: 'error', text: `Couldn't create the Excel file: ${err.message}` })
    }
  }, [filteredExportRows, exportFileBase])

  const switchScope = (scope) => {
    setViewScope(scope)
    setSelectedWeekId(null)
    setGlobalNotice(null)
  }

  const addWeekLabel = newWeekClientId && !clientId && scopeName ? `Add week for ${scopeName}` : 'Add week'

  if (loading) {
    return (
      <div className="app-shell">
        <div className="loading-state">
          <span className="spinner" aria-hidden="true" />
          <p className="status-text">Loading…</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="app-shell">
        <p className="status-text error-text">Failed to load: {loadError}</p>
      </div>
    )
  }

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="topbar-brand">
            <img className="brand-logo" src="/Logo-1.png" alt="WordOut" />
            <span className="topbar-divider" aria-hidden="true" />
            <div>
              <p className="eyebrow">{clientId ? 'Hours log for' : 'Hours log'}</p>
              <span className="brand-name">{clientName || 'Weekly Task Tracker'}</span>
            </div>
          </div>
          <div className="topbar-actions">
            {!clientId && (
              <ViewSwitcher clients={clients} value={viewScope} onChange={switchScope} />
            )}
            {!clientId && (
              <button className="export-btn" title="Clients" onClick={() => setClientsPanelOpen((v) => !v)}>
                <Users size={18} aria-hidden="true" /> <span className="btn-label">Clients</span>
              </button>
            )}
            {!clientId && (
              <button className="export-btn" title="Weekly report" onClick={() => setReportsPanelOpen((v) => !v)}>
                <Mail size={18} aria-hidden="true" /> <span className="btn-label">Reports</span>
              </button>
            )}
            <input
              type="month"
              className="month-picker"
              aria-label="Filter export by month"
              title="Limit the export to one month"
              value={exportMonth}
              onChange={(e) => setExportMonth(e.target.value)}
            />
            <ExportMenu
              disabled={filteredExportRows.length === 0}
              onExportXlsx={exportXlsx}
              onExportCsv={exportCsv}
            />
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon size={20} aria-hidden="true" /> : <Sun size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      <div className="app-body">
        <WeekNav
          weeks={sortedWeeks}
          weekHoursById={weekHoursById}
          selectedWeekId={selectedWeek?.id ?? null}
          currentWeekStart={currentWeekStart}
          onSelect={setSelectedWeekId}
          clients={clients}
          scopeName={scopeName}
        />

        <main className="app-content">
          {globalNotice && (
            <div className={`banner banner-${globalNotice.type}`}>
              {globalNotice.text}
              <button onClick={() => setGlobalNotice(null)}>Dismiss</button>
            </div>
          )}

          {clientsPanelOpen && !clientId && (
            <ClientsPanel
              clients={clients}
              clientStats={clientStats}
              onAddClient={addClient}
              onDeleteClient={deleteClient}
              onUpdateClientEmail={updateClientEmail}
              onViewClient={(id) => {
                switchScope(id)
                setClientsPanelOpen(false)
              }}
              onClose={() => setClientsPanelOpen(false)}
            />
          )}

          {reportsPanelOpen && !clientId && (
            <ReportsPanel
              weekStart={selectedWeek?.week_start || currentWeekStart}
              onClose={() => setReportsPanelOpen(false)}
            />
          )}

          <StatsBar
            weeksCount={visibleWeeks.length}
            tasksOpen={taskStats.tasksOpen}
            tasksDone={taskStats.tasksDone}
            hoursTotal={grandTotal}
          />

          <Totals projectTotals={projectTotals} grandTotal={grandTotal} />

          {selectedWeek ? (
            <WeekCard
              week={selectedWeek}
              tasks={tasksByWeek.get(selectedWeek.id) || []}
              savingIds={savingIds}
              fieldErrors={fieldErrors}
              onUpdateTaskField={updateTaskField}
              onAddTask={addTask}
              onDeleteTask={deleteTask}
              onUpdateWeekField={updateWeekField}
              onDeleteWeek={deleteWeek}
              onFlushTask={flushTaskSave}
              clients={!clientId ? clients : null}
              onMoveWeek={moveWeek}
              onPrevWeek={olderWeek ? () => setSelectedWeekId(olderWeek.id) : null}
              onNextWeek={newerWeek ? () => setSelectedWeekId(newerWeek.id) : null}
              onToday={currentWeek && currentWeek.id !== selectedWeek.id ? () => setSelectedWeekId(currentWeek.id) : null}
              readOnly={readOnly}
            />
          ) : (
            <div className="week-empty-prompt">
              <p className="eyebrow">Week of</p>
              <h2>{formatWeekStart(currentWeekStart, { year: false })}</h2>
              <p>{readOnly ? 'Nothing logged for this week yet.' : 'No tasks logged yet for this week.'}</p>
              {!readOnly && (
                <button className="add-week-btn" onClick={addWeek}>
                  <Plus size={18} aria-hidden="true" /> {addWeekLabel}
                </button>
              )}
            </div>
          )}

          {selectedWeek && !readOnly && (
            <button className="add-week-btn" onClick={addWeek}>
              <Plus size={18} aria-hidden="true" /> {addWeekLabel}
            </button>
          )}
        </main>
      </div>
    </div>
  )
}
