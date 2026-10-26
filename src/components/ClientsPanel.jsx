import { useMemo, useState } from 'react'
import { formatHours } from '../format'
import { Check, Copy, Eye, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ClientsPanel({
  clients,
  clientStats,
  purchaseTotals,
  onAddClient,
  onDeleteClient,
  onViewClient,
  onUpdateClientEmail,
  onUpdateClientSheetId,
  onUpdateClientSheetTab,
  onClose,
}) {
  const [name, setName] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [search, setSearch] = useState('')

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => c.name.toLowerCase().includes(q))
  }, [clients, search])

  const copyLink = async (id) => {
    const url = `${window.location.origin}${window.location.pathname}?client=${id}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt('Copy this link:', url)
    }
    setCopiedId(id)
    setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 1600)
  }

  const handleAdd = (e) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAddClient(trimmed)
    setName('')
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-label="Clients" className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Clients</DialogTitle>
          <DialogDescription>Click a client's name to view only their weeks.</DialogDescription>
        </DialogHeader>

        <form className="flex gap-2" onSubmit={handleAdd}>
          <Input type="text" placeholder="New client name…" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Button type="submit" variant="secondary">
            <Plus size={18} aria-hidden="true" /> Add
          </Button>
        </form>

        {clients.length > 6 && (
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="text"
              placeholder="Search clients…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              aria-label="Search clients"
            />
          </div>
        )}

        <ul className="-mx-1 flex max-h-[420px] flex-col gap-2.5 overflow-y-auto px-1">
          {filteredClients.map((c) => {
            const stats = clientStats.get(c.id)
            return (
              <li key={c.id} className="rounded-md border border-border/60 bg-muted/60 p-3.5">
                <div className="flex items-start justify-between gap-2.5">
                  <button
                    className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
                    onClick={() => onViewClient(c.id)}
                    title={`View only ${c.name}'s weeks`}
                  >
                    <span className="flex items-center gap-1.5 font-semibold text-foreground">
                      <Eye size={14} aria-hidden="true" />
                      {c.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {stats
                        ? `${formatHours(stats.hoursTotal)} · ${stats.weeksCount} week${stats.weeksCount === 1 ? '' : 's'} · ${stats.tasksOpen} open · ${stats.tasksDone} done`
                        : 'No weeks yet'}
                      {purchaseTotals.get(c.id) > 0 && ` · ${formatHours(purchaseTotals.get(c.id))} bought`}
                    </span>
                  </button>
                  <div className="flex flex-none items-center gap-1.5">
                    <Button
                      variant="secondary"
                      size="icon"
                      className="size-9"
                      aria-label={`Copy link for ${c.name}`}
                      title="Copy shareable link"
                      onClick={() => copyLink(c.id)}
                    >
                      {copiedId === c.id ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="size-9"
                      aria-label={`Delete ${c.name}`}
                      title={`Delete ${c.name}`}
                      onClick={() => onDeleteClient(c.id)}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-col gap-1 border-t border-border/60 pt-3">
                  <Label htmlFor={`email-${c.id}`}>Report email</Label>
                  <Input
                    id={`email-${c.id}`}
                    key={`${c.id}:${c.email || ''}`}
                    type="email"
                    className="h-9"
                    placeholder="None"
                    defaultValue={c.email || ''}
                    onBlur={(e) => {
                      const value = e.target.value.trim()
                      if (value !== (c.email || '')) onUpdateClientEmail(c.id, value)
                    }}
                  />
                </div>

                <div className="mt-2 grid grid-cols-[1fr_110px] gap-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <Label htmlFor={`sheet-${c.id}`}>Google Sheet sync (optional)</Label>
                    <Input
                      id={`sheet-${c.id}`}
                      key={`${c.id}:${c.sheet_id || ''}`}
                      type="text"
                      className="h-9"
                      placeholder="Sheet ID or URL — none"
                      defaultValue={c.sheet_id || ''}
                      onBlur={(e) => {
                        const value = e.target.value.trim()
                        if (value !== (c.sheet_id || '')) onUpdateClientSheetId(c.id, value)
                      }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`sheet-tab-${c.id}`}>Tab name</Label>
                    <Input
                      id={`sheet-tab-${c.id}`}
                      key={`${c.id}:${c.sheet_tab || ''}`}
                      type="text"
                      className="h-9"
                      placeholder="Tracker Sync"
                      defaultValue={c.sheet_tab || ''}
                      onBlur={(e) => {
                        const value = e.target.value.trim()
                        if (value !== (c.sheet_tab || '')) onUpdateClientSheetTab(c.id, value)
                      }}
                    />
                  </div>
                </div>
              </li>
            )
          })}
          {clients.length === 0 && <p className="italic text-muted-foreground">No clients yet.</p>}
          {clients.length > 0 && filteredClients.length === 0 && (
            <p className="italic text-muted-foreground">No clients match "{search}".</p>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
