import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Standard shadcn/ui helper: merges conditional class names (clsx) and
// resolves conflicting Tailwind utility classes in favor of the last one
// (tailwind-merge), so a component's default classes can be safely
// overridden by a className prop from the caller.
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
