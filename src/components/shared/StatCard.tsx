import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: { value: number; positive: boolean };
  subtitle?: string;
  className?: string;
  accent?: 'primary' | 'success' | 'warning' | 'destructive' | 'default';
}

const accentClasses = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  default: 'bg-muted text-muted-foreground',
};

export function StatCard({ label, value, icon, trend, subtitle, className, accent = 'default' }: StatCardProps) {
  return (
    <div className={cn('rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {icon && (
          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', accentClasses[accent])}>
            {icon}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight">{value}</span>
        {trend && (
          <span className={cn('text-xs font-medium', trend.positive ? 'text-success' : 'text-destructive')}>
            {trend.positive ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
