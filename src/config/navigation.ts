import {
  LayoutDashboard, Database, Download, Cpu, ShieldCheck, GitBranch,
  Workflow, FolderTree, Briefcase, Activity, Users, Settings,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  group: 'overview' | 'data' | 'pipeline' | 'system';
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'overview' },
  { id: 'datasets', label: 'Dataset Management', icon: Database, group: 'data' },
  { id: 'ingestion', label: 'Data Ingestion', icon: Download, group: 'pipeline' },
  { id: 'processing', label: 'Data Processing', icon: Cpu, group: 'pipeline' },
  { id: 'quality', label: 'Data Quality', icon: ShieldCheck, group: 'data' },
  { id: 'versioning', label: 'Dataset Versioning', icon: GitBranch, group: 'data' },
  { id: 'lineage', label: 'Data Lineage', icon: Workflow, group: 'pipeline' },
  { id: 'storage', label: 'Storage Explorer', icon: FolderTree, group: 'system' },
  { id: 'jobs', label: 'Processing Jobs', icon: Briefcase, group: 'pipeline' },
  { id: 'monitoring', label: 'Monitoring', icon: Activity, group: 'system' },
  { id: 'access', label: 'Access Control', icon: Users, group: 'system' },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'system' },
];

export const NAV_GROUPS: { id: NavItem['group']; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'data', label: 'Data Management' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'system', label: 'System' },
];
