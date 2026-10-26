import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { formatHours, formatWeekStart } from '../format'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import DurationInput from './DurationInput'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

function todayAsDateInput() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Logging a new purchase isn't something you do every visit -- tucked
// behind a dialog (triggered by "+ Add hours") instead of a form that's
// always sitting open, so the card's default state is just the balance.
function AddPurchaseForm({ clientName, onAddPurchase, onDone }) {
  const [purchasedOn, setPurchasedOn] = useState(todayAsDateInput)
  const [hours, setHours] = useState(0)
  const [note, setNote] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!hours || hours <= 0) return
    onAddPurchase({ purchasedOn, hours, note })
    setHours(0)
    setNote('')
    onDone()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Date</span>
        <input
          type="date"
          value={purchasedOn}
          onChange={(e) => setPurchasedOn(e.target.value)}
          className="h-9 rounded-md border border-border bg-transparent px-2.5 text-sm text-foreground outline-none transition-colors hover:border-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Hours</span>
        <DurationInput
          value={hours}
          onCommit={setHours}
          max={1000}
          autoFocus
          ariaLabel={`Hours bought for ${clientName}`}
          className="h-9 rounded-md border border-border bg-transparent px-2.5 text-sm font-medium text-foreground transition-colors hover:border-muted-foreground focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/40"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Note (optional)</span>
        <input
          type="text"
          placeholder="e.g. retainer top-up"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-9 w-full rounded-md border border-border bg-transparent px-2.5 text-sm text-foreground outline-none transition-colors hover:border-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </label>
      <Button type="submit" className="mt-1" disabled={!hours || hours <= 0}>
        <Plus size={16} aria-hidden="true" /> Add hours
      </Button>
    </form>
  )
}

// "Hours bought vs. hours used" for whichever single client is currently in
// view (admin viewing one client, or a client on their own read-only link).
// Hidden entirely in any multi-client view -- a budget only means something
// against one client's purchase history. All-time cumulative, not scoped to
// a calendar month -- matches the real Sheet's own running-balance column.
export default function BudgetCard({ clientName, hoursBought, hoursUsed, purchases, onAddPurchase, onDeletePurchase }) {
  const editable = Boolean(onAddPurchase)
  const [open, setOpen] = useState(false)
  if (!editable && purchases.length === 0) return null

  const over = hoursUsed > hoursBought
  // The bar's own 100% is whichever is bigger -- normally hoursBought, but
  // once over budget the bar has to stretch past its own target to show
  // the overage as a visibly distinct red segment past the blue.
  const domain = Math.max(hoursBought, hoursUsed, 1)
  const withinPct = (Math.min(hoursUsed, hoursBought) / domain) * 100
  const overPct = over ? ((hoursUsed - hoursBought) / domain) * 100 : 0

  return (
    <Card className="mb-4">
      <div className="mb-3.5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium">Retainer balance</h2>
        {editable && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus size={16} aria-hidden="true" /> Add hours
              </Button>
            </DialogTrigger>
            <DialogContent aria-label="Add hours bought" className="max-w-[380px]">
              <DialogHeader>
                <DialogTitle>Add hours bought</DialogTitle>
                <DialogDescription>Log a new hours purchase for {clientName}.</DialogDescription>
              </DialogHeader>
              <AddPurchaseForm clientName={clientName} onAddPurchase={onAddPurchase} onDone={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {hoursBought > 0 ? (
        <>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-foreground">
              {formatHours(hoursUsed)} of {formatHours(hoursBought)} used
            </span>
            {over && (
              <span className="text-sm font-semibold text-destructive">
                {formatHours(hoursUsed - hoursBought)} over
              </span>
            )}
          </div>

          <div
            className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${clientName} has used ${formatHours(hoursUsed)} of ${formatHours(hoursBought)} bought`}
          >
            <div className="h-full bg-primary" style={{ width: `${withinPct}%` }} />
            {overPct > 0 && <div className="h-full bg-destructive" style={{ width: `${overPct}%` }} />}
          </div>

          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 flex-none rounded-full bg-primary" aria-hidden="true" /> Within bought hours
            </span>
            {over && (
              <span className="flex items-center gap-1.5">
                <span className="size-2 flex-none rounded-full bg-destructive" aria-hidden="true" /> Over
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No hours purchased yet{editable ? ' — click "Add hours" to log the first one.' : '.'}
        </p>
      )}

      {purchases.length > 0 && (
        <div className="mt-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Purchases</p>
          <ul className="flex flex-col divide-y divide-border/60">
            {purchases.map((p) => (
              <li key={p.id} className="group flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{formatWeekStart(p.purchased_on)}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.note || 'No note'}</p>
                </div>
                <div className="flex flex-none items-center gap-1">
                  <span className="font-semibold text-foreground">+{formatHours(Number(p.hours))}</span>
                  {editable && (
                    <Button
                      variant="destructive"
                      size="icon"
                      className={cn(
                        'size-8 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 max-sm:opacity-100'
                      )}
                      aria-label="Delete purchase"
                      title="Delete purchase"
                      onClick={() => onDeletePurchase(p.id)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
