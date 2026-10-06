import { useState } from 'react'
import { formatHours } from '../format'
import { Check, Copy, Eye, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export default function ClientsPanel({
  clients,
  clientStats,
  onAddClient,
  onDeleteClient,
  onViewClient,
  onUpdateClientEmail,
  onUpdateClientBudget,
  onClose,
}) {
  const [name, setName] = useState('')
  const [copiedId, setCopiedId] = useState(null)

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

        <ul className="flex flex-col gap-2.5">
          {clients.map((c) => {
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

                <div className="mt-3 grid grid-cols-[1fr_128px] gap-2 border-t border-border/60 pt-3">
                  <div className="flex min-w-0 flex-col gap-1">
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
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`budget-${c.id}`}>Monthly hours</Label>
                    <Input
                      id={`budget-${c.id}`}
                      key={`${c.id}:${c.monthly_hours ?? ''}`}
                      type="number"
                      min="0"
                      max="1000"
                      step="0.5"
                      inputMode="decimal"
                      placeholder="None"
                      className="h-9 text-right"
                      defaultValue={c.monthly_hours ?? ''}
                      onBlur={(e) => {
                        const value = e.target.value.trim()
                        const current = c.monthly_hours ?? ''
                        if (value !== String(current)) onUpdateClientBudget(c.id, value)
                      }}
                    />
                  </div>
                </div>
              </li>
            )
          })}
          {clients.length === 0 && <p className={cn('italic text-muted-foreground')}>No clients yet.</p>}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
