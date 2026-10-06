import { Eye } from 'lucide-react'
import { INTERNAL_SCOPE } from '../scope'
import Tooltip from './Tooltip'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'

// Admin-only. Picks WHICH data you're looking at -- it never changes any
// data. (Moving a week to a different client is a separate, explicit action
// on the week card.)
export default function ViewSwitcher({ clients, value, onChange }) {
  return (
    <Tooltip
      placement="bottom"
      text="Changes what you see, not the data. Pick a client, or Internal only, to filter everything on this page down to just them."
    >
      <div className="flex h-10 items-center gap-1 rounded-md bg-primary/10 pl-4 pr-1.5 max-sm:w-full">
        <Eye size={18} className="flex-none text-primary" aria-hidden="true" />
        <span className="hidden text-sm font-semibold text-primary sm:inline">Viewing</span>
        <Select value={value || 'everything'} onValueChange={(v) => onChange(v === 'everything' ? null : v)}>
          <SelectTrigger className="h-auto max-w-[200px] flex-1 border-none bg-transparent py-1.5 font-semibold text-foreground max-sm:max-w-none">
            <SelectValue />
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
