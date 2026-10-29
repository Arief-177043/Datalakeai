import { useState, useMemo, useEffect } from 'react';
import { api } from '@/services/api';
import type { ProcessingJob } from '@/types';
import { useAsync } from '@/hooks/use-async';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatNumber, timeAgo, formatDuration } from '@/lib/format';
import {
  Briefcase, Search, MoreVertical, RotateCcw, XCircle, Play, Terminal,
  Zap, CheckCircle2, XCircle as XIcon, Clock, Cpu, Server,
} from 'lucide-react';

const JOB_TYPES: ProcessingJob['type'][] = ['ingestion', 'processing', 'validation', 'export', 'training', 'cleanup'];

export function ProcessingJobs() {
  const { data: jobs, loading, error, refetch } = useAsync(() => api.getJobs());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selected, setSelected] = useState<ProcessingJob | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [liveJobs, setLiveJobs] = useState<ProcessingJob[]>([]);
  useEffect(() => { if (jobs) setLiveJobs(jobs); }, [jobs]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveJobs((prev) => prev.map((j) => {
        if (j.status !== 'running' && j.status !== 'retrying') return j;
        const newProgress = Math.min(99, j.progress + Math.random() * 3);
        return { ...j, progress: newProgress, recordsProcessed: Math.min(j.totalRecords, j.recordsProcessed + Math.floor(Math.random() * 3000)) };
      }));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    let result = liveJobs;
    if (search) result = result.filter((j) => j.name.toLowerCase().includes(search.toLowerCase()) || j.id.includes(search));
    if (statusFilter !== 'all') result = result.filter((j) => j.status === statusFilter);
    if (typeFilter !== 'all') result = result.filter((j) => j.type === typeFilter);
    return [...result].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [liveJobs, search, statusFilter, typeFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const running = liveJobs.filter((j) => j.status === 'running' || j.status === 'retrying').length;
  const completed = liveJobs.filter((j) => j.status === 'completed').length;
  const failed = liveJobs.filter((j) => j.status === 'failed').length;
  const queued = liveJobs.filter((j) => j.status === 'queued').length;

  const handleRetry = async (job: ProcessingJob) => {
    try {
      await api.retryJob(job.id);
      toast.success('Job retrying', { description: `${job.name} (attempt ${job.retryCount + 1}/${job.maxRetries})` });
      refetch();
    } catch { toast.error('Failed to retry job'); }
  };

  const handleCancel = async (job: ProcessingJob) => {
    try {
      await api.cancelJob(job.id);
      toast.success('Job cancelled', { description: job.name });
      refetch();
    } catch { toast.error('Failed to cancel job'); }
  };

  const handleRerun = async (job: ProcessingJob) => {
    try {
      await api.rerunJob(job.id);
      toast.success('Job requeued', { description: job.name });
      refetch();
    } catch { toast.error('Failed to rerun job'); }
  };

  if (loading) return <LoadingState message="Loading jobs..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Processing Jobs"
        description="Monitor, retry, and manage all processing jobs across your data lake"
        icon={<Briefcase className="h-5 w-5" />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Running" value={running} subtitle={`${queued} queued`} icon={<Zap className="h-4 w-4" />} accent="primary" />
        <StatCard label="Completed" value={completed} icon={<CheckCircle2 className="h-4 w-4" />} accent="success" />
        <StatCard label="Failed" value={failed} icon={<XIcon className="h-4 w-4" />} accent={failed > 0 ? 'destructive' : 'default'} />
        <StatCard label="Total" value={liveJobs.length} icon={<Briefcase className="h-4 w-4" />} accent="default" />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search jobs by name or ID..." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="retrying">Retrying</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {JOB_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={<Briefcase className="h-7 w-7" />} title="No jobs found" description="Try adjusting your filters." /></Card>
      ) : (
        <Card>
          <div className="divide-y">
            {paged.map((job) => (
              <div key={job.id} className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/30 cursor-pointer" onClick={() => setSelected(job)}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="truncate text-sm font-medium">{job.name}</span>
                    <StatusBadge status={job.status} />
                    <Badge variant="outline" className="text-[10px] capitalize">{job.type}</Badge>
                    <Badge variant="secondary" className="text-[10px] capitalize">{job.priority}</Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-mono">{job.id}</span>
                    <span className="flex items-center gap-1"><Server className="h-3 w-3" />{job.workerId}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{timeAgo(job.startedAt)}</span>
                    <span>{formatNumber(job.recordsProcessed)} / {formatNumber(job.totalRecords)} records</span>
                  </div>
                  {(job.status === 'running' || job.status === 'retrying') && (
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={job.progress} className="h-1.5 flex-1" />
                      <span className="text-xs font-mono text-primary">{job.progress.toFixed(0)}%</span>
                    </div>
                  )}
                  {job.status === 'completed' && job.durationMs && (
                    <span className="mt-1 block text-xs text-muted-foreground">Completed in {formatDuration(job.durationMs)}</span>
                  )}
                  {job.errorMessage && (
                    <p className="mt-1 text-xs text-destructive truncate">{job.errorMessage}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {(job.status === 'failed' || job.status === 'retrying') && (
                    <Button size="sm" variant="outline" onClick={() => handleRetry(job)}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Retry</Button>
                  )}
                  {(job.status === 'running' || job.status === 'retrying') && (
                    <Button size="sm" variant="outline" onClick={() => handleCancel(job)}><XCircle className="mr-1 h-3.5 w-3.5" /> Cancel</Button>
                  )}
                  {(job.status === 'completed' || job.status === 'cancelled' || job.status === 'failed') && (
                    <Button size="sm" variant="outline" onClick={() => handleRerun(job)}><Play className="mr-1 h-3.5 w-3.5" /> Rerun</Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setSelected(job)}>View Details & Logs</DropdownMenuItem>
                      {job.status !== 'running' && <DropdownMenuItem onClick={() => handleRerun(job)}>Rerun Job</DropdownMenuItem>}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-xs text-muted-foreground">{filtered.length} jobs · Page {page} of {totalPages}</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Job detail dialog */}
      {selected && <JobDetailDialog job={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function JobDetailDialog({ job, onClose }: { job: ProcessingJob; onClose: () => void }) {
  const [tab, setTab] = useState('details');
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="text-lg">{job.name}</DialogTitle>
          <DialogDescription className="font-mono">{job.id}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={job.status} />
          <Badge variant="outline" className="capitalize">{job.type}</Badge>
          <Badge variant="secondary" className="capitalize">{job.priority} priority</Badge>
          <Badge variant="outline">{job.workerId}</Badge>
          {job.retryCount > 0 && <Badge className="bg-warning/10 text-warning">{job.retryCount}/{job.maxRetries} retries</Badge>}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="logs"><Terminal className="mr-1.5 h-3.5 w-3.5" /> Logs ({job.logs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Records</p><p className="text-sm font-bold">{formatNumber(job.recordsProcessed)}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Total</p><p className="text-sm font-bold">{formatNumber(job.totalRecords)}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Started</p><p className="text-sm font-bold">{timeAgo(job.startedAt)}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Duration</p><p className="text-sm font-bold">{job.durationMs ? formatDuration(job.durationMs) : '—'}</p></div>
            </div>

            {(job.status === 'running' || job.status === 'retrying') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Progress</span><span className="font-mono text-primary">{job.progress.toFixed(1)}%</span></div>
                <Progress value={job.progress} className="h-2" />
              </div>
            )}

            {job.errorMessage && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="flex items-center gap-2 text-sm text-destructive font-medium"><XIcon className="h-4 w-4" /> Error</p>
                <p className="mt-1 text-xs text-muted-foreground font-mono">{job.errorMessage}</p>
              </div>
            )}

            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground mb-2">Retry Configuration</p>
              <div className="flex items-center justify-between text-sm">
                <span>Current retries: <span className="font-medium">{job.retryCount}</span></span>
                <span>Max retries: <span className="font-medium">{job.maxRetries}</span></span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <ScrollArea className="h-80 rounded-lg border bg-muted/30">
              <div className="p-3 font-mono text-xs space-y-1">
                {job.logs.map((log) => (
                  <div key={log.id} className="flex gap-2">
                    <span className="text-muted-foreground shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className={`shrink-0 font-bold ${log.level === 'error' ? 'text-destructive' : log.level === 'warn' ? 'text-warning' : log.level === 'debug' ? 'text-muted-foreground' : 'text-primary'}`}>[{log.level.toUpperCase()}]</span>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {(job.status === 'failed' || job.status === 'retrying') && <Button onClick={() => { api.retryJob(job.id); toast.success('Retrying job'); onClose(); }}><RotateCcw className="mr-2 h-4 w-4" /> Retry</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
