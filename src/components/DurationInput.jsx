import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { hmToHours, hoursToHM } from '../duration'
import { cn } from '@/lib/utils'

const NUMBER_FIELD = cn(
  'h-auto w-9 border-none bg-transparent p-0 text-center [appearance:textfield]',
  '[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
)

// An hours+minutes input -- two plain number fields, no colon-formatted
// text to type or parse. Friendlier than a single HH:MM:SS field: no
// format to remember, and seconds are dropped entirely since every real
// duration this app has seen (Slack logs, the Sheet) always uses :00
// seconds anyway. Each field keeps its own local `draft` while focused (so
// typing isn't fought/reformatted mid-keystroke), commits on blur as
// decimal hours via `onCommit`, and reads the OTHER field's current draft
// (if mid-edit) rather than its last-committed value, so tabbing from one
// field to the other doesn't clobber what was just typed into it.
export default function DurationInput({ value, onCommit, disabled, ariaLabel, max, autoFocus, className }) {
  const [hDraft, setHDraft] = useState(null)
  const [mDraft, setMDraft] = useState(null)
  const { h, m } = hoursToHM(value)
  const displayH = hDraft !== null ? hDraft : String(h)
  const displayM = mDraft !== null ? mDraft : String(m).padStart(2, '0')

  const commit = (hInput, mInput) => {
    const hours = hmToHours(hInput, Math.max(0, Math.min(59, Number(mInput) || 0)))
    onCommit(typeof max === 'number' ? Math.min(hours, max) : hours)
  }

  const preventSubmitOnEnter = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        placeholder="0"
        aria-label={ariaLabel ? `${ariaLabel} (hours)` : 'Hours'}
        disabled={disabled}
        autoFocus={autoFocus}
        value={displayH}
        onFocus={() => setHDraft(String(h))}
        onChange={(e) => setHDraft(e.target.value)}
        onBlur={() => {
          if (hDraft !== null) commit(hDraft, mDraft !== null ? mDraft : m)
          setHDraft(null)
        }}
        onKeyDown={preventSubmitOnEnter}
        className={NUMBER_FIELD}
      />
      <span className="text-xs text-muted-foreground">h</span>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        max={59}
        placeholder="00"
        aria-label={ariaLabel ? `${ariaLabel} (minutes)` : 'Minutes'}
        disabled={disabled}
        value={displayM}
        onFocus={() => setMDraft(String(m))}
        onChange={(e) => setMDraft(e.target.value)}
        onBlur={() => {
          if (mDraft !== null) commit(hDraft !== null ? hDraft : h, mDraft)
          setMDraft(null)
        }}
        onKeyDown={preventSubmitOnEnter}
        className={NUMBER_FIELD}
      />
      <span className="text-xs text-muted-foreground">m</span>
    </div>
  )
}
