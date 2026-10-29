import type {
  Dataset,
  IngestionSource,
  ProcessingStep,
  DataQualityReport,
  DatasetVersion,
  StorageObject,
  ProcessingJob,
  MonitoringMetrics,
  AccessUser,
  Notification,
  DataDriftReport,
  StorageCostEstimate,
  LineageNode,
  LineageEdge,
} from '@/types';
import {
  generateDatasets,
  generateIngestionSources,
  generateProcessingSteps,
  generateQualityReports,
  generateVersions,
  generateLineage,
  generateStorageTree,
  generateJobs,
  generateMetrics,
  generateUsers,
  generateNotifications,
  generateDriftReports,
  generateCostEstimates,
} from './mockData';

const STORAGE_KEY = 'datalake_state_v1';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
async function backendRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('datalake_auth_token');
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Backend request failed');
  return payload as T;
}
const DELAY = 300 + Math.random() * 400;

function delay<T>(value: T, ms = DELAY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export interface AppState {
  datasets: Dataset[];
  ingestionSources: IngestionSource[];
  processingSteps: ProcessingStep[];
  qualityReports: DataQualityReport[];
  versions: DatasetVersion[];
  storageTree: StorageObject[];
  jobs: ProcessingJob[];
  users: AccessUser[];
  notifications: Notification[];
  driftReports: DataDriftReport[];
  costEstimates: StorageCostEstimate[];
  metrics: MonitoringMetrics;
  settings: AppSettings;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  defaultStorageClass: Dataset['storageClass'];
  autoVersioning: boolean;
  qualityThreshold: number;
  notificationsEnabled: boolean;
  maxRetries: number;
  pipelineTimeoutMin: number;
  retentionDays: number;
  compressionEnabled: boolean;
  encryptionAtRest: boolean;
}

function defaultSettings(): AppSettings {
  return {
    theme: 'dark',
    defaultStorageClass: 'standard',
    autoVersioning: true,
    qualityThreshold: 80,
    notificationsEnabled: true,
    maxRetries: 3,
    pipelineTimeoutMin: 10,
    retentionDays: 90,
    compressionEnabled: true,
    encryptionAtRest: true,
  };
}

function seedState(): AppState {
  const datasets = generateDatasets(12);
  return {
    datasets,
    ingestionSources: generateIngestionSources(datasets),
    processingSteps: generateProcessingSteps(datasets),
    qualityReports: generateQualityReports(datasets),
    versions: generateVersions(datasets),
    storageTree: generateStorageTree(),
    jobs: generateJobs(20),
    users: generateUsers(),
    notifications: generateNotifications(),
    driftReports: generateDriftReports(datasets),
    costEstimates: generateCostEstimates(datasets),
    metrics: generateMetrics(),
    settings: defaultSettings(),
  };
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.datasets && parsed.datasets.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  const state = seedState();
  saveState(state);
  return state;
}

function saveState(state: AppState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

let state: AppState = loadState();

function persist() {
  saveState(state);
}

function rid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ---- Datasets ----
export const api = {
  // Datasets
  async getDatasets(): Promise<Dataset[]> {
    if (localStorage.getItem('datalake_auth_token')) return backendRequest<Dataset[]>('/datasets');
    return delay([...state.datasets]);
  },
  async getDataset(id: string): Promise<Dataset | undefined> {
    if (localStorage.getItem('datalake_auth_token')) return backendRequest<Dataset>(`/datasets/${encodeURIComponent(id)}`);
    return delay(state.datasets.find((d) => d.id === id));
  },
  async createDataset(data: Partial<Dataset>): Promise<Dataset> {
    if (localStorage.getItem('datalake_auth_token')) return backendRequest<Dataset>('/datasets', { method: 'POST', body: JSON.stringify(data) });
    const ds: Dataset = {
      id: rid('ds'),
      name: data.name ?? 'Untitled Dataset',
      description: data.description ?? '',
      format: data.format ?? 'parquet',
      status: 'draft',
      sizeBytes: 0,
      recordCount: 0,
      ownerId: 'You',
      tags: data.tags ?? [],
      schema: data.schema ?? [],
      storagePath: `s3://datalake/${(data.name ?? 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`,
      storageClass: state.settings.defaultStorageClass,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      healthScore: 100,
      qualityScore: 100,
      trainingReadiness: 0,
      version: 'v1.0',
      partitions: 1,
      encryption: state.settings.encryptionAtRest,
    };
    state.datasets.unshift(ds);
    persist();
    return delay(ds);
  },
  async updateDataset(id: string, updates: Partial<Dataset>): Promise<Dataset> {
    if (localStorage.getItem('datalake_auth_token')) return backendRequest<Dataset>(`/datasets/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(updates) });
    const ds = state.datasets.find((d) => d.id === id);
    if (!ds) throw new Error('Dataset not found');
    Object.assign(ds, updates, { updatedAt: new Date().toISOString() });
    persist();
    return delay(ds);
  },
  async deleteDataset(id: string): Promise<void> {
    if (localStorage.getItem('datalake_auth_token')) { await backendRequest<void>(`/datasets/${encodeURIComponent(id)}`, { method: 'DELETE' }); return; }
    state.datasets = state.datasets.filter((d) => d.id !== id);
    state.ingestionSources = state.ingestionSources.filter((s) => s.datasetId !== id);
    state.processingSteps = state.processingSteps.filter((s) => s.datasetId !== id);
    state.qualityReports = state.qualityReports.filter((r) => r.datasetId !== id);
    state.versions = state.versions.filter((v) => v.datasetId !== id);
    persist();
    return delay(undefined);
  },
  async uploadDatasetFile(id: string, file: { name: string; size: number }): Promise<Dataset> {
    const ds = state.datasets.find((d) => d.id === id);
    if (!ds) throw new Error('Dataset not found');
    ds.sizeBytes += file.size;
    ds.recordCount += Math.floor(file.size / 512);
    ds.updatedAt = new Date().toISOString();
    ds.status = 'active';
    persist();
    return delay(ds, 800);
  },

  // Ingestion
  async getIngestionSources(): Promise<IngestionSource[]> {
    return delay([...state.ingestionSources]);
  },
  async createIngestionSource(data: Partial<IngestionSource>): Promise<IngestionSource> {
    const src: IngestionSource = {
      id: rid('ing'),
      name: data.name ?? 'New Source',
      type: data.type ?? 's3',
      status: 'running',
      config: data.config ?? {},
      datasetId: data.datasetId ?? state.datasets[0]?.id ?? '',
      recordsProcessed: 0,
      totalRecords: randInt(10000, 1000000),
      throughputRps: randInt(500, 5000),
      failureCount: 0,
      startedAt: new Date().toISOString(),
      mode: data.mode ?? 'batch',
      logs: [{ id: rid('log'), timestamp: new Date().toISOString(), level: 'info', message: `Ingestion source created and started` }],
    };
    state.ingestionSources.unshift(src);
    persist();
    return delay(src);
  },
  async updateIngestionSource(id: string, updates: Partial<IngestionSource>): Promise<IngestionSource> {
    const src = state.ingestionSources.find((s) => s.id === id);
    if (!src) throw new Error('Source not found');
    Object.assign(src, updates);
    persist();
    return delay(src);
  },
  async toggleIngestion(id: string): Promise<IngestionSource> {
    const src = state.ingestionSources.find((s) => s.id === id);
    if (!src) throw new Error('Source not found');
    src.status = src.status === 'running' ? 'paused' : 'running';
    src.throughputRps = src.status === 'running' ? randInt(500, 5000) : 0;
    src.logs.unshift({ id: rid('log'), timestamp: new Date().toISOString(), level: 'info', message: `Source ${src.status === 'running' ? 'resumed' : 'paused'}` });
    persist();
    return delay(src);
  },
  async deleteIngestionSource(id: string): Promise<void> {
    state.ingestionSources = state.ingestionSources.filter((s) => s.id !== id);
    persist();
    return delay(undefined);
  },
  async retryIngestion(id: string): Promise<IngestionSource> {
    const src = state.ingestionSources.find((s) => s.id === id);
    if (!src) throw new Error('Source not found');
    src.status = 'running';
    src.failureCount = 0;
    src.lastError = undefined;
    src.throughputRps = randInt(500, 5000);
    src.logs.unshift({ id: rid('log'), timestamp: new Date().toISOString(), level: 'info', message: 'Retrying ingestion from last checkpoint' });
    persist();
    return delay(src);
  },

  // Processing
  async getProcessingSteps(): Promise<ProcessingStep[]> {
    return delay([...state.processingSteps]);
  },
  async createProcessingStep(data: Partial<ProcessingStep>): Promise<ProcessingStep> {
    const step: ProcessingStep = {
      id: rid('proc'),
      datasetId: data.datasetId ?? state.datasets[0]?.id ?? '',
      type: data.type ?? 'cleaning',
      name: data.name ?? `Processing step`,
      status: 'pending',
      progress: 0,
      config: data.config ?? {},
      recordsAffected: 0,
    };
    state.processingSteps.unshift(step);
    persist();
    return delay(step);
  },
  async runProcessingStep(id: string): Promise<ProcessingStep> {
    const step = state.processingSteps.find((s) => s.id === id);
    if (!step) throw new Error('Step not found');
    step.status = 'running';
    step.startedAt = new Date().toISOString();
    step.progress = 5;
    persist();
    return delay(step);
  },
  async deleteProcessingStep(id: string): Promise<void> {
    state.processingSteps = state.processingSteps.filter((s) => s.id !== id);
    persist();
    return delay(undefined);
  },

  // Quality
  async getQualityReports(): Promise<DataQualityReport[]> {
    return delay([...state.qualityReports]);
  },
  async rerunQualityReport(datasetId: string): Promise<DataQualityReport> {
    const existing = state.qualityReports.find((r) => r.datasetId === datasetId);
    if (!existing) throw new Error('Report not found');
    existing.generatedAt = new Date().toISOString();
    existing.missingValues = Math.max(0, existing.missingValues - randInt(100, 1000));
    existing.overallScore = Math.min(100, existing.overallScore + randInt(1, 5));
    existing.completeness = Math.min(100, existing.completeness + randInt(1, 3));
    persist();
    return delay(existing, 1000);
  },

  // Versions
  async getVersions(): Promise<DatasetVersion[]> {
    return delay([...state.versions]);
  },
  async createVersion(datasetId: string, label: string, changeDescription: string): Promise<DatasetVersion> {
    const ds = state.datasets.find((d) => d.id === datasetId);
    if (!ds) throw new Error('Dataset not found');
    const dsVersions = state.versions.filter((v) => v.datasetId === datasetId).sort((a, b) => b.version.localeCompare(a.version));
    const latest = dsVersions[0];
    const [major, minor] = (latest?.version ?? '1.0').split('.').map(Number);
    const newVersion = `${major}.${minor + 1}`;
    const ver: DatasetVersion = {
      id: rid('ver'),
      datasetId,
      version: newVersion,
      label,
      createdAt: new Date().toISOString(),
      createdBy: 'You',
      changeDescription,
      parentVersion: latest?.version,
      recordCount: ds.recordCount,
      sizeBytes: ds.sizeBytes,
      checksum: Math.random().toString(36).slice(2, 18),
      tags: ds.tags.slice(0, 2),
      changes: latest ? [
        { field: 'recordCount', oldValue: String(latest.recordCount), newValue: String(ds.recordCount) },
        { field: 'qualityScore', oldValue: String(ds.qualityScore - 2), newValue: String(ds.qualityScore) },
      ] : [],
    };
    ds.version = newVersion;
    state.versions.unshift(ver);
    persist();
    return delay(ver);
  },
  async deleteVersion(id: string): Promise<void> {
    state.versions = state.versions.filter((v) => v.id !== id);
    persist();
    return delay(undefined);
  },
  async restoreVersion(id: string): Promise<DatasetVersion> {
    const ver = state.versions.find((v) => v.id === id);
    if (!ver) throw new Error('Version not found');
    const ds = state.datasets.find((d) => d.id === ver.datasetId);
    if (ds) {
      ds.recordCount = ver.recordCount;
      ds.sizeBytes = ver.sizeBytes;
      ds.version = ver.version;
      ds.updatedAt = new Date().toISOString();
    }
    persist();
    return delay(ver);
  },

  // Lineage
  async getLineage(datasetId: string): Promise<{ nodes: LineageNode[]; edges: LineageEdge[] }> {
    const ds = state.datasets.find((d) => d.id === datasetId);
    if (!ds) throw new Error('Dataset not found');
    return delay(generateLineage(ds));
  },

  // Storage
  async getStorageTree(): Promise<StorageObject[]> {
    return delay(JSON.parse(JSON.stringify(state.storageTree)));
  },
  async createStorageFolder(parentPath: string, name: string): Promise<StorageObject> {
    const folder: StorageObject = {
      id: rid('dir'),
      name,
      type: 'folder',
      path: `${parentPath}${name}/`,
      size: 0,
      modifiedAt: new Date().toISOString(),
      storageClass: 'standard',
      children: [],
    };
    // Try to find parent folder
    const findAndAdd = (objs: StorageObject[]): boolean => {
      for (const obj of objs) {
        if (obj.type === 'folder' && parentPath.startsWith(obj.path)) {
          if (obj.path === parentPath) {
            obj.children = obj.children ?? [];
            obj.children.push(folder);
            return true;
          }
          if (obj.children && findAndAdd(obj.children)) return true;
        }
      }
      return false;
    };
    if (!findAndAdd(state.storageTree)) {
      state.storageTree.push(folder);
    }
    persist();
    return delay(folder);
  },
  async uploadStorageFile(parentPath: string, file: { name: string; size: number }): Promise<StorageObject> {
    const obj: StorageObject = {
      id: rid('file'),
      name: file.name,
      type: 'file',
      path: `${parentPath}${file.name}`,
      size: file.size,
      format: file.name.split('.').pop() as StorageObject['format'],
      modifiedAt: new Date().toISOString(),
      storageClass: state.settings.defaultStorageClass,
    };
    const findAndAdd = (objs: StorageObject[]): boolean => {
      for (const o of objs) {
        if (o.type === 'folder' && o.path === parentPath) {
          o.children = o.children ?? [];
          o.children.push(obj);
          return true;
        }
        if (o.children && findAndAdd(o.children)) return true;
      }
      return false;
    };
    findAndAdd(state.storageTree);
    persist();
    return delay(obj, 800);
  },
  async renameStorageObject(id: string, newName: string): Promise<void> {
    const find = (objs: StorageObject[]): StorageObject | undefined => {
      for (const o of objs) {
        if (o.id === id) return o;
        if (o.children) {
          const found = find(o.children);
          if (found) return found;
        }
      }
    };
    const obj = find(state.storageTree);
    if (obj) {
      obj.name = newName;
      obj.modifiedAt = new Date().toISOString();
    }
    persist();
    return delay(undefined);
  },
  async deleteStorageObject(id: string): Promise<void> {
    const remove = (objs: StorageObject[]): StorageObject[] => objs.filter((o) => {
      if (o.id === id) return false;
      if (o.children) o.children = remove(o.children);
      return true;
    });
    state.storageTree = remove(state.storageTree);
    persist();
    return delay(undefined);
  },

  // Jobs
  async getJobs(): Promise<ProcessingJob[]> {
    return delay([...state.jobs]);
  },
  async retryJob(id: string): Promise<ProcessingJob> {
    const job = state.jobs.find((j) => j.id === id);
    if (!job) throw new Error('Job not found');
    job.status = 'retrying';
    job.retryCount += 1;
    job.errorMessage = undefined;
    job.logs.unshift({ id: rid('jl'), timestamp: new Date().toISOString(), level: 'info', message: `Retry attempt ${job.retryCount}/${job.maxRetries}` });
    setTimeout(() => {
      job.status = 'running';
      persist();
    }, 1000);
    persist();
    return delay(job);
  },
  async cancelJob(id: string): Promise<ProcessingJob> {
    const job = state.jobs.find((j) => j.id === id);
    if (!job) throw new Error('Job not found');
    job.status = 'cancelled';
    job.logs.unshift({ id: rid('jl'), timestamp: new Date().toISOString(), level: 'warn', message: 'Job cancelled by user' });
    persist();
    return delay(job);
  },
  async rerunJob(id: string): Promise<ProcessingJob> {
    const job = state.jobs.find((j) => j.id === id);
    if (!job) throw new Error('Job not found');
    job.status = 'queued';
    job.progress = 0;
    job.retryCount = 0;
    job.errorMessage = undefined;
    job.startedAt = new Date().toISOString();
    job.logs.unshift({ id: rid('jl'), timestamp: new Date().toISOString(), level: 'info', message: 'Job requeued by user' });
    persist();
    return delay(job);
  },

  // Monitoring
  async getMetrics(): Promise<MonitoringMetrics> {
    return delay({ ...state.metrics });
  },
  async refreshMetrics(): Promise<MonitoringMetrics> {
    const m = state.metrics;
    m.cpuUsage = Math.max(10, Math.min(95, m.cpuUsage + (Math.random() - 0.5) * 10));
    m.memoryUsage = Math.max(20, Math.min(90, m.memoryUsage + (Math.random() - 0.5) * 8));
    m.networkInMbps = Math.max(100, Math.min(3000, m.networkInMbps + (Math.random() - 0.5) * 200));
    m.networkOutMbps = Math.max(50, Math.min(2500, m.networkOutMbps + (Math.random() - 0.5) * 180));
    m.processingThroughput = Math.max(5000, Math.min(100000, m.processingThroughput + (Math.random() - 0.5) * 8000));
    m.pipelineLatencyMs = Math.max(50, Math.min(800, m.pipelineLatencyMs + (Math.random() - 0.5) * 60));
    const ts = new Date().toISOString();
    m.cpuHistory = [...m.cpuHistory.slice(1), { timestamp: ts, value: Math.round(m.cpuUsage * 10) / 10 }];
    m.memoryHistory = [...m.memoryHistory.slice(1), { timestamp: ts, value: Math.round(m.memoryUsage * 10) / 10 }];
    m.networkHistory = [...m.networkHistory.slice(1), { timestamp: ts, value: Math.round(m.networkInMbps * 10) / 10 }];
    m.throughputHistory = [...m.throughputHistory.slice(1), { timestamp: ts, value: Math.round(m.processingThroughput) }];
    m.latencyHistory = [...m.latencyHistory.slice(1), { timestamp: ts, value: Math.round(m.pipelineLatencyMs) }];
    persist();
    return delay({ ...m }, 100);
  },

  // Users / Access Control
  async getUsers(): Promise<AccessUser[]> {
    return delay([...state.users]);
  },
  async createUser(data: Partial<AccessUser>): Promise<AccessUser> {
    const colors = ['#1994d6', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#fd7e14', '#20c997'];
    const user: AccessUser = {
      id: rid('usr'),
      name: data.name ?? 'New User',
      email: data.email ?? 'newuser@datalake.io',
      role: data.role ?? 'viewer',
      permissions: data.permissions ?? ['read'],
      datasetIds: data.datasetIds ?? [],
      lastActive: new Date().toISOString(),
      status: 'invited',
      avatarColor: colors[Math.floor(Math.random() * colors.length)],
    };
    state.users.push(user);
    persist();
    return delay(user);
  },
  async updateUser(id: string, updates: Partial<AccessUser>): Promise<AccessUser> {
    const user = state.users.find((u) => u.id === id);
    if (!user) throw new Error('User not found');
    Object.assign(user, updates);
    persist();
    return delay(user);
  },
  async deleteUser(id: string): Promise<void> {
    state.users = state.users.filter((u) => u.id !== id);
    persist();
    return delay(undefined);
  },

  // Notifications
  async getNotifications(): Promise<Notification[]> {
    return delay([...state.notifications]);
  },
  async markNotificationRead(id: string): Promise<void> {
    const n = state.notifications.find((n) => n.id === id);
    if (n) n.read = true;
    persist();
    return delay(undefined);
  },
  async markAllNotificationsRead(): Promise<void> {
    state.notifications.forEach((n) => (n.read = true));
    persist();
    return delay(undefined);
  },
  async addNotification(n: Omit<Notification, 'id' | 'timestamp' | 'read'>): Promise<Notification> {
    const notif: Notification = { ...n, id: rid('ntf'), timestamp: new Date().toISOString(), read: false };
    state.notifications.unshift(notif);
    persist();
    return delay(notif, 0);
  },

  // Drift
  async getDriftReports(): Promise<DataDriftReport[]> {
    return delay([...state.driftReports]);
  },

  // Cost estimates
  async getCostEstimates(): Promise<StorageCostEstimate[]> {
    return delay([...state.costEstimates]);
  },

  // Settings
  async getSettings(): Promise<AppSettings> {
    return delay({ ...state.settings });
  },
  async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    Object.assign(state.settings, updates);
    persist();
    return delay({ ...state.settings });
  },

  // Reset
  async resetData(): Promise<void> {
    state = seedState();
    persist();
    return delay(undefined);
  },
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
