import { useState, useMemo } from 'react';
import { api } from '@/services/api';
import type { Dataset, DatasetSchemaField } from '@/types';
import { useAsync } from '@/hooks/use-async';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ScoreRing } from '@/components/shared/ScoreRing';
import { LoadingState, ErrorState, EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { toast } from 'sonner';
import { formatBytes, formatNumber, timeAgo, scoreColor } from '@/lib/format';
import {
  Database, Plus, Search, Upload, MoreVertical, Trash2, Edit3, Eye,
  Download, Tag, FileText, Table2, BarChart3, X, ArrowUpDown, FolderOpen,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';

const FORMATS: Dataset['format'][] = ['parquet', 'csv', 'json', 'avro', 'orc', 'tfrecord', 'images', 'text'];
const STORAGE_CLASSES: Dataset['storageClass'][] = ['standard', 'infrequent', 'archive', 'glacier'];
const ALL_TAGS = ['nlp', 'vision', 'tabular', 'timeseries', 'audio', 'multimodal', 'healthcare', 'finance', 'retail', 'autonomous', 'production', 'experimental'];

export function DatasetManagement() {
  const { data: datasets, loading, error, refetch } = useAsync(() => api.getDatasets());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formatFilter, setFormatFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'records' | 'health' | 'updated'>('updated');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Dataset | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Dataset | null>(null);
  const [deleteTarget, deleteTargetState] = useState<Dataset | null>(null) as [Dataset | null, any] | [Dataset | null, React.Dispatch<React.SetStateAction<Dataset | null>>];
  const [page, setPage] = useState(1);
  const pageSize = 8;

  const filtered = useMemo(() => {
    let result = datasets ?? [];
    if (search) result = result.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.tags.some((t) => t.includes(search.toLowerCase())));
    if (statusFilter !== 'all') result = result.filter((d) => d.status === statusFilter);
    if (formatFilter !== 'all') result = result.filter((d) => d.format === formatFilter);
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'size') cmp = a.sizeBytes - b.sizeBytes;
      else if (sortBy === 'records') cmp = a.recordCount - b.recordCount;
      else if (sortBy === 'health') cmp = a.healthScore - b.healthScore;
      else cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [datasets, search, statusFilter, formatFilter, sortBy, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('desc'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deleteDataset(deleteTarget.id);
      toast.success('Dataset deleted', { description: deleteTarget.name });
      deleteTargetState(null);
      refetch();
    } catch (e) {
      toast.error('Failed to delete dataset');
    }
  };

  if (loading) return <LoadingState message="Loading datasets..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Dataset Management"
        description="Create, manage, and explore your AI training datasets"
        icon={<Database className="h-5 w-5" />}
        actions={
          <Button onClick={() => setCreateOpen(true)} size="sm">
            <Plus className="mr-2 h-4 w-4" /> New Dataset
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name or tag..." className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={formatFilter} onValueChange={(v) => { setFormatFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Format" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Formats</SelectItem>
            {FORMATS.map((f) => <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Database className="h-7 w-7" />}
            title="No datasets found"
            description="Try adjusting your filters or create a new dataset to get started."
            action={<Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Dataset</Button>}
          />
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><SortButton label="Name" col="name" sortBy={sortBy} sortDir={sortDir} onClick={handleSort} /></TableHead>
                <TableHead>Format</TableHead>
                <TableHead>Status</TableHead>
                <TableHead><SortButton label="Records" col="records" sortBy={sortBy} sortDir={sortDir} onClick={handleSort} /></TableHead>
                <TableHead><SortButton label="Size" col="size" sortBy={sortBy} sortDir={sortDir} onClick={handleSort} /></TableHead>
                <TableHead><SortButton label="Health" col="health" sortBy={sortBy} sortDir={sortDir} onClick={handleSort} /></TableHead>
                <TableHead><SortButton label="Updated" col="updated" sortBy={sortBy} sortDir={sortDir} onClick={handleSort} /></TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((ds) => (
                <TableRow key={ds.id} className="cursor-pointer" onClick={() => setSelected(ds)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Database className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{ds.name}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {ds.tags.slice(0, 2).map((t) => <Badge key={t} variant="secondary" className="text-[9px] px-1.5 py-0">{t}</Badge>)}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="font-mono text-xs">{ds.format}</Badge></TableCell>
                  <TableCell><StatusBadge status={ds.status} /></TableCell>
                  <TableCell className="font-mono text-xs">{formatNumber(ds.recordCount)}</TableCell>
                  <TableCell className="text-xs">{formatBytes(ds.sizeBytes)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className={scoreColor(ds.healthScore) + ' font-medium'}>{ds.healthScore}</span>
                      <div className="w-12"><Progress value={ds.healthScore} className="h-1.5" /></div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{timeAgo(ds.updatedAt)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelected(ds)}><Eye className="mr-2 h-3.5 w-3.5" /> View Details</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditTarget(ds)}><Edit3 className="mr-2 h-3.5 w-3.5" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setSelected(ds); toast.success('Export started', { description: `${ds.name} is being exported as ${ds.format}` }); }}><Download className="mr-2 h-3.5 w-3.5" /> Export</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteTargetState(ds)}><Trash2 className="mr-2 h-3.5 w-3.5" /> Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <span className="text-xs text-muted-foreground">{filtered.length} datasets · Page {page} of {totalPages}</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Detail Dialog */}
      {selected && <DatasetDetailDialog dataset={selected} onClose={() => setSelected(null)} onEdit={() => { setEditTarget(selected); setSelected(null); }} />}

      {/* Create Dialog */}
      {createOpen && <DatasetFormDialog onClose={() => setCreateOpen(false)} onSaved={() => { refetch(); setCreateOpen(false); }} />}

      {/* Edit Dialog */}
      {editTarget && <DatasetFormDialog dataset={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { refetch(); setEditTarget(null); }} />}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) deleteTargetState(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete dataset?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete "{deleteTarget?.name}" and all associated data. This action cannot be undone.</AlertDialogDescription>
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

function SortButton({ label, col, sortBy, sortDir, onClick }: { label: string; col: string; sortBy: string; sortDir: 'asc' | 'desc'; onClick: (col: any) => void }) {
  return (
    <button onClick={() => onClick(col)} className="inline-flex items-center gap-1 hover:text-foreground">
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sortBy === col ? 'opacity-100' : 'opacity-30'}`} />
      {sortBy === col && <span className="text-[8px]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  );
}

function DatasetDetailDialog({ dataset, onClose, onEdit }: { dataset: Dataset; onClose: () => void; onEdit: () => void }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const statsData = [
    { name: 'Records', value: dataset.recordCount },
    { name: 'Size (MB)', value: Math.round(dataset.sizeBytes / (1024 * 1024)) },
    { name: 'Partitions', value: dataset.partitions },
    { name: 'Schema Fields', value: dataset.schema.length },
  ];

  const handleUpload = () => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((p) => {
        if (p === null) return null;
        if (p >= 100) {
          clearInterval(interval);
          toast.success('Upload complete', { description: `File uploaded to ${dataset.name}` });
          return null;
        }
        return p + 10;
      });
    }, 200);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">{dataset.name}</DialogTitle>
              <DialogDescription className="mt-1">{dataset.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={dataset.status} />
          <Badge variant="outline" className="font-mono">{dataset.format}</Badge>
          <Badge variant="outline">{dataset.version}</Badge>
          {dataset.encryption && <Badge variant="secondary" className="gap-1"><Tag className="h-3 w-3" /> Encrypted</Badge>}
          {dataset.tags.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview"><BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Overview</TabsTrigger>
            <TabsTrigger value="schema"><Table2 className="mr-1.5 h-3.5 w-3.5" /> Schema</TabsTrigger>
            <TabsTrigger value="files"><FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Files</TabsTrigger>
            <TabsTrigger value="preview"><FileText className="mr-1.5 h-3.5 w-3.5" /> Preview</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {statsData.map((s) => (
                <div key={s.name} className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">{s.name}</p>
                  <p className="mt-1 text-lg font-bold">{s.value.toLocaleString()}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center rounded-lg border p-4">
                <ScoreRing score={dataset.healthScore} label="Health" size={70} />
                <span className="mt-2 text-xs text-muted-foreground">Health Score</span>
              </div>
              <div className="flex flex-col items-center rounded-lg border p-4">
                <ScoreRing score={dataset.qualityScore} label="Quality" size={70} />
                <span className="mt-2 text-xs text-muted-foreground">Quality Score</span>
              </div>
              <div className="flex flex-col items-center rounded-lg border p-4">
                <ScoreRing score={dataset.trainingReadiness} label="Ready" size={70} />
                <span className="mt-2 text-xs text-muted-foreground">Training Readiness</span>
              </div>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-sm font-medium mb-3">Dataset Statistics</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={statsData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3"><span className="text-muted-foreground">Storage Path:</span><br /><code className="text-xs">{dataset.storagePath}</code></div>
              <div className="rounded-lg border p-3"><span className="text-muted-foreground">Storage Class:</span><br /><span className="text-xs capitalize">{dataset.storageClass}</span></div>
              <div className="rounded-lg border p-3"><span className="text-muted-foreground">Owner:</span><br />{dataset.ownerId}</div>
              <div className="rounded-lg border p-3"><span className="text-muted-foreground">Created:</span><br />{timeAgo(dataset.createdAt)}</div>
            </div>
          </TabsContent>

          <TabsContent value="schema">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead><TableHead>Type</TableHead><TableHead>Nullable</TableHead><TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dataset.schema.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-mono text-sm">{f.name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{f.type}</Badge></TableCell>
                    <TableCell>{f.nullable ? <span className="text-warning text-xs">Yes</span> : <span className="text-success text-xs">No</span>}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{f.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TabsContent>

          <TabsContent value="files">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">File Explorer</p>
                <Button size="sm" variant="outline" onClick={handleUpload}><Upload className="mr-2 h-3.5 w-3.5" /> Upload</Button>
              </div>
              {uploadProgress !== null && (
                <div className="space-y-1">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">Uploading... {uploadProgress}%</p>
                </div>
              )}
              {Array.from({ length: Math.min(dataset.partitions, 8) }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border p-2.5 hover:bg-muted/50 transition-colors cursor-pointer">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-mono">part-{String(i).padStart(5, '0')}.{dataset.format}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{formatBytes(Math.floor(dataset.sizeBytes / dataset.partitions))}</span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="preview">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {dataset.schema.slice(0, 6).map((f) => <TableHead key={f.id} className="font-mono text-xs">{f.name}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, ri) => (
                    <TableRow key={ri}>
                      {dataset.schema.slice(0, 6).map((f) => {
                        const val = f.type === 'integer' || f.type === 'float' ? (Math.random() * 1000).toFixed(2) : f.type === 'boolean' ? Math.random() > 0.5 ? 'true' : 'false' : `sample_${ri}_${f.name}`;
                        return <TableCell key={f.id} className="text-xs font-mono">{val}</TableCell>;
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={onEdit}><Edit3 className="mr-2 h-4 w-4" /> Edit Dataset</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DatasetFormDialog({ dataset, onClose, onSaved }: { dataset?: Dataset; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(dataset?.name ?? '');
  const [description, setDescription] = useState(dataset?.description ?? '');
  const [format, setFormat] = useState<Dataset['format']>(dataset?.format ?? 'parquet');
  const [storageClass, setStorageClass] = useState<Dataset['storageClass']>(dataset?.storageClass ?? 'standard');
  const [tags, setTags] = useState<string[]>(dataset?.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [schema, setSchema] = useState<DatasetSchemaField[]>(dataset?.schema ?? []);
  const [saving, setSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const addTag = (tag: string) => {
    if (tag && !tags.includes(tag)) setTags([...tags, tag]);
    setTagInput('');
  };

  const addField = () => {
    setSchema([...schema, { id: `fld_${Date.now()}`, name: `field_${schema.length + 1}`, type: 'string', nullable: true, description: '' }]);
  };

  const updateField = (id: string, updates: Partial<DatasetSchemaField>) => {
    setSchema(schema.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeField = (id: string) => setSchema(schema.filter((f) => f.id !== id));

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Dataset name is required'); return; }

    const extension = selectedFile?.name.split('.').pop()?.toLowerCase();
    const formatExtensions: Record<string, string[]> = {
      csv: ['csv'], json: ['json', 'jsonl'], parquet: ['parquet'],
      avro: ['avro'], orc: ['orc'], tfrecord: ['tfrecord', 'tfrecords'],
      images: ['zip', 'tar', 'gz'], text: ['txt', 'md'],
    };
    if (selectedFile && extension && !formatExtensions[format]?.includes(extension)) {
      toast.error(`The selected file does not match the ${format.toUpperCase()} format.`);
      return;
    }
    if (selectedFile && selectedFile.size > 100 * 1024 * 1024) {
      toast.error('File size must be 100 MB or less.');
      return;
    }

    setSaving(true);
    try {
      let savedDataset: Dataset;
      if (dataset) {
        savedDataset = await api.updateDataset(dataset.id, { name, description, format, storageClass, tags, schema });
      } else {
        savedDataset = await api.createDataset({ name, description, format, storageClass, tags, schema });
      }

      if (selectedFile) {
        setUploading(true);
        const token = localStorage.getItem('datalake_auth_token');
        if (!token) throw new Error('Your session has expired. Please sign in again.');

        const formData = new FormData();
        formData.append('file', selectedFile);
        const apiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
        const response = await fetch(`${apiUrl}/datasets/${savedDataset.id}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Dataset was saved, but file upload failed.');
      }

      toast.success(dataset ? 'Dataset updated' : 'Dataset created', {
        description: selectedFile ? `${name} — file uploaded` : name,
      });
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save dataset');
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>{dataset ? 'Edit Dataset' : 'Create New Dataset'}</DialogTitle>
          <DialogDescription>{dataset ? 'Update dataset configuration and schema' : 'Define a new dataset for your data lake'}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Dataset Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Customer-Churn-v4" />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe this dataset..." rows={2} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dataset-file">Dataset File (optional)</Label>
            <div className="rounded-lg border border-dashed p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{selectedFile ? selectedFile.name : 'Choose a file to upload'}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedFile
                      ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
                      : 'CSV, JSON, Parquet, Avro, ORC, TFRecord, text, or an image archive. Maximum 100 MB.'}
                  </p>
                </div>
                <Input
                  id="dataset-file"
                  type="file"
                  className="max-w-sm"
                  accept=".csv,.json,.jsonl,.parquet,.avro,.orc,.tfrecord,.tfrecords,.zip,.tar,.gz,.txt,.md"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                />
              </div>
              {selectedFile && (
                <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setSelectedFile(null)}>
                  <X className="mr-1 h-3 w-3" /> Remove file
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              The file is sent to the backend after the dataset record is saved. Uploading requires the backend upload endpoint described in the setup notes.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as Dataset['format'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FORMATS.map((f) => <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Storage Class</Label>
              <Select value={storageClass} onValueChange={(v) => setStorageClass(v as Dataset['storageClass'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STORAGE_CLASSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1">{t}<button onClick={() => setTags(tags.filter((x) => x !== t))}><X className="h-3 w-3" /></button></Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }} placeholder="Add tag..." />
              <Button variant="outline" size="sm" onClick={() => addTag(tagInput)}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {ALL_TAGS.filter((t) => !tags.includes(t)).slice(0, 6).map((t) => (
                <button key={t} onClick={() => addTag(t)} className="text-[10px] rounded border px-1.5 py-0.5 text-muted-foreground hover:bg-muted">{t}</button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Schema Definition</Label>
              <Button variant="outline" size="sm" onClick={addField}><Plus className="mr-1 h-3 w-3" /> Add Field</Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
              {schema.map((f) => (
                <div key={f.id} className="flex items-center gap-2">
                  <Input value={f.name} onChange={(e) => updateField(f.id, { name: e.target.value })} className="flex-1" placeholder="field name" />
                  <Select value={f.type} onValueChange={(v) => updateField(f.id, { type: v as DatasetSchemaField['type'] })}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['string', 'integer', 'float', 'boolean', 'datetime', 'array', 'object'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <button onClick={() => updateField(f.id, { nullable: !f.nullable })} className={`text-xs px-2 py-1.5 rounded border ${f.nullable ? 'text-warning border-warning/30' : 'text-success border-success/30'}`}>{f.nullable ? 'null' : 'not null'}</button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeField(f.id)}><X className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
              {schema.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">No fields defined. Click "Add Field" to start.</p>}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || uploading}>{uploading ? 'Uploading file...' : saving ? 'Saving...' : dataset ? 'Save Changes' : 'Create Dataset'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
