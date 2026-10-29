import { useState, useMemo } from 'react';
import { api } from '@/services/api';
import type { AccessUser, UserRole, Permission } from '@/types';
import { useAsync } from '@/hooks/use-async';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '@/components/shared/EmptyState';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from '@/components/ui/table';
import { toast } from 'sonner';
import { timeAgo } from '@/lib/format';
import {
  Users, Plus, MoreVertical, Trash2, Edit3, Search, Shield,
  CheckCircle2, UserCog, Mail,
} from 'lucide-react';

const ROLES: UserRole[] = ['admin', 'data_engineer', 'data_scientist', 'analyst', 'viewer'];
const PERMISSIONS: Permission[] = ['read', 'write', 'delete', 'admin', 'export', 'ingest'];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: ['read', 'write', 'delete', 'admin', 'export', 'ingest'],
  data_engineer: ['read', 'write', 'export', 'ingest'],
  data_scientist: ['read', 'write', 'export'],
  analyst: ['read', 'export'],
  viewer: ['read'],
};

export function AccessControl() {
  const { data: users, loading, error, refetch } = useAsync(() => api.getUsers());
  const { data: datasets } = useAsync(() => api.getDatasets());
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AccessUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccessUser | null>(null);

  const filtered = useMemo(() => {
    let result = users ?? [];
    if (search) result = result.filter((u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.includes(search.toLowerCase()));
    if (roleFilter !== 'all') result = result.filter((u) => u.role === roleFilter);
    return result;
  }, [users, search, roleFilter]);

  const admins = users?.filter((u) => u.role === 'admin').length ?? 0;
  const activeUsers = users?.filter((u) => u.status === 'active').length ?? 0;
  const suspended = users?.filter((u) => u.status === 'suspended').length ?? 0;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await api.deleteUser(deleteTarget.id);
    toast.success('User removed', { description: deleteTarget.name });
    setDeleteTarget(null);
    refetch();
  };

  if (loading) return <LoadingState message="Loading users..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Access Control"
        description="Manage users, roles, and permissions across your data lake"
        icon={<Users className="h-5 w-5" />}
        actions={<Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> Invite User</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Users" value={users?.length ?? 0} icon={<Users className="h-4 w-4" />} accent="primary" />
        <StatCard label="Active" value={activeUsers} icon={<CheckCircle2 className="h-4 w-4" />} accent="success" />
        <StatCard label="Admins" value={admins} icon={<Shield className="h-4 w-4" />} accent="warning" />
        <StatCard label="Suspended" value={suspended} icon={<UserCog className="h-4 w-4" />} accent={suspended > 0 ? 'destructive' : 'default'} />
      </div>

      {/* Role legend */}
      <div className="flex flex-wrap items-center gap-2">
        {ROLES.map((role) => (
          <Badge key={role} variant="outline" className="capitalize gap-1.5">
            <Shield className="h-3 w-3" /> {role.replace('_', ' ')}
          </Badge>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..." className="pl-9" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Role" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={<Users className="h-7 w-7" />} title="No users found" description="Invite team members to grant them access to the data lake." /></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead><TableHead>Role</TableHead><TableHead>Permissions</TableHead><TableHead>Datasets</TableHead><TableHead>Status</TableHead><TableHead>Last Active</TableHead><TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: user.avatarColor }}>
                        {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="capitalize">{user.role.replace('_', ' ')}</Badge></TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.permissions.map((p) => <Badge key={p} variant="outline" className="text-[9px] capitalize">{p}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell><span className="text-sm">{user.datasetIds.length} datasets</span></TableCell>
                  <TableCell><StatusBadge status={user.status} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{timeAgo(user.lastActive)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditTarget(user)}><Edit3 className="mr-2 h-3.5 w-3.5" /> Edit Role & Permissions</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { api.updateUser(user.id, { status: user.status === 'suspended' ? 'active' : 'suspended' }); toast.success(user.status === 'suspended' ? 'User reactivated' : 'User suspended'); refetch(); }}>
                          {user.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.success('Invite email sent', { description: user.email })}><Mail className="mr-2 h-3.5 w-3.5" /> Resend Invite</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(user)}><Trash2 className="mr-2 h-3.5 w-3.5" /> Remove User</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create dialog */}
      {createOpen && <UserFormDialog datasets={datasets ?? []} onClose={() => setCreateOpen(false)} onSaved={() => { refetch(); setCreateOpen(false); }} />}

      {/* Edit dialog */}
      {editTarget && <UserFormDialog user={editTarget} datasets={datasets ?? []} onClose={() => setEditTarget(null)} onSaved={() => { refetch(); setEditTarget(null); }} />}

      {/* Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Remove user?</AlertDialogTitle><AlertDialogDescription>This will revoke all access for "{deleteTarget?.name}". They will no longer be able to access the data lake.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Remove</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function UserFormDialog({ user, datasets, onClose, onSaved }: { user?: AccessUser; datasets: { id: string; name: string }[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<UserRole>(user?.role ?? 'viewer');
  const [permissions, setPermissions] = useState<Permission[]>(user?.permissions ?? ['read']);
  const [datasetIds, setDatasetIds] = useState<string[]>(user?.datasetIds ?? []);
  const [saving, setSaving] = useState(false);

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    setPermissions(ROLE_PERMISSIONS[newRole]);
  };

  const togglePermission = (perm: Permission) => {
    setPermissions((prev) => prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]);
  };

  const toggleDataset = (id: string) => {
    setDatasetIds((prev) => prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]);
  };

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) { toast.error('Name and email are required'); return; }
    setSaving(true);
    try {
      if (user) {
        await api.updateUser(user.id, { name, email, role, permissions, datasetIds });
        toast.success('User updated', { description: name });
      } else {
        await api.createUser({ name, email, role, permissions, datasetIds });
        toast.success('User invited', { description: `${name} has been invited to the data lake` });
      }
      onSaved();
    } catch { toast.error('Failed to save user'); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto scrollbar-thin">
        <DialogHeader><DialogTitle>{user ? 'Edit User' : 'Invite New User'}</DialogTitle><DialogDescription>{user ? 'Update role and permissions' : 'Grant access to a team member'}</DialogDescription></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Full Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" /></div>
            <div className="space-y-2"><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@datalake.io" type="email" /></div>
          </div>
          <div className="space-y-2"><Label>Role</Label><Select value={role} onValueChange={(v) => handleRoleChange(v as UserRole)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r.replace('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2">
            <Label>Permissions</Label>
            <div className="flex flex-wrap gap-3 rounded-lg border p-3">
              {PERMISSIONS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={permissions.includes(p)} onCheckedChange={() => togglePermission(p)} />
                  <span className="capitalize">{p}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Dataset Access ({datasetIds.length} selected)</Label>
            <div className="max-h-40 overflow-y-auto scrollbar-thin space-y-2 rounded-lg border p-3">
              {datasets.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={datasetIds.includes(d.id)} onCheckedChange={() => toggleDataset(d.id)} />
                  <span className="truncate">{d.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : user ? 'Save Changes' : 'Send Invite'}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
