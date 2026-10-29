import { useState } from 'react';
import { api } from '@/services/api';
import type { DataQualityReport, Dataset } from '@/types';
import { useAsync } from '@/hooks/use-async';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { ScoreRing } from '@/components/shared/ScoreRing';
import { LoadingState, ErrorState, EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { toast } from 'sonner';
import { formatNumber, scoreColor } from '@/lib/format';
import { ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2, Copy, TrendingDown, Database } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export function DataQuality() {
  const { data: reports, loading, error, refetch } = useAsync(() => api.getQualityReports());
  const { data: datasets } = useAsync(() => api.getDatasets());
  const [selectedId, setSelectedId] = useState<string>('');

  const selectedReport = reports?.find((r) => r.datasetId === selectedId) ?? reports?.[0];
  const selectedDs = datasets?.find((d) => d.id === selectedReport?.datasetId);
  const [rerunning, setRerunning] = useState(false);

  const avgScore = reports && reports.length > 0 ? Math.round(reports.reduce((a, r) => a + r.overallScore, 0) / reports.length) : 0;
  const totalMissing = reports?.reduce((a, r) => a + r.missingValues, 0) ?? 0;
  const totalDuplicates = reports?.reduce((a, r) => a + r.duplicateRows, 0) ?? 0;
  const totalOutliers = reports?.reduce((a, r) => a + r.outliers, 0) ?? 0;

  const handleRerun = async () => {
    if (!selectedReport) return;
    setRerunning(true);
    try {
      await api.rerunQualityReport(selectedReport.datasetId);
      toast.success('Quality report regenerated', { description: selectedDs?.name });
      refetch();
    } catch { toast.error('Failed to regenerate report'); }
    finally { setRerunning(false); }
  };

  if (loading) return <LoadingState message="Loading quality reports..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const radarData = selectedReport ? [
    { metric: 'Completeness', value: selectedReport.completeness },
    { metric: 'Consistency', value: selectedReport.consistency },
    { metric: 'Uniqueness', value: selectedReport.uniqueness },
    { metric: 'Validity', value: selectedReport!.validity },
  ] : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Data Quality"
        description="Monitor completeness, consistency, and validity across your datasets"
        icon={<ShieldCheck className="h-5 w-5" />}
        actions={selectedReport && <Button size="sm" variant="outline" onClick={handleRerun} disabled={rerunning}><RefreshCw className={`mr-2 h-4 w-4 ${rerunning ? 'animate-spin' : ''}`} /> Re-run Analysis</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Avg Quality Score" value={avgScore} subtitle="Across all datasets" icon={<ShieldCheck className="h-4 w-4" />} accent={avgScore >= 80 ? 'success' : 'warning'} />
        <StatCard label="Missing Values" value={formatNumber(totalMissing)} icon={<AlertTriangle className="h-4 w-4" />} accent="warning" />
        <StatCard label="Duplicates" value={formatNumber(totalDuplicates)} icon={<Copy className="h-4 w-4" />} accent="destructive" />
        <StatCard label="Outliers" value={formatNumber(totalOutliers)} icon={<TrendingDown className="h-4 w-4" />} accent="warning" />
      </div>

      {reports && reports.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Dataset:</span>
          <Select value={selectedReport?.datasetId ?? reports[0].datasetId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {reports.map((r) => {
                const ds = datasets?.find((d) => d.id === r.datasetId);
                return <SelectItem key={r.datasetId} value={r.datasetId}>{ds?.name ?? r.datasetId}</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {selectedReport ? (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Overall score */}
            <Card>
              <CardHeader className="pb-4"><CardTitle className="text-base">Overall Quality</CardTitle></CardHeader>
              <CardContent className="flex flex-col items-center">
                <ScoreRing score={selectedReport.overallScore} size={120} strokeWidth={8} label="Score" />
                <p className="mt-3 text-sm text-muted-foreground">{selectedDs?.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatNumber(selectedReport.totalRows)} rows analyzed</p>
                <div className="mt-3 flex items-center gap-2">
                  {selectedReport.overallScore >= 80 ? <Badge className="bg-success/10 text-success"><CheckCircle2 className="mr-1 h-3 w-3" /> High Quality</Badge> : <Badge className="bg-warning/10 text-warning"><AlertTriangle className="mr-1 h-3 w-3" /> Needs Attention</Badge>}
                </div>
              </CardContent>
            </Card>

            {/* Radar chart */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-4"><CardTitle className="text-base">Quality Dimensions</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <Radar dataKey="value" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.3} strokeWidth={2} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Issue summary */}
          <div className="grid gap-4 lg:grid-cols-4">
            {[
              { label: 'Missing Values', value: selectedReport.missingValues, icon: AlertTriangle, color: 'text-warning' },
              { label: 'Duplicate Rows', value: selectedReport.duplicateRows, icon: Copy, color: 'text-destructive' },
              { label: 'Outliers', value: selectedReport.outliers, icon: TrendingDown, color: 'text-warning' },
              { label: 'Schema Violations', value: selectedReport.schemaViolations, icon: AlertTriangle, color: 'text-destructive' },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <item.icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <p className={`mt-2 text-2xl font-bold ${item.color}`}>{formatNumber(item.value)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{((item.value / selectedReport.totalRows) * 100).toFixed(2)}% of rows</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Column stats */}
          <Card>
            <CardHeader><CardTitle className="text-base">Column Quality Statistics</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Column</TableHead><TableHead>Type</TableHead><TableHead>Nulls</TableHead><TableHead>Null %</TableHead><TableHead>Unique</TableHead><TableHead>Duplicates</TableHead><TableHead>Outliers</TableHead><TableHead>Range / Stats</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedReport.columnStats.map((col) => (
                    <TableRow key={col.column}>
                      <TableCell className="font-mono text-sm">{col.column}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{col.type}</Badge></TableCell>
                      <TableCell className={col.nullCount > 0 ? 'text-warning' : ''}>{formatNumber(col.nullCount)}</TableCell>
                      <TableCell>{col.nullPercent}%</TableCell>
                      <TableCell>{formatNumber(col.uniqueCount)}</TableCell>
                      <TableCell className={col.duplicates > 0 ? 'text-destructive' : ''}>{formatNumber(col.duplicates)}</TableCell>
                      <TableCell className={col.outliers > 0 ? 'text-warning' : ''}>{formatNumber(col.outliers)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {col.mean !== undefined ? `μ=${col.mean.toFixed(1)}, σ=${col.stdDev?.toFixed(1)}, [${col.min}, ${col.max}]` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card><EmptyState icon={<Database className="h-7 w-7" />} title="No quality reports" description="Quality reports are generated automatically for your datasets." /></Card>
      )}
    </div>
  );
}
