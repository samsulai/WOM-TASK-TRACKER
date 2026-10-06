import { cn } from '@/lib/utils'

function Card({ className, ...props }) {
  return (
    <div
      data-slot="card"
      className={cn('rounded-lg border border-border bg-card text-card-foreground p-6', className)}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex items-start justify-between gap-4', className)}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }) {
  return <h2 data-slot="card-title" className={cn('text-lg font-semibold leading-none', className)} {...props} />
}

function CardDescription({ className, ...props }) {
  return <p data-slot="card-description" className={cn('text-sm text-muted-foreground', className)} {...props} />
}

function CardContent({ className, ...props }) {
  return <div data-slot="card-content" className={cn(className)} {...props} />
}

export { Card, CardContent, CardDescription, CardHeader, CardTitle }
