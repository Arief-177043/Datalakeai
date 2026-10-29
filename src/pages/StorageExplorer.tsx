import { useState, useMemo } from 'react';
import { api } from '@/services/api';
import type { StorageObject } from '@/types';
import { useAsync } from '@/hooks/use-async';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { LoadingState, ErrorState, EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
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
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { formatBytes, timeAgo } from '@/lib/format';
import {
  FolderTree, Folder, File, Upload, Download, Trash2, Edit3, MoreVertical,
  Search, ChevronRight, HardDrive, Home, FileText, FileJson, FileCode, Plus, X,
} from 'lucide-react';

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'json') return FileJson;
  if (ext === 'csv' || ext === 'txt') return FileText;
  if (ext === 'parquet' || ext === 'avro' || ext === 'orc') return FileCode;
  return File;
}

export function StorageExplorer() {
  const { data: tree, loading, error, refetch } = useAsync(() => api.getStorageTree());
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<StorageObject | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<StorageObject | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StorageObject | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // Navigate the tree to find current folder contents
  const currentItems = useMemo(() => {
    if (!tree) return [];
    let items = tree;
    for (const segment of currentPath) {
      const folder = items.find((i) => i.type === 'folder' && i.name === segment);
      items = folder?.children ?? [];
    }
    let result = items;
    if (search) {
      result = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
    }
    return [...result].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [tree, currentPath, search]);

  const totalSize = useMemo(() => {
    if (!tree) return 0;
    const calc = (items: StorageObject[]): number => items.reduce((a, i) => a + (i.type === 'folder' ? calc(i.children ?? []) : i.size), 0);
    return calc(tree);
  }, [tree]);

  const fileCount = useMemo(() => {
    if (!tree) return 0;
    const count = (items: StorageObject[]): number => items.reduce((a, i) => a + (i.type === 'folder' ? count(i.children ?? []) : 1), 0);
    return count(tree);
  }, [tree]);

  const folderCount = useMemo(() => {
    if (!tree) return 0;
    const count = (items: StorageObject[]): number => items.reduce((a, i) => a + (i.type === 'folder' ? 1 + count(i.children ?? []) : 0), 0);
    return count(tree);
  }, [tree]);

  const currentPathStr = `s3://datalake/${currentPath.join('/')}${currentPath.length > 0 ? '/' : ''}`;

  const navigateTo = (folderName: string) => {
    setCurrentPath([...currentPath, folderName]);
    setSearch('');
  };

  const navigateToIndex = (index: number) => {
    setCurrentPath(currentPath.slice(0, index + 1));
  };

  const goHome = () => { setCurrentPath([]); setSearch(''); };

  const handleDownload = (obj: StorageObject) => {
    toast.success('Download started', { description: `${obj.name} (${formatBytes(obj.size)})` });
  };

  const handleRename = async (newName: string) => {
    if (!renameTarget) return;
    await api.renameStorageObject(renameTarget.id, newName);
    toast.success('Renamed', { description: `${renameTarget.name} → ${newName}` });
    setRenameTarget(null);
    refetch();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.deleteStorageObject(deleteTarget.id);
    toast.success('Deleted', { description: deleteTarget.name });
    setDeleteTarget(null);
    refetch();
  };

  const handleUpload = async (fileName: string, fileSize: number) => {
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress((p) => {
        if (p === null) return null;
        if (p >= 100) {
          clearInterval(interval);
          return null;
        }
        return p + 10;
      });
    }, 150);
    await api.uploadStorageFile(currentPathStr, { name: fileName, size: fileSize });
    toast.success('File uploaded', { description: fileName });
    refetch();
  };

  if (loading) return <LoadingState message="Loading storage..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Storage Explorer"
        description="Browse and manage files in your distributed data lake storage"
        icon={<FolderTree className="h-5 w-5" />}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setCreateFolderOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Folder</Button>
            <Button size="sm" onClick={() => setUploadOpen(true)}><Upload className="mr-2 h-4 w-4" /> Upload</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Storage" value={formatBytes(totalSize)} icon={<HardDrive className="h-4 w-4" />} accent="primary" />
        <StatCard label="Files" value={fileCount} icon={<File className="h-4 w-4" />} accent="success" />
        <StatCard label="Folders" value={folderCount} icon={<Folder className="h-4 w-4" />} accent="warning" />
        <StatCard label="Buckets" value={tree?.length ?? 0} icon={<FolderTree className="h-4 w-4" />} accent="default" />
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Breadcrumb + search */}
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1 text-sm overflow-x-auto scrollbar-thin">
              <button onClick={goHome} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                <Home className="h-3.5 w-3.5" /> datalake
              </button>
              {currentPath.map((seg, i) => (
                <span key={i} className="flex items-center gap-1">
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  <button onClick={() => navigateToIndex(i)} className={i === currentPath.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'}>
                    {seg}
                  </button>
                </span>
              ))}
            </div>
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files..." className="h-8 pl-8 text-sm" />
            </div>
          </div>

          {/* File list */}
          {currentItems.length === 0 ? (
            <EmptyState icon={<Folder className="h-7 w-7" />} title="This folder is empty" description="Upload files or create a new folder to get started." action={<Button size="sm" onClick={() => setUploadOpen(true)}><Upload className="mr-2 h-4 w-4" /> Upload File</Button>} />
          ) : (
            <div className="divide-y">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
                <span className="flex-1">Name</span>
                <span className="w-28 text-right hidden sm:block">Size</span>
                <span className="w-32 text-right hidden md:block">Modified</span>
                <span className="w-24 text-right hidden lg:block">Class</span>
                <span className="w-10"></span>
              </div>
              {currentItems.map((obj) => {
                const Icon = obj.type === 'folder' ? Folder : getFileIcon(obj.name);
                return (
                  <div
                    key={obj.id}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30 cursor-pointer group"
                    onClick={() => obj.type === 'folder' ? navigateTo(obj.name) : setSelected(obj)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Icon className={obj.type === 'folder' ? 'h-5 w-5 text-primary shrink-0' : 'h-5 w-5 text-muted-foreground shrink-0'} />
                      <span className="truncate text-sm font-medium">{obj.name}</span>
                      {obj.type === 'folder' && <Badge variant="secondary" className="text-[9px]">{obj.children?.length ?? 0} items</Badge>}
                    </div>
                    <span className="w-28 text-right text-xs text-muted-foreground hidden sm:block">{obj.type === 'folder' ? '—' : formatBytes(obj.size)}</span>
                    <span className="w-32 text-right text-xs text-muted-foreground hidden md:block">{timeAgo(obj.modifiedAt)}</span>
                    <span className="w-24 text-right hidden lg:block"><Badge variant="outline" className="text-[9px] capitalize">{obj.storageClass}</Badge></span>
                    <span className="w-10" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"><MoreVertical className="h-3.5 w-3.5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {obj.type === 'file' && <DropdownMenuItem onClick={() => setSelected(obj)}><File className="mr-2 h-3.5 w-3.5" /> Preview</DropdownMenuItem>}
                          {obj.type === 'file' && <DropdownMenuItem onClick={() => handleDownload(obj)}><Download className="mr-2 h-3.5 w-3.5" /> Download</DropdownMenuItem>}
                          <DropdownMenuItem onClick={() => setRenameTarget(obj)}><Edit3 className="mr-2 h-3.5 w-3.5" /> Rename</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(obj)}><Trash2 className="mr-2 h-3.5 w-3.5" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Status bar */}
          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            <span className="font-mono">{currentPathStr}</span>
            <span className="ml-3">· {currentItems.length} items</span>
          </div>
        </CardContent>
      </Card>

      {/* File preview dialog */}
      {selected && (
        <Dialog open onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {(() => { const Icon = getFileIcon(selected.name); return <Icon className="h-5 w-5 text-primary" />; })()}
                {selected.name}
              </DialogTitle>
              <DialogDescription>{selected.path}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Size</p><p className="text-sm font-bold">{formatBytes(selected.size)}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Modified</p><p className="text-sm font-bold">{timeAgo(selected.modifiedAt)}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Class</p><p className="text-sm font-bold capitalize">{selected.storageClass}</p></div>
                <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Format</p><p className="text-sm font-bold uppercase">{selected.format ?? 'N/A'}</p></div>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Preview (first 5 rows)</p>
                <ScrollArea className="h-48">
                  <div className="space-y-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex gap-2 font-mono text-xs">
                        <span className="text-muted-foreground">{String(i).padStart(3, '0')}</span>
                        <span>{selected.name}_{i}_data_sample_row_content_here</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
              <Button onClick={() => handleDownload(selected)}><Download className="mr-2 h-4 w-4" /> Download</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Create folder dialog */}
      {createFolderOpen && (
        <CreateFolderDialog
          currentPath={currentPathStr}
          onClose={() => setCreateFolderOpen(false)}
          onCreate={async (name) => {
            await api.createStorageFolder(currentPathStr, name);
            toast.success('Folder created', { description: name });
            setCreateFolderOpen(false);
            refetch();
          }}
        />
      )}

      {/* Upload dialog */}
      {uploadOpen && (
        <UploadDialog
          currentPath={currentPathStr}
          uploadProgress={uploadProgress}
          onClose={() => { setUploadOpen(false); setUploadProgress(null); }}
          onUpload={handleUpload}
        />
      )}

      {/* Rename dialog */}
      {renameTarget && (
        <RenameDialog
          currentName={renameTarget.name}
          onClose={() => setRenameTarget(null)}
          onConfirm={handleRename}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type}?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete "{deleteTarget?.name}".{deleteTarget?.type === 'folder' && ' All contents will be removed.'} This cannot be undone.</AlertDialogDescription>
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

function CreateFolderDialog({ currentPath, onClose, onCreate }: { currentPath: string; onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState('');
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create New Folder</DialogTitle><DialogDescription>in {currentPath}</DialogDescription></DialogHeader>
        <div className="space-y-2"><Label>Folder Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="folder-name" autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onCreate(name); }} /></div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => name.trim() && onCreate(name)} disabled={!name.trim()}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadDialog({ currentPath, uploadProgress, onClose, onUpload }: { currentPath: string; uploadProgress: number | null; onClose: () => void; onUpload: (name: string, size: number) => void }) {
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(1024 * 1024);
  const sizeOptions = [
    { label: '1 MB', value: 1024 * 1024 },
    { label: '10 MB', value: 10 * 1024 * 1024 },
    { label: '50 MB', value: 50 * 1024 * 1024 },
    { label: '100 MB', value: 100 * 1024 * 1024 },
  ];
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Upload File</DialogTitle><DialogDescription>to {currentPath}</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>File Name</Label>
            <Input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="data_part_0001.parquet" />
          </div>
          <div className="space-y-2">
            <Label>Simulated Size</Label>
            <div className="flex flex-wrap gap-2">
              {sizeOptions.map((s) => (
                <button key={s.value} onClick={() => setFileSize(s.value)} className={`rounded-md border px-3 py-1.5 text-xs ${fileSize === s.value ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {uploadProgress !== null && (
            <div className="space-y-1">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">Uploading... {uploadProgress}%</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => fileName.trim() && onUpload(fileName, fileSize)} disabled={!fileName.trim() || uploadProgress !== null}>
            {uploadProgress !== null ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameDialog({ currentName, onClose, onConfirm }: { currentName: string; onClose: () => void; onConfirm: (newName: string) => void }) {
  const [name, setName] = useState(currentName);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Rename</DialogTitle><DialogDescription>Enter a new name for "{currentName}"</DialogDescription></DialogHeader>
        <div className="space-y-2"><Label>New Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onConfirm(name); }} /></div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => name.trim() && onConfirm(name)} disabled={!name.trim() || name === currentName}>Rename</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
