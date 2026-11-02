import { useState } from 'react'
import { Eye } from 'lucide-react'
import { INTERNAL_SCOPE } from '../scope'
import Tooltip from './Tooltip'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'

// Admin-only. Picks WHICH data you're looking at -- it never changes any
// data. (Moving a week to a different client is a separate, explicit action
// on the week card.)
export default function ViewSwitcher({ clients, value, onChange }) {
  // The tooltip is hover-driven, but the Select trigger it wraps stays
  // hovered while its dropdown is open -- so the tooltip has to be forced
  // shut for as long as the select is open, not just closed once, or a
  // stray hover re-evaluation flips it back on top of the open list.
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const [selectOpen, setSelectOpen] = useState(false)

  return (
    <Tooltip
      placement="bottom"
      text="Changes what you see, not the data. Pick a client, or Internal only, to filter everything on this page down to just them."
      open={selectOpen ? false : tooltipOpen}
      onOpenChange={(open) => !selectOpen && setTooltipOpen(open)}
    >
      <div className="flex h-10 min-w-0 items-center gap-1 rounded-md bg-primary/10 pl-4 pr-1.5 max-sm:w-full">
        <Eye size={18} className="flex-none text-primary" aria-hidden="true" />
        <span className="hidden text-sm font-semibold text-primary sm:inline">Viewing</span>
        <Select
          value={value || 'everything'}
          onValueChange={(v) => onChange(v === 'everything' ? null : v)}
          onOpenChange={setSelectOpen}
        >
          <SelectTrigger className="h-auto min-w-0 max-w-[200px] flex-1 border-none bg-transparent py-1.5 font-semibold text-foreground max-sm:max-w-none">
            <span className="min-w-0 flex-1 truncate text-left">
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="everything">Everything</SelectItem>
            <SelectItem value={INTERNAL_SCOPE}>Internal only</SelectItem>
            {clients.length > 0 && (
              <SelectGroup>
                <SelectLabel>Clients</SelectLabel>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
          </SelectContent>
        </Select>
      </div>
    </Tooltip>
  )
}
