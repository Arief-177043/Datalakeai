import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Search, X } from 'lucide-react';

interface GlobalSearchProps {
  onResultSelect: (pageId: string) => void;
  datasets: { id: string; name: string; description: string }[];
}

const PAGE_OPTIONS = [
  { id: 'dashboard', label: 'Dashboard', keywords: 'overview home stats' },
  { id: 'datasets', label: 'Dataset Management', keywords: 'datasets create upload manage' },
  { id: 'ingestion', label: 'Data Ingestion', keywords: 'ingest kafka s3 api upload pipeline' },
  { id: 'processing', label: 'Data Processing', keywords: 'process clean transform deduplicate normalize augment' },
  { id: 'quality', label: 'Data Quality', keywords: 'quality validation score completeness outliers' },
  { id: 'versioning', label: 'Dataset Versioning', keywords: 'version history compare restore' },
  { id: 'lineage', label: 'Data Lineage', keywords: 'lineage graph flow source training' },
  { id: 'storage', label: 'Storage Explorer', keywords: 'storage s3 files folders browse' },
  { id: 'jobs', label: 'Processing Jobs', keywords: 'jobs tasks workers queue retry' },
  { id: 'monitoring', label: 'Monitoring', keywords: 'monitor cpu memory network metrics' },
  { id: 'access', label: 'Access Control', keywords: 'access users roles permissions' },
  { id: 'settings', label: 'Settings', keywords: 'settings config preferences' },
];

export function GlobalSearch({ onResultSelect, datasets }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const results = (() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const pageMatches = PAGE_OPTIONS
      .filter((p) => p.label.toLowerCase().includes(q) || p.keywords.includes(q))
      .map((p) => ({ type: 'page' as const, id: p.id, label: p.label, sub: 'Page' }));
    const dsMatches = datasets
      .filter((d) => d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q))
      .slice(0, 5)
      .map((d) => ({ type: 'dataset' as const, id: 'datasets', label: d.name, sub: 'Dataset' }));
    return [...pageMatches, ...dsMatches].slice(0, 8);
  })();

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      onResultSelect(results[activeIndex].id);
      setQuery('');
      setOpen(false);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search pages, datasets... (Ctrl+K)"
          className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-8 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        {query && (
          <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md animate-fade-in">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => { onResultSelect(r.id); setQuery(''); setOpen(false); }}
              className={cn(
                'flex w-full items-center justify-between px-3 py-2 text-sm transition-colors',
                i === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
              )}
            >
              <span className="font-medium">{r.label}</span>
              <span className="text-xs text-muted-foreground">{r.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
