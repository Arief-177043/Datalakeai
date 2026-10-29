import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import type { IngestionSource } from '@/types';
import { useAsync } from '@/hooks/use-async';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Sparkline } from '@/components/shared/Sparkline';
import { LoadingState, ErrorState, EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { formatNumber, timeAgo } from '@/lib/format';
import {
  Download, Plus, MoreVertical, Trash2, Play, Pause, RefreshCw,
  Database, Cloud, Radio, FileUp, Server, Activity, AlertCircle,
  Terminal, Zap,
} from 'lucide-react';

const SOURCE_ICONS: Record<IngestionSource['type'], typeof Download> = {
  s3: Cloud, kafka: Radio, api: Server, local: FileUp, database: Database,
};

const SOURCE_TYPES: IngestionSource['type'][] = ['s3', 'kafka', 'api', 'local', 'database'];

export function DataIngestion() {
  const { data: sources, loading, error, refetch } = useAsync(() => api.getIngestionSources());
  const { data: datasets } = useAsync(() => api.getDatasets());
  const [selected, setSelected] = useState<IngestionSource | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<IngestionSource | null>(null);

  // Live throughput simulation
  const [liveSources, setLiveSources] = useState<IngestionSource[]>([]);
  useEffect(() => { if (sources) setLiveSources(sources); }, [sources]);
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveSources((prev) => prev.map((s) => {
        if (s.status !== 'running') return s;
        const newProcessed = Math.min(s.totalRecords, s.recordsProcessed + Math.floor(s.throughputRps * 2));
        return { ...s, recordsProcessed: newProcessed, throughputRps: Math.max(100, s.throughputRps + Math.floor((Math.random() - 0.5) * 500)) };
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const running = liveSources.filter((s) => s.status === 'running').length;
  const totalProcessed = liveSources.reduce((a, s) => a + s.recordsProcessed, 0);
  const totalThroughput = liveSources.filter((s) => s.status === 'running').reduce((a, s) => a + s.throughputRps, 0);
  const totalFailures = liveSources.reduce((a, s) => a + s.failureCount, 0);

  const handleToggle = async (src: IngestionSource) => {
    try {
      await api.toggleIngestion(src.id);
      refetch();
      toast.success(src.status === 'running' ? 'Ingestion paused' : 'Ingestion resumed', { description: src.name });
    } catch { toast.error('Failed to toggle ingestion'); }
  };

  const handleRetry = async (src: IngestionSource) => {
    try {
      await api.retryIngestion(src.id);
      refetch();
      toast.success('Ingestion retrying', { description: `Resuming from last checkpoint for ${src.name}` });
    } catch { toast.error('Failed to retry ingestion'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.deleteIngestionSource(deleteTarget.id);
    toast.success('Source deleted', { description: deleteTarget.name });
    setDeleteTarget(null);
    refetch();
  };

  if (loading) return <LoadingState message="Loading ingestion sources..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Data Ingestion"
        description="Manage data sources, monitor ingestion pipelines, and track throughput"
        icon={<Download className="h-5 w-5" />}
        actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Source</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active Sources" value={running} subtitle={`${liveSources.length} total`} icon={<Activity className="h-4 w-4" />} accent="primary" />
        <StatCard label="Records Processed" value={formatNumber(totalProcessed)} subtitle="All sources" icon={<Zap className="h-4 w-4" />} accent="success" />
        <StatCard label="Throughput" value={`${formatNumber(totalThroughput)}/s`} subtitle="Records per second" icon={<Activity className="h-4 w-4" />} accent="primary" />
        <StatCard label="Failures" value={totalFailures} subtitle="Total across sources" icon={<AlertCircle className="h-4 w-4" />} accent={totalFailures > 10 ? 'destructive' : 'warning'} />
      </div>

      {liveSources.length === 0 ? (
        <Card><EmptyState icon={<Download className="h-7 w-7" />} title="No ingestion sources" description="Create a new data source to start ingesting data into your data lake." action={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Source</Button>} /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {liveSources.map((src) => {
            const Icon = SOURCE_ICONS[src.type];
            const progress = (src.recordsProcessed / src.totalRecords) * 100;
            const ds = datasets?.find((d) => d.id === src.datasetId);
            return (
              <Card key={src.id} className="cursor-pointer transition-all hover:shadow-md" onClick={() => setSelected(src)}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{src.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StatusBadge status={src.status} />
                        <Badge variant="outline" className="text-[10px] uppercase">{src.mode}</Badge>
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggle(src); }}>
                        {src.status === 'running' ? <><Pause className="mr-2 h-3.5 w-3.5" /> Pause</> : <><Play className="mr-2 h-3.5 w-3.5" /> Resume</>}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRetry(src); }}><RefreshCw className="mr-2 h-3.5 w-3.5" /> Retry</DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelected(src); }}>View Details</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(src); }}><Trash2 className="mr-2 h-3.5 w-3.5" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{ds?.name ?? 'Unknown dataset'}</span>
                      <span className="font-mono text-xs">{formatNumber(src.recordsProcessed)} / {formatNumber(src.totalRecords)}</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Throughput</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-primary">{formatNumber(src.throughputRps)} rps</span>
                        {src.status === 'running' && <Sparkline data={Array.from({ length: 12 }, () => src.throughputRps + (Math.random() - 0.5) * 500)} width={50} height={16} />}
                      </div>
                    </div>
                    {src.failureCount > 0 && (
                      <div className="flex items-center gap-2 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3" /> {src.failureCount} failures
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Started {timeAgo(src.startedAt)}</span>
                      <span>{progress.toFixed(1)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      {selected && <IngestionDetailDialog source={selected} onClose={() => setSelected(null)} />}

      {/* Create Dialog */}
      {createOpen && <CreateSourceDialog datasets={datasets ?? []} onClose={() => setCreateOpen(false)} onCreated={() => { refetch(); setCreateOpen(false); }} />}

      {/* Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete ingestion source?</AlertDialogTitle>
            <AlertDialogDescription>This will remove "{deleteTarget?.name}". Ingestion will stop immediately.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function IngestionDetailDialog({ source, onClose }: { source: IngestionSource; onClose: () => void }) {
  const [tab, setTab] = useState('details');
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>{source.name}</DialogTitle>
          <DialogDescription>Source type: {source.type.toUpperCase()} · Mode: {source.mode}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <StatusBadge status={source.status} />
          <Badge variant="outline">{source.mode}</Badge>
          {source.lastError && <Badge variant="destructive" className="text-xs">Error</Badge>}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="logs"><Terminal className="mr-1.5 h-3.5 w-3.5" /> Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Records Processed</p><p className="text-lg font-bold">{formatNumber(source.recordsProcessed)}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total Records</p><p className="text-lg font-bold">{formatNumber(source.totalRecords)}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Throughput</p><p className="text-lg font-bold">{formatNumber(source.throughputRps)} rps</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Failures</p><p className={`text-lg font-bold ${source.failureCount > 0 ? 'text-destructive' : ''}`}>{source.failureCount}</p></div>
            </div>
            <Progress value={(source.recordsProcessed / source.totalRecords) * 100} className="h-2" />
            {source.lastError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <div className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> Last Error</div>
                <p className="mt-1 text-xs text-muted-foreground">{source.lastError}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="config">
            <div className="space-y-2">
              {Object.entries(source.config).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between rounded-lg border p-2.5">
                  <span className="text-sm font-mono text-muted-foreground">{key}</span>
                  <span className="text-sm font-mono">{val}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <ScrollArea className="h-72 rounded-lg border bg-muted/30">
              <div className="p-3 font-mono text-xs space-y-1">
                {source.logs.map((log) => (
                  <div key={log.id} className="flex gap-2">
                    <span className="text-muted-foreground shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className={`shrink-0 font-bold ${log.level === 'error' ? 'text-destructive' : log.level === 'warn' ? 'text-warning' : 'text-primary'}`}>[{log.level.toUpperCase()}]</span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateSourceDialog({ datasets, onClose, onCreated }: { datasets: { id: string; name: string }[]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<IngestionSource['type']>('s3');
  const [mode, setMode] = useState<IngestionSource['mode']>('batch');
  const [datasetId, setDatasetId] = useState(datasets[0]?.id ?? '');
  const [configStr, setConfigStr] = useState('{\n  "bucket": "raw-data-lake",\n  "region": "us-east-1"\n}');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Source name is required'); return; }
    setSaving(true);
    let config: Record<string, string> = {};
    try { config = JSON.parse(configStr); } catch { /* ignore */ }
    try {
      await api.createIngestionSource({ name, type, mode, datasetId, config });
      toast.success('Ingestion source created', { description: `${name} is now ${mode === 'streaming' ? 'streaming' : 'batch ingesting'}` });
      onCreated();
    } catch { toast.error('Failed to create source'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create Ingestion Source</DialogTitle><DialogDescription>Configure a new data source for ingestion</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Source Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. S3-Production-Stream" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Source Type</Label><Select value={type} onValueChange={(v) => setType(v as IngestionSource['type'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SOURCE_TYPES.map((t) => <SelectItem key={t} value={t} className="uppercase">{t}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Mode</Label><Select value={mode} onValueChange={(v) => setMode(v as IngestionSource['mode'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="batch">Batch</SelectItem><SelectItem value="streaming">Streaming</SelectItem></SelectContent></Select></div>
          </div>
          <div className="space-y-2"><Label>Target Dataset</Label><Select value={datasetId} onValueChange={setDatasetId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{datasets.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Configuration (JSON)</Label><textarea value={configStr} onChange={(e) => setConfigStr(e.target.value)} className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create Source'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
