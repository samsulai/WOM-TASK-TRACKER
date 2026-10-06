import { ChevronLeft, ChevronRight, Settings2 } from 'lucide-react'
import { formatHours } from '../format'
import Tooltip from './Tooltip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

// Commits a typed number on blur, same as the week date/label fields --
// nothing else in this app asks for an explicit Save, so this doesn't either.
function commitHours(e, current, onUpdateBudget) {
  const value = e.target.value.trim()
  if (value === String(current ?? '')) return
  onUpdateBudget(value)
}

// "Time bought vs. time used" for whichever single client is currently in
// view (admin viewing one client, or a client on their own read-only link).
// Hidden entirely in any multi-client view -- a budget only means something
// against one client's agreed hours.
export default function BudgetCard({
  clientName,
  monthlyHours,
  hoursUsed,
  monthKey,
  isCurrentMonth,
  onPrevMonth,
  onNextMonth,
  onThisMonth,
  onUpdateBudget,
}) {
  const hasBudget = monthlyHours != null
  const editable = Boolean(onUpdateBudget)

  const monthNav = (
    <div className="flex items-center gap-1.5">
      <Button variant="outline" size="icon" className="size-9" aria-label="Previous month" title="Previous month" onClick={onPrevMonth}>
        <ChevronLeft size={18} aria-hidden="true" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="size-9"
        aria-label="Next month"
        title="Next month"
        disabled={isCurrentMonth}
        onClick={onNextMonth}
      >
        <ChevronRight size={18} aria-hidden="true" />
      </Button>
      {!isCurrentMonth && (
        <Button variant="outline" className="h-9" onClick={onThisMonth}>
          This month
        </Button>
      )}
    </div>
  )

  if (!hasBudget) {
    if (!editable) return null
    return (
      <Card className="mb-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{monthLabel(monthKey)}</p>
            <h2 className="text-lg font-medium">Hours budget</h2>
          </div>
          {monthNav}
        </div>
        <label className="block">
          <span className="mb-2.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Settings2 size={14} className="flex-none" aria-hidden="true" />
            Set a monthly hours budget for {clientName}, to track time bought vs. time used
          </span>
          <span className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              max="1000"
              step="0.5"
              inputMode="decimal"
              placeholder="e.g. 20"
              autoComplete="off"
              onBlur={(e) => commitHours(e, '', onUpdateBudget)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="w-[90px] rounded-md border border-border bg-transparent px-2.5 py-2 text-base font-semibold text-foreground outline-none transition-colors hover:border-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <span className="text-sm text-muted-foreground">hrs / month</span>
          </span>
        </label>
      </Card>
    )
  }

  const over = hoursUsed > monthlyHours
  const remaining = monthlyHours - hoursUsed
  const pct = monthlyHours > 0 ? Math.min(100, (hoursUsed / monthlyHours) * 100) : hoursUsed > 0 ? 100 : 0

  return (
    <Card className="mb-4">
      <div className="mb-1 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{monthLabel(monthKey)}</p>
          <h2 className="text-lg font-medium">Hours budget</h2>
        </div>
        {monthNav}
      </div>

      <div className="my-3.5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className={`text-[2.3rem] font-medium leading-none ${over ? 'text-destructive' : 'text-primary'}`}>
            {formatHours(hoursUsed)}
          </span>
          <span className="block text-xs font-medium text-muted-foreground">
            used of{' '}
            {editable ? (
              <Tooltip text="Click to change this client's monthly hours budget.">
                <input
                  key={monthlyHours}
                  type="number"
                  min="0"
                  max="1000"
                  step="0.5"
                  inputMode="decimal"
                  aria-label={`Monthly hours bought for ${clientName}`}
                  defaultValue={monthlyHours}
                  onBlur={(e) => commitHours(e, monthlyHours, onUpdateBudget)}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  className="w-[5.5ch] border-0 border-b border-dashed border-muted-foreground bg-transparent p-0 text-xs font-medium text-inherit outline-none hover:border-solid hover:border-primary focus-visible:border-solid focus-visible:border-primary"
                />
              </Tooltip>
            ) : (
              monthlyHours
            )}{' '}
            hrs bought
          </span>
        </div>
        <Badge variant={over ? 'destructive' : 'default'}>{over ? 'Over budget' : 'On track'}</Badge>
      </div>

      <Progress
        value={pct}
        indicatorClassName={over ? 'bg-destructive' : undefined}
        aria-label={`${clientName} hours used this month`}
      />

      <p className={`mt-2 text-sm ${over ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
        {over ? `${formatHours(-remaining)} over budget` : `${formatHours(remaining)} remaining`}
      </p>
    </Card>
  )
}
