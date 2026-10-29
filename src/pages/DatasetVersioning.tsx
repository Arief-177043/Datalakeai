import { useState } from 'react';
import { api } from '@/services/api';
import type { DatasetVersion, Dataset } from '@/types';
import { useAsync } from '@/hooks/use-async';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingState, ErrorState, EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { formatBytes, formatNumber, timeAgo } from '@/lib/format';
import { GitBranch, Plus, MoreVertical, Trash2, RotateCcw, GitCompare, History, Tag } from 'lucide-react';

export function DatasetVersioning() {
  const { data: versions, loading, error, refetch } = useAsync(() => api.getVersions());
  const { data: datasets } = useAsync(() => api.getDatasets());
  const [selectedDsId, setSelectedDsId] = useState<string>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DatasetVersion | null>(null);
  const [comparePair, setComparePair] = useState<[DatasetVersion, DatasetVersion] | null>(null);

  const selectedDs = datasets?.find((d) => d.id === selectedDsId) ?? datasets?.[0];
  const dsVersions = (versions ?? []).filter((v) => v.datasetId === selectedDs?.id).sort((a, b) => b.version.localeCompare(a.version));

  const handleRestore = async (ver: DatasetVersion) => {
    try {
      await api.restoreVersion(ver.id);
      toast.success('Version restored', { description: `${selectedDs?.name} restored to ${ver.version}` });
      refetch();
    } catch { toast.error('Failed to restore version'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.deleteVersion(deleteTarget.id);
    toast.success('Version deleted', { description: `${deleteTarget.version}` });
    setDeleteTarget(null);
    refetch();
  };

  if (loading) return <LoadingState message="Loading versions..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dataset Versioning"
        description="Track changes, compare versions, and manage dataset history"
        icon={<GitBranch className="h-5 w-5" />}
        actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Version</Button>}
      />

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Dataset:</span>
        <Select value={selectedDs?.id ?? ''} onValueChange={setSelectedDsId}>
          <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
          <SelectContent>{datasets?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {dsVersions.length === 0 ? (
        <Card><EmptyState icon={<GitBranch className="h-7 w-7" />} title="No versions yet" description="Create a new version to start tracking changes to this dataset." /></Card>
      ) : (
        <>
          {/* Version timeline */}
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" /> Version History</CardTitle></CardHeader>
            <CardContent>
              <div className="relative space-y-4 before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                {dsVersions.map((ver, i) => (
                  <div key={ver.id} className="relative flex items-start gap-4">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 z-10 ${i === 0 ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground'}`}>
                      <GitBranch className="h-4 w-4" />
                    </div>
                    <div className="flex-1 rounded-lg border p-4 transition-colors hover:bg-muted/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold font-mono">{ver.version}</span>
                          <Badge variant={i === 0 ? 'default' : 'secondary'}>{ver.label}</Badge>
                          {i === 0 && <Badge className="bg-success/10 text-success">Latest</Badge>}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {i > 0 && <DropdownMenuItem onClick={() => setComparePair([dsVersions[0], ver])}><GitCompare className="mr-2 h-3.5 w-3.5" /> Compare with Latest</DropdownMenuItem>}
                            {i > 0 && <DropdownMenuItem onClick={() => handleRestore(ver)}><RotateCcw className="mr-2 h-3.5 w-3.5" /> Restore</DropdownMenuItem>}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(ver)}><Trash2 className="mr-2 h-3.5 w-3.5" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{ver.changeDescription}</p>
                      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{ver.createdBy}</span>
                        <span>{timeAgo(ver.createdAt)}</span>
                        <span>{formatNumber(ver.recordCount)} records</span>
                        <span>{formatBytes(ver.sizeBytes)}</span>
                        <span className="font-mono">checksum: {ver.checksum.slice(0, 8)}...</span>
                      </div>
                      {ver.changes.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {ver.changes.map((c, ci) => (
                            <div key={ci} className="flex items-center gap-2 text-xs">
                              <span className="font-mono text-muted-foreground">{c.field}:</span>
                              <span className="text-destructive line-through">{c.oldValue}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className="text-success">{c.newValue}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Create dialog */}
      {createOpen && selectedDs && <CreateVersionDialog dataset={selectedDs} onClose={() => setCreateOpen(false)} onCreated={() => { refetch(); setCreateOpen(false); }} />}

      {/* Compare dialog */}
      {comparePair && <CompareDialog v1={comparePair[0]} v2={comparePair[1]} onClose={() => setComparePair(null)} />}

      {/* Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete version?</AlertDialogTitle><AlertDialogDescription>This will permanently delete version {deleteTarget?.version}. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreateVersionDialog({ dataset, onClose, onCreated }: { dataset: Dataset; onClose: () => void; onCreated: () => void }) {
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!label.trim()) { toast.error('Version label is required'); return; }
    setSaving(true);
    try {
      const ver = await api.createVersion(dataset.id, label, description);
      toast.success('Version created', { description: `${dataset.name} ${ver.version}` });
      onCreated();
    } catch { toast.error('Failed to create version'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create New Version</DialogTitle><DialogDescription>Create a new snapshot of {dataset.name}</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Version Label</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Post-cleaning update" /></div>
          <div className="space-y-2"><Label>Change Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what changed in this version..." rows={3} /></div>
          <div className="rounded-lg border p-3 text-xs text-muted-foreground">
            <p>Current: {dataset.version} · {formatNumber(dataset.recordCount)} records · {formatBytes(dataset.sizeBytes)}</p>
            <p>New version will be auto-incremented from {dataset.version}</p>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleCreate} disabled={saving}>{saving ? 'Creating...' : 'Create Version'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompareDialog({ v1, v2, onClose }: { v1: DatasetVersion; v2: DatasetVersion; onClose: () => void }) {
  const fields = [
    { label: 'Version', get: (v: DatasetVersion) => v.version },
    { label: 'Label', get: (v: DatasetVersion) => v.label },
    { label: 'Records', get: (v: DatasetVersion) => formatNumber(v.recordCount) },
    { label: 'Size', get: (v: DatasetVersion) => formatBytes(v.sizeBytes) },
    { label: 'Created By', get: (v: DatasetVersion) => v.createdBy },
    { label: 'Created', get: (v: DatasetVersion) => timeAgo(v.createdAt) },
    { label: 'Checksum', get: (v: DatasetVersion) => v.checksum.slice(0, 12) + '...' },
  ];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><GitCompare className="h-5 w-5" /> Version Comparison</DialogTitle><DialogDescription>Comparing {v1.version} (latest) with {v2.version}</DialogDescription></DialogHeader>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground">
            <span>Field</span><span>{v1.version} (Latest)</span><span>{v2.version}</span>
          </div>
          {fields.map((f) => {
            const val1 = f.get(v1); const val2 = f.get(v2);
            const changed = val1 !== val2;
            return (
              <div key={f.label} className={`grid grid-cols-3 gap-2 rounded-lg border p-2.5 text-sm ${changed ? 'border-warning/30 bg-warning/5' : ''}`}>
                <span className="text-muted-foreground">{f.label}</span>
                <span className={changed ? 'font-medium text-success' : ''}>{val1}</span>
                <span className={changed ? 'font-medium text-warning' : ''}>{val2}</span>
              </div>
            );
          })}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
