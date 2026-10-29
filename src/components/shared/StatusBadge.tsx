import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface StatusBadgeProps {
  status: string;
  className?: string;
  children?: ReactNode;
}

const statusMap: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  active: { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success', label: 'Active' },
  running: { bg: 'bg-primary/10', text: 'text-primary', dot: 'bg-primary', label: 'Running' },
  completed: { bg: 'bg-success/10', text: 'text-success', dot: 'bg-success', label: 'Completed' },
  idle: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground', label: 'Idle' },
  paused: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning', label: 'Paused' },
  pending: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning', label: 'Pending' },
  queued: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground', label: 'Queued' },
  error: { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive', label: 'Error' },
  failed: { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive', label: 'Failed' },
  retrying: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning', label: 'Retrying' },
  cancelled: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground', label: 'Cancelled' },
  archived: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground', label: 'Archived' },
  draft: { bg: 'bg-muted', text: 'text-muted-foreground', dot: 'bg-muted-foreground', label: 'Draft' },
  processing: { bg: 'bg-primary/10', text: 'text-primary', dot: 'bg-primary', label: 'Processing' },
  suspended: { bg: 'bg-destructive/10', text: 'text-destructive', dot: 'bg-destructive', label: 'Suspended' },
  invited: { bg: 'bg-warning/10', text: 'text-warning', dot: 'bg-warning', label: 'Invited' },
};

export function StatusBadge({ status, className, children }: StatusBadgeProps) {
  const config = statusMap[status] ?? statusMap.idle;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', config.bg, config.text, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot, (status === 'running' || status === 'processing' || status === 'retrying') && 'animate-pulse')} />
      {children ?? config.label}
    </span>
  );
}
