import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import type { AppSettings } from '@/services/api';
import { useAsync } from '@/hooks/use-async';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { LoadingState, ErrorState } from '@/components/shared/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/format';
import {
  Settings, Save, Database, Shield, Cpu, Bell, DollarSign,
  RotateCcw, HardDrive, Lock, Zap, Gauge, Trash2,
} from 'lucide-react';

const STORAGE_CLASSES: AppSettings['defaultStorageClass'][] = ['standard', 'infrequent', 'archive', 'glacier'];

export function SettingsPage() {
  const { data: settings, loading, error, refetch } = useAsync(() => api.getSettings());
  const { data: costEstimates } = useAsync(() => api.getCostEstimates());
  const { data: datasets } = useAsync(() => api.getDatasets());
  const [local, setLocal] = useState<AppSettings | undefined>(settings);
  const [saving, setSaving] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  // Keep the editable form state in sync when settings finish loading or are refreshed.
  useEffect(() => {
    if (settings) {
      setLocal(settings);
    }
  }, [settings]);

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setLocal((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  const handleSave = async () => {
    if (!local) return;
    setSaving(true);
    try {
      await api.updateSettings(local);
      toast.success('Settings saved', { description: 'Your configuration has been updated' });
      refetch();
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  const handleReset = async () => {
    await api.resetData();
    toast.success('Data reset', { description: 'All data has been regenerated with fresh mock data' });
    setResetOpen(false);
    window.location.reload();
  };

  // Show request errors first so a failed request cannot leave the page loading forever.
  if (error) return <ErrorState message={error} onRetry={refetch} />;
  if (loading || !local || !settings) return <LoadingState message="Loading settings..." />;

  const totalMonthlyCost = costEstimates?.reduce((a, c) => a + c.monthlyCost, 0) ?? 0;
  const totalAnnualCost = costEstimates?.reduce((a, c) => a + c.annualCost, 0) ?? 0;
  const optimizationPotential = costEstimates?.reduce((a, c) => a + c.optimizationPotential, 0) ?? 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Settings"
        description="Configure platform-wide settings, storage policies, and cost optimization"
        icon={<Settings className="h-5 w-5" />}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setResetOpen(true)}><RotateCcw className="mr-2 h-4 w-4" /> Reset Data</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}><Save className="mr-2 h-4 w-4" /> {saving ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        }
      />

      {/* Cost overview */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Monthly Storage Cost" value={formatCurrency(totalMonthlyCost)} subtitle="All datasets" icon={<DollarSign className="h-4 w-4" />} accent="primary" />
        <StatCard label="Annual Projection" value={formatCurrency(totalAnnualCost)} icon={<DollarSign className="h-4 w-4" />} accent="success" />
        <StatCard label="Optimization Potential" value={formatCurrency(optimizationPotential)} subtitle="By archiving cold data" icon={<HardDrive className="h-4 w-4" />} accent="warning" />
        <StatCard label="Datasets Tracked" value={datasets?.length ?? 0} icon={<Database className="h-4 w-4" />} accent="default" />
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="cost">Cost Analysis</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4" /> Platform Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <SettingRow label="Auto Versioning" description="Automatically create a new version when datasets are modified">
                <Switch checked={local.autoVersioning} onCheckedChange={(v) => update('autoVersioning', v)} />
              </SettingRow>
              <SettingRow label="Notifications" description="Enable real-time notifications for pipeline events">
                <Switch checked={local.notificationsEnabled} onCheckedChange={(v) => update('notificationsEnabled', v)} />
              </SettingRow>
              <SettingRow label="Quality Threshold" description="Minimum quality score for datasets to be marked as training-ready">
                <div className="flex items-center gap-3 w-48">
                  <Input type="number" min={0} max={100} value={local.qualityThreshold} onChange={(e) => update('qualityThreshold', Number(e.target.value))} />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </SettingRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Storage */}
        <TabsContent value="storage" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><HardDrive className="h-4 w-4" /> Storage Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <SettingRow label="Default Storage Class" description="Storage class for new datasets and uploads">
                <Select value={local.defaultStorageClass} onValueChange={(v) => update('defaultStorageClass', v as AppSettings['defaultStorageClass'])}>
                  <SelectTrigger className="w-40 capitalize"><SelectValue /></SelectTrigger>
                  <SelectContent>{STORAGE_CLASSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </SettingRow>
              <SettingRow label="Compression" description="Enable compression for stored data to reduce storage costs">
                <Switch checked={local.compressionEnabled} onCheckedChange={(v) => update('compressionEnabled', v)} />
              </SettingRow>
              <SettingRow label="Data Retention" description="Number of days to retain deleted data before permanent removal">
                <div className="flex items-center gap-3 w-48">
                  <Input type="number" min={1} value={local.retentionDays} onChange={(e) => update('retentionDays', Number(e.target.value))} />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              </SettingRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pipeline */}
        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Cpu className="h-4 w-4" /> Pipeline Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <SettingRow label="Max Retries" description="Maximum retry attempts for failed jobs">
                <div className="flex items-center gap-3 w-32">
                  <Input type="number" min={0} max={10} value={local.maxRetries} onChange={(e) => update('maxRetries', Number(e.target.value))} />
                </div>
              </SettingRow>
              <SettingRow label="Pipeline Timeout" description="Maximum duration before a job is automatically cancelled">
                <div className="flex items-center gap-3 w-48">
                  <Input type="number" min={1} value={local.pipelineTimeoutMin} onChange={(e) => update('pipelineTimeoutMin', Number(e.target.value))} />
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
              </SettingRow>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Security Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <SettingRow label="Encryption at Rest" description="Encrypt all stored data using AES-256">
                <Switch checked={local.encryptionAtRest} onCheckedChange={(v) => update('encryptionAtRest', v)} />
              </SettingRow>
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 mb-2"><Lock className="h-4 w-4 text-success" /><span className="text-sm font-medium">Encryption Active</span></div>
                <p className="text-xs text-muted-foreground">All data in the data lake is encrypted at rest using AES-256-GCM. SSL/TLS is enforced for all data in transit.</p>
              </div>
              <div className="rounded-lg border p-4">
                <div className="flex items-center gap-2 mb-2"><Shield className="h-4 w-4 text-primary" /><span className="text-sm font-medium">Row-Level Security</span></div>
                <p className="text-xs text-muted-foreground">RLS policies are enforced on all tables. Users can only access datasets they have explicit permissions for.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cost */}
        <TabsContent value="cost" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><DollarSign className="h-4 w-4" /> Storage Cost Analysis</CardTitle></CardHeader>
            <CardContent>
              {costEstimates && costEstimates.length > 0 ? (
                <div className="space-y-3">
                  {costEstimates.slice(0, 10).map((c) => {
                    const ds = datasets?.find((d) => d.id === c.datasetId);
                    return (
                      <div key={c.datasetId} className="flex items-center gap-4 rounded-lg border p-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Database className="h-4 w-4" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium">{ds?.name ?? c.datasetId}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{c.sizeGb} GB</span>
                            <Badge variant="outline" className="text-[9px] capitalize">{c.storageClass}</Badge>
                            <span>{formatCurrency(c.costPerGb)}/GB</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold">{formatCurrency(c.monthlyCost)}/mo</p>
                          {c.optimizationPotential > 0 && <p className="text-xs text-warning">Save {formatCurrency(c.optimizationPotential)}/mo</p>}
                        </div>
                      </div>
                    );
                  })}
                  <div className="border-t pt-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">Total Monthly Cost</span>
                      <span className="text-lg font-bold">{formatCurrency(totalMonthlyCost)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Projected Annual</span>
                      <span className="font-medium">{formatCurrency(totalAnnualCost)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-warning">Optimization Potential</span>
                      <span className="font-medium text-warning">{formatCurrency(optimizationPotential)}/mo</span>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Cost Efficiency</span>
                        <span>{(100 - (optimizationPotential / totalMonthlyCost) * 100).toFixed(0)}%</span>
                      </div>
                      <Progress value={100 - (optimizationPotential / totalMonthlyCost) * 100} className="h-2" />
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">No cost data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reset confirmation */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Reset all data?</AlertDialogTitle><AlertDialogDescription>This will regenerate all mock data from scratch. Any datasets, ingestion sources, or versions you created will be lost. The page will reload after reset.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleReset}><Trash2 className="mr-2 h-4 w-4" /> Reset Everything</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
