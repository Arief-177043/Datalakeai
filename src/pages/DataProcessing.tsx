import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import type { ProcessingStep, Dataset } from '@/types';
import { useAsync } from '@/hooks/use-async';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
import { formatNumber, timeAgo, formatDuration } from '@/lib/format';
import {
  Cpu, Plus, Play, Trash2, MoreVertical, Sparkles, Copy, GitMerge,
  Columns3, Scale, Wand2, CheckCircle2, XCircle, Clock,
} from 'lucide-react';

const PROCESS_TYPES: { type: ProcessingStep['type']; label: string; icon: typeof Cpu; desc: string }[] = [
  { type: 'cleaning', label: 'Cleaning', icon: Sparkles, desc: 'Remove nulls, fix encoding, trim whitespace' },
  { type: 'deduplication', label: 'Deduplication', icon: Copy, desc: 'Identify and remove duplicate records' },
  { type: 'transformation', label: 'Transformation', icon: Wand2, desc: 'Apply custom transformations to fields' },
  { type: 'partitioning', label: 'Partitioning', icon: Columns3, desc: 'Split data into optimized partitions' },
  { type: 'normalization', label: 'Normalization', icon: Scale, desc: 'Normalize numeric ranges to [0,1] or z-score' },
  { type: 'augmentation', label: 'Augmentation', icon: GitMerge, desc: 'Generate synthetic samples for training' },
];

