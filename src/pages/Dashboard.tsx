import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import type { Dataset, MonitoringMetrics, ProcessingJob, Notification, DataDriftReport } from '@/types';
import { useAsync } from '@/hooks/use-async';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { ScoreRing } from '@/components/shared/ScoreRing';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Sparkline } from '@/components/shared/Sparkline';
import { LoadingState, ErrorState } from '@/components/shared/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatBytes, formatNumber, timeAgo, scoreColor } from '@/lib/format';
import {
  Database, HardDrive, Cpu, Activity, AlertTriangle, TrendingUp,
  CheckCircle2, Zap, ArrowRight, Layers, Gauge,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts';

const PIE_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

interface DashboardProps {
  onNavigate: (id: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { data: datasets, loading: dsLoading, error: dsError, refetch: refetchDs } = useAsync(() => api.getDatasets());
  const { data: metrics, loading: mLoading } = useAsync(() => api.getMetrics());
  const { data: jobs } = useAsync(() => api.getJobs());
  const { data: drift } = useAsync(() => api.getDriftReports());

  const [liveMetrics, setLiveMetrics] = useState<MonitoringMetrics | undefined>(metrics);

  useEffect(() => {
    setLiveMetrics(metrics);
  }, [metrics]);

  useEffect(() => {
    const interval = setInterval(() => {
      api.refreshMetrics().then(setLiveMetrics);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  if (dsLoading || mLoading) return <LoadingState message="Loading dashboard..." />;
  if (dsError) return <ErrorState message={dsError} onRetry={refetchDs} />;

  const activeDatasets = datasets?.filter((d) => d.status === 'active') ?? [];
  const totalRecords = datasets?.reduce((a, d) => a + d.recordCount, 0) ?? 0;
  const totalSize = datasets?.reduce((a, d) => a + d.sizeBytes, 0) ?? 0;
  const avgHealth = datasets && datasets.length > 0 ? Math.round(datasets.reduce((a, d) => a + d.healthScore, 0) / datasets.length) : 0;
  const avgReadiness = datasets && datasets.length > 0 ? Math.round(datasets.reduce((a, d) => a + d.trainingReadiness, 0) / datasets.length) : 0;
  const runningJobs = jobs?.filter((j) => j.status === 'running' || j.status === 'retrying') ?? [];
  const failedJobs = jobs?.filter((j) => j.status === 'failed') ?? [];
  const driftDetected = drift?.filter((d) => d.driftDetected) ?? [];

  const storageData = (liveMetrics?.storageHistory ?? []).map((p) => ({ time: new Date(p.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }), value: p.value }));
  const throughputData = (liveMetrics?.throughputHistory ?? []).map((p) => ({ time: new Date(p.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }), value: p.value }));
  const cpuData = (liveMetrics?.cpuHistory ?? []).map((p) => ({ time: new Date(p.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }), cpu: p.value }));

  const formatDistribution = (() => {
    const counts: Record<string, number> = {};
    datasets?.forEach((d) => { counts[d.format] = (counts[d.format] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  })();

  const topDatasets = [...(datasets ?? [])].sort((a, b) => b.recordCount - a.recordCount).slice(0, 5);
  const recentJobs = [...(jobs ?? [])].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, 6);

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dashboard"
        description="Real-time overview of your distributed data lake for AI training datasets"
        icon={<LayoutDashboardIcon />}
        actions={
          <Button variant="outline" size="sm" onClick={() => onNavigate('monitoring')}>
            <Activity className="mr-2 h-4 w-4" /> View Metrics
          </Button>
        }
      />

      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active Datasets" value={activeDatasets.length} subtitle={`${datasets?.length ?? 0} total`} icon={<Database className="h-4 w-4" />} accent="primary" trend={{ value: 12, positive: true }} />
        <StatCard label="Total Records" value={formatNumber(totalRecords)} subtitle={formatBytes(totalSize)} icon={<Layers className="h-4 w-4" />} accent="success" trend={{ value: 8, positive: true }} />
        <StatCard label="Running Jobs" value={runningJobs.length} subtitle={`${failedJobs.length} failed today`} icon={<Zap className="h-4 w-4" />} accent="warning" />
        <StatCard label="Avg Training Readiness" value={`${avgReadiness}%`} subtitle={`${driftDetected.length} drift alerts`} icon={<Gauge className="h-4 w-4" />} accent={avgReadiness >= 70 ? 'success' : 'warning'} />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Throughput chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-base">Processing Throughput</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Records per second over last 2 hours</p>
            </div>
            <Badge variant="secondary" className="gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live
            </Badge>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={throughputData}>
                <defs>
                  <linearGradient id="throughputGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#throughputGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Dataset health rings */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Platform Health</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Aggregate scores</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-around">
              <div className="flex flex-col items-center gap-2">
                <ScoreRing score={avgHealth} label="Health" size={90} />
                <span className="text-xs text-muted-foreground">Health</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <ScoreRing score={avgReadiness} label="Readiness" size={90} />
                <span className="text-xs text-muted-foreground">Readiness</span>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Storage Used</span>
                <span className="font-medium">{liveMetrics?.storageUsedGb.toLocaleString()} / {liveMetrics?.storageTotalGb.toLocaleString()} GB</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((liveMetrics?.storageUsedGb ?? 0) / (liveMetrics?.storageTotalGb ?? 1)) * 100}%` }} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Active Workers</span>
                <span className="font-medium">{liveMetrics?.activeWorkers}/{liveMetrics?.totalWorkers}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* CPU & Memory */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">CPU Usage</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Cluster average</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={cpuData}>
                <defs>
                  <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={50} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="cpu" stroke="hsl(var(--chart-3))" strokeWidth={2} fill="url(#cpuGrad)" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current</span>
              <span className="font-medium">{liveMetrics?.cpuUsage.toFixed(1)}%</span>
            </div>
          </CardContent>
        </Card>

        {/* Format distribution */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Dataset Formats</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Distribution by file type</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={formatDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                  {formatDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Drift alerts */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Data Drift Alerts</CardTitle>
              {driftDetected.length > 0 && <Badge variant="destructive" className="text-xs">{driftDetected.length}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Datasets with detected drift</p>
          </CardHeader>
          <CardContent>
            {driftDetected.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-success mb-2" />
                <p className="text-sm text-muted-foreground">No drift detected</p>
              </div>
            ) : (
              <div className="space-y-3">
                {driftDetected.slice(0, 4).map((d) => {
                  const ds = datasets?.find((ds) => ds.id === d.datasetId);
                  return (
                    <div key={d.datasetId} className="flex items-center justify-between rounded-lg border p-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                        <span className="truncate text-sm font-medium">{ds?.name ?? d.datasetId}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-warning">{d.driftScore}%</span>
                        <Button variant="ghost" size="sm" className="h-7" onClick={() => onNavigate('datasets')}>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: top datasets + recent jobs */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base">Top Datasets by Records</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('datasets')}>
              View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topDatasets.map((ds) => (
                <div key={ds.id} className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 cursor-pointer" onClick={() => onNavigate('datasets')}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Database className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{ds.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatNumber(ds.recordCount)} records</span>
                      <span>·</span>
                      <span>{formatBytes(ds.sizeBytes)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <ScoreRing score={ds.healthScore} size={36} strokeWidth={3} />
                    <span className={scoreColor(ds.healthScore)}>Health</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-base">Recent Jobs</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('jobs')}>
              View all <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentJobs.map((job) => (
                <div key={job.id} className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{job.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{job.workerId}</span>
                      <span>·</span>
                      <span>{timeAgo(job.startedAt)}</span>
                    </div>
                  </div>
                  <StatusBadge status={job.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LayoutDashboardIcon() {
  return <Database className="h-5 w-5" />;
}
