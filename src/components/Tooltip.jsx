import { Tooltip as UiTooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// Thin wrapper around the shadcn/Radix tooltip, keeping the simple API the
// rest of this app already uses (`text`, `children`, `placement`) so call
// sites didn't need to change when the implementation moved to Radix.
export default function Tooltip({ text, children, placement = 'top', className = '' }) {
  return (
    <UiTooltip>
      <TooltipTrigger asChild className={className || undefined}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={placement}>{text}</TooltipContent>
    </UiTooltip>
  )
}