export function DataProcessing() {
  const { data: steps, loading, error, refetch } = useAsync(() => api.getProcessingSteps());
  const { data: datasets } = useAsync(() => api.getDatasets());
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProcessingStep | null>(null);
  const [activeType, setActiveType] = useState<string>('all');

  const [liveSteps, setLiveSteps] = useState<ProcessingStep[]>([]);
  useEffect(() => { if (steps) setLiveSteps(steps); }, [steps]);
  useEffect(() => {
    const interval = setInterval(() => {
      setLiveSteps((prev) => prev.map((s) => {
        if (s.status !== 'running') return s;
        const newProgress = Math.min(99, s.progress + Math.random() * 5);
        return { ...s, progress: newProgress, recordsAffected: s.recordsAffected + Math.floor(Math.random() * 5000) };
      }));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const filtered = activeType === 'all' ? liveSteps : liveSteps.filter((s) => s.type === activeType);
  const running = liveSteps.filter((s) => s.status === 'running').length;
  const completed = liveSteps.filter((s) => s.status === 'completed').length;
  const failed = liveSteps.filter((s) => s.status === 'failed').length;

  const handleRun = async (step: ProcessingStep) => {
    try {
      await api.runProcessingStep(step.id);
      refetch();
      toast.success('Processing started', { description: step.name });
    } catch { toast.error('Failed to start processing'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.deleteProcessingStep(deleteTarget.id);
    toast.success('Step deleted', { description: deleteTarget.name });
    setDeleteTarget(null);
    refetch();
  };

  if (loading) return <LoadingState message="Loading processing steps..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Data Processing"
        description="Clean, transform, and prepare your datasets for AI training"
        icon={<Cpu className="h-5 w-5" />}
        actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Step</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Running Steps" value={running} icon={<Play className="h-4 w-4" />} accent="primary" />
        <StatCard label="Completed" value={completed} icon={<CheckCircle2 className="h-4 w-4" />} accent="success" />
        <StatCard label="Failed" value={failed} icon={<XCircle className="h-4 w-4" />} accent={failed > 0 ? 'destructive' : 'default'} />
        <StatCard label="Total Steps" value={liveSteps.length} icon={<Cpu className="h-4 w-4" />} accent="default" />
      </div>

      {/* Processing type cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PROCESS_TYPES.map((pt) => {
          const Icon = pt.icon;
          const count = liveSteps.filter((s) => s.type === pt.type).length;
          return (
            <Card key={pt.type} className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50" onClick={() => setActiveType(pt.type)}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{pt.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{pt.desc}</p>
                </div>
                <Badge variant="secondary">{count}</Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {activeType !== 'all' && (
        <div className="flex items-center gap-2">
          <Badge variant="default">{activeType}</Badge>
          <Button variant="ghost" size="sm" onClick={() => setActiveType('all')}>Clear filter</Button>
        </div>
      )}

      {/* Steps list */}
      {filtered.length === 0 ? (
        <Card><EmptyState icon={<Cpu className="h-7 w-7" />} title="No processing steps" description="Create a processing step to start cleaning and transforming your data." action={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Step</Button>} /></Card>
      ) : (
        <Card>
          <div className="divide-y">
            {filtered.map((step) => {
              const ds = datasets?.find((d) => d.id === step.datasetId);
              const pt = PROCESS_TYPES.find((p) => p.type === step.type);
              const Icon = pt?.icon ?? Cpu;
              return (
                <div key={step.id} className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/30">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{step.name}</p>
                      <StatusBadge status={step.status} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{ds?.name ?? 'Unknown'} · {formatNumber(step.recordsAffected)} records affected</p>
                    {step.status === 'running' && (
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={step.progress} className="h-1.5 flex-1" />
                        <span className="text-xs font-mono text-primary">{step.progress.toFixed(0)}%</span>
                      </div>
                    )}
                    {step.status === 'completed' && step.durationMs && (
                      <p className="mt-1 text-xs text-muted-foreground">Completed in {formatDuration(step.durationMs)} · {formatNumber(step.outputRows ?? 0)} output rows</p>
                    )}
                    {step.status === 'failed' && (
                      <p className="mt-1 text-xs text-destructive">Processing failed</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {step.status === 'pending' && <Button size="sm" variant="outline" onClick={() => handleRun(step)}><Play className="mr-1 h-3.5 w-3.5" /> Run</Button>}
                    {step.status === 'completed' && <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(step.completedAt ?? step.startedAt ?? '')}</span>}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {step.status !== 'running' && <DropdownMenuItem onClick={() => handleRun(step)}><Play className="mr-2 h-3.5 w-3.5" /> Run</DropdownMenuItem>}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(step)}><Trash2 className="mr-2 h-3.5 w-3.5" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Create dialog */}
      {createOpen && <CreateStepDialog datasets={datasets ?? []} onClose={() => setCreateOpen(false)} onCreated={() => { refetch(); setCreateOpen(false); }} />}

      {/* Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete processing step?</AlertDialogTitle><AlertDialogDescription>This will remove "{deleteTarget?.name}". This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreateStepDialog({ datasets, onClose, onCreated }: { datasets: Dataset[]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ProcessingStep['type']>('cleaning');
  const [datasetId, setDatasetId] = useState(datasets[0]?.id ?? '');
  const [configStr, setConfigStr] = useState('{\n  "strategy": "mean",\n  "threshold": "0.05"\n}');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Step name is required'); return; }
    setSaving(true);
    let config: Record<string, string> = {};
    try { config = JSON.parse(configStr); } catch { /* ignore */ }
    try {
      const step = await api.createProcessingStep({ name, type, datasetId, config });
      await api.runProcessingStep(step.id);
      toast.success('Processing step created and started', { description: name });
      onCreated();
    } catch { toast.error('Failed to create step'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create Processing Step</DialogTitle><DialogDescription>Configure a data processing operation</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Step Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Clean-Customer-Data" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Processing Type</Label><Select value={type} onValueChange={(v) => setType(v as ProcessingStep['type'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PROCESS_TYPES.map((p) => <SelectItem key={p.type} value={p.type}>{p.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Dataset</Label><Select value={datasetId} onValueChange={setDatasetId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{datasets.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-2"><Label>Configuration (JSON)</Label><textarea value={configStr} onChange={(e) => setConfigStr(e.target.value)} className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create & Run'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
