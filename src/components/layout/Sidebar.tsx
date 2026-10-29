import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, NAV_GROUPS } from '@/config/navigation';
import { Database, ChevronLeft, ChevronRight } from 'lucide-react';
import type { NavItem } from '@/config/navigation';

interface SidebarProps {
  active: string;
  onNavigate: (id: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function Sidebar({ active, onNavigate, collapsed, onToggleCollapse, searchQuery, onSearchChange }: SidebarProps) {
  const [localSearch, setLocalSearch] = useState('');

  const filteredItems = useMemo(() => {
    if (!localSearch) return NAV_ITEMS;
    const q = localSearch.toLowerCase();
    return NAV_ITEMS.filter((item) => item.label.toLowerCase().includes(q));
  }, [localSearch]);

  return (
    <aside className={cn(
      'flex flex-col border-r bg-card transition-all duration-300 ease-in-out',
      collapsed ? 'w-16' : 'w-60',
    )}>
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Database className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-bold leading-tight">DataLake</span>
            <span className="text-[10px] text-muted-foreground leading-tight">AI Training Platform</span>
          </div>
        )}
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="p-3">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            <input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search navigation..."
              className="h-8 w-full rounded-md border border-input bg-transparent pl-8 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-4">
        {NAV_GROUPS.map((group) => {
          const items = filteredItems.filter((i) => i.group === group.id);
          if (items.length === 0) return null;
          return (
            <div key={group.id} className="mb-4">
              {!collapsed && (
                <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavButton
                    key={item.id}
                    item={item}
                    active={active === item.id}
                    collapsed={collapsed}
                    onClick={() => onNavigate(item.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t p-2">
        <button
          onClick={onToggleCollapse}
          className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <><ChevronLeft className="h-4 w-4" /> Collapse</>}
        </button>
      </div>
    </aside>
  );
}

function NavButton({ item, active, collapsed, onClick }: { item: NavItem; active: boolean; collapsed: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all relative group',
        active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        collapsed && 'justify-center',
      )}
      title={collapsed ? item.label : undefined}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {collapsed && (
        <span className="absolute left-full ml-2 z-50 hidden group-hover:flex items-center rounded-md border bg-popover px-2 py-1.5 text-xs whitespace-nowrap shadow-md">
          {item.label}
        </span>
      )}
    </button>
  );
}
