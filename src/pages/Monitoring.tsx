import { useState, useEffect } from 'react';
import { api } from '@/services/api';
import type { MonitoringMetrics } from '@/types';
import { useAsync } from '@/hooks/use-async';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Sparkline } from '@/components/shared/Sparkline';
import { LoadingState, ErrorState } from '@/components/shared/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Activity, Cpu, MemoryStick, Network, Gauge, Zap, HardDrive,
  Server, AlertTriangle, RefreshCw, TrendingUp, TrendingDown,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, BarChart, Bar, RadialBarChart, RadialBar, PolarGrid,
} from 'recharts';

export function Monitoring() {
  const { data: initialMetrics, loading, error, refetch } = useAsync(() => api.getMetrics());
  const { data: jobs } = useAsync(() => api.getJobs());
  const [metrics, setMetrics] = useState<MonitoringMetrics | undefined>(initialMetrics);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => { setMetrics(initialMetrics); }, [initialMetrics]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => { api.refreshMetrics().then(setMetrics); }, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  if (loading) return <LoadingState message="Loading monitoring data..." />;
  if (error || !metrics) return <ErrorState message={error ?? 'No metrics available'} onRetry={refetch} />;

  const chartData = (key: keyof MonitoringMetrics) => {
    const arr = metrics[key] as { timestamp: string; value: number }[];
    return arr.map((p) => ({ time: new Date(p.timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), value: p.value }));
  };

  const storagePercent = (metrics.storageUsedGb / metrics.storageTotalGb) * 100;
  const failedJobs = jobs?.filter((j) => j.status === 'failed') ?? [];
  const runningJobs = jobs?.filter((j) => j.status === 'running' || j.status === 'retrying') ?? [];

  const radialData = [
    { name: 'CPU', value: metrics.cpuUsage, fill: 'hsl(var(--chart-1))' },
    { name: 'Memory', value: metrics.memoryUsage, fill: 'hsl(var(--chart-2))' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Monitoring"
        description="Real-time system metrics, resource utilization, and pipeline health"
        icon={<Activity className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant={autoRefresh ? 'default' : 'outline'} onClick={() => setAutoRefresh((v) => !v)}>
              {autoRefresh ? <><span className="h-2 w-2 rounded-full bg-success animate-pulse mr-2" /> Live</> : <><RefreshCw className="mr-2 h-4 w-4" /> Paused</>}
            </Button>
            <Button size="sm" variant="outline" onClick={() => api.refreshMetrics().then(setMetrics)}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        }
      />

      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Storage Used" value={`${metrics.storageUsedGb.toLocaleString()} GB`} subtitle={`${storagePercent.toFixed(1)}% of ${metrics.storageTotalGb.toLocaleString()} GB`} icon={<HardDrive className="h-4 w-4" />} accent="primary" />
        <StatCard label="CPU Usage" value={`${metrics.cpuUsage.toFixed(1)}%`} icon={<Cpu className="h-4 w-4" />} accent={metrics.cpuUsage > 80 ? 'destructive' : metrics.cpuUsage > 60 ? 'warning' : 'success'} />
        <StatCard label="Memory" value={`${metrics.memoryUsage.toFixed(1)}%`} icon={<MemoryStick className="h-4 w-4" />} accent={metrics.memoryUsage > 80 ? 'destructive' : metrics.memoryUsage > 60 ? 'warning' : 'success'} />
        <StatCard label="Pipeline Latency" value={`${metrics.pipelineLatencyMs.toFixed(0)}ms`} icon={<Gauge className="h-4 w-4" />} accent={metrics.pipelineLatencyMs > 500 ? 'destructive' : 'success'} />
      </div>

      {/* Main charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* CPU & Memory combined */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div><CardTitle className="text-base">CPU & Memory Utilization</CardTitle><p className="text-xs text-muted-foreground mt-1">Cluster average over time</p></div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs"><span className="h-2.5 w-2.5 rounded-full" style={{ background: 'hsl(var(--chart-1))' }} />CPU</div>
              <div className="flex items-center gap-1.5 text-xs"><span className="h-2.5 w-2.5 rounded-full" style={{ background: 'hsl(var(--chart-2))' }} />Mem</div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData('cpuHistory').map((d, i) => ({ ...d, memory: chartData('memoryHistory')[i]?.value ?? 0 }))}>
                <defs>
                  <linearGradient id="cpuG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} /><stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} /></linearGradient>
                  <linearGradient id="memG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} /><stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={60} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="value" name="CPU %" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#cpuG)" />
                <Area type="monotone" dataKey="memory" name="Memory %" stroke="hsl(var(--chart-2))" strokeWidth={2} fill="url(#memG)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Network */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div><CardTitle className="text-base">Network I/O</CardTitle><p className="text-xs text-muted-foreground mt-1">Inbound and outbound traffic</p></div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs"><span className="h-2.5 w-2.5 rounded-full" style={{ background: 'hsl(var(--chart-3))' }} />In</div>
              <div className="flex items-center gap-1.5 text-xs"><span className="h-2.5 w-2.5 rounded-full" style={{ background: 'hsl(var(--chart-5))' }} />Out</div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData('networkHistory')}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={60} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => `${v.toFixed(0)} Mbps`} />
                <Line type="monotone" dataKey="value" name="Inbound" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="value" name="Outbound" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center justify-between rounded-lg border p-2">
                <span className="text-muted-foreground text-xs">Inbound</span>
                <span className="font-medium">{metrics.networkInMbps.toFixed(0)} Mbps</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-2">
                <span className="text-muted-foreground text-xs">Outbound</span>
                <span className="font-medium">{metrics.networkOutMbps.toFixed(0)} Mbps</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Throughput */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4"><CardTitle className="text-base">Processing Throughput</CardTitle><p className="text-xs text-muted-foreground mt-1">Records processed per second</p></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData('throughputHistory')}>
                <defs><linearGradient id="tpG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} /><stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={60} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={(v: number) => `${v.toLocaleString()} rps`} />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#tpG)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Latency gauge */}
        <Card>
          <CardHeader className="pb-4"><CardTitle className="text-base">Pipeline Latency</CardTitle><p className="text-xs text-muted-foreground mt-1">Current response time</p></CardHeader>
          <CardContent className="flex flex-col items-center">
            <div className="relative">
              <ResponsiveContainer width={200} height={200}>
                <RadialBarChart innerRadius="70%" outerRadius="100%" data={[{ value: Math.min(100, (metrics.pipelineLatencyMs / 800) * 100) }]} startAngle={90} endAngle={-270}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <RadialBar dataKey="value" fill={metrics.pipelineLatencyMs > 500 ? 'hsl(var(--destructive))' : 'hsl(var(--chart-1))'} cornerRadius={10} background={{ fill: 'hsl(var(--muted))' }} />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{metrics.pipelineLatencyMs.toFixed(0)}</span>
                <span className="text-xs text-muted-foreground">ms</span>
              </div>
            </div>
            <Badge variant={metrics.pipelineLatencyMs > 500 ? 'destructive' : 'secondary'} className="mt-2">
              {metrics.pipelineLatencyMs > 500 ? 'High latency' : metrics.pipelineLatencyMs > 300 ? 'Moderate' : 'Optimal'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Workers & jobs */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Workers */}
        <Card>
          <CardHeader className="pb-4"><CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4" /> Worker Pool</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg border p-3 text-center"><p className="text-2xl font-bold text-success">{metrics.activeWorkers}</p><p className="text-xs text-muted-foreground">Active</p></div>
              <div className="rounded-lg border p-3 text-center"><p className="text-2xl font-bold text-muted-foreground">{metrics.totalWorkers - metrics.activeWorkers}</p><p className="text-xs text-muted-foreground">Idle</p></div>
            </div>
            <div className="space-y-2">
              {Array.from({ length: metrics.totalWorkers }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border p-2.5">
                  <Server className={cn('h-4 w-4', i < metrics.activeWorkers ? 'text-success' : 'text-muted-foreground')} />
                  <span className="text-sm font-mono">worker-{i + 1}</span>
                  <Badge variant={i < metrics.activeWorkers ? 'default' : 'secondary'} className="ml-auto text-xs">
                    {i < metrics.activeWorkers ? 'Active' : 'Idle'}
                  </Badge>
                  {i < metrics.activeWorkers && <Sparkline data={Array.from({ length: 10 }, () => 30 + Math.random() * 60)} width={40} height={16} />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Storage breakdown */}
        <Card>
          <CardHeader className="pb-4"><CardTitle className="text-base flex items-center gap-2"><HardDrive className="h-4 w-4" /> Storage Usage</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-3xl font-bold">{metrics.storageUsedGb.toLocaleString()} <span className="text-lg text-muted-foreground">GB</span></p>
                <p className="text-xs text-muted-foreground">of {metrics.storageTotalGb.toLocaleString()} GB total</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-success">{(metrics.storageTotalGb - metrics.storageUsedGb).toLocaleString()} GB</p>
                <p className="text-xs text-muted-foreground">available</p>
              </div>
            </div>
            <Progress value={storagePercent} className="h-3 mb-4" />
            <div className="space-y-2">
              {[
                { label: 'Raw Data', pct: 35, color: 'bg-chart-1' },
                { label: 'Processed', pct: 28, color: 'bg-chart-2' },
                { label: 'Validated', pct: 18, color: 'bg-chart-3' },
                { label: 'Archives', pct: 12, color: 'bg-chart-4' },
                { label: 'Free', pct: 100 - storagePercent, color: 'bg-muted' },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20">{s.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full', s.color)} style={{ width: `${s.pct}%` }} />
                  </div>
                  <span className="text-xs font-mono w-12 text-right">{s.pct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Failed jobs alert */}
      {failedJobs.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" /> Failed Jobs ({failedJobs.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {failedJobs.slice(0, 5).map((job) => (
                <div key={job.id} className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{job.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{job.errorMessage}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{timeAgoFmt(job.startedAt)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  function timeAgoFmt(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }
}
