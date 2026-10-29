export type DatasetStatus = 'active' | 'archived' | 'draft' | 'processing';
export type DatasetFormat = 'parquet' | 'csv' | 'json' | 'avro' | 'orc' | 'tfrecord' | 'images' | 'text';
export type StorageClass = 'standard' | 'infrequent' | 'archive' | 'glacier';

export interface DatasetSchemaField {
  id: string;
  name: string;
  type: 'string' | 'integer' | 'float' | 'boolean' | 'datetime' | 'array' | 'object';
  nullable: boolean;
  description?: string;
}

export interface Dataset {
  id: string;
  name: string;
  description: string;
  format: DatasetFormat;
  status: DatasetStatus;
  sizeBytes: number;
  recordCount: number;
  ownerId: string;
  tags: string[];
  schema: DatasetSchemaField[];
  storagePath: string;
  storageClass: StorageClass;
  createdAt: string;
  updatedAt: string;
  healthScore: number;
  qualityScore: number;
  trainingReadiness: number;
  version: string;
  partitions: number;
  encryption: boolean;
}

export type IngestionSourceType = 's3' | 'kafka' | 'api' | 'local' | 'database';
export type IngestionStatus = 'running' | 'idle' | 'error' | 'paused' | 'completed';

export interface IngestionSource {
  id: string;
  name: string;
  type: IngestionSourceType;
  status: IngestionStatus;
  config: Record<string, string>;
  datasetId: string;
  recordsProcessed: number;
  totalRecords: number;
  throughputRps: number;
  failureCount: number;
  lastError?: string;
  startedAt: string;
  mode: 'batch' | 'streaming';
  logs: IngestionLog[];
}

export interface IngestionLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export type ProcessingType =
  | 'cleaning'
  | 'deduplication'
  | 'transformation'
  | 'partitioning'
  | 'normalization'
  | 'augmentation';

export interface ProcessingStep {
  id: string;
  datasetId: string;
  type: ProcessingType;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  config: Record<string, string>;
  startedAt?: string;
  completedAt?: string;
  recordsAffected: number;
  durationMs?: number;
  outputRows?: number;
}

export interface DataQualityReport {
  id: string;
  datasetId: string;
  overallScore: number;
  completeness: number;
  consistency: number;
  uniqueness: number;
  validity: number;
  missingValues: number;
  duplicateRows: number;
  outliers: number;
  schemaViolations: number;
  totalRows: number;
  columnStats: ColumnQualityStat[];
  generatedAt: string;
}

export interface ColumnQualityStat {
  column: string;
  type: string;
  nullCount: number;
  nullPercent: number;
  uniqueCount: number;
  duplicates: number;
  outliers: number;
  mean?: number;
  stdDev?: number;
  min?: number;
  max?: number;
}

export interface DatasetVersion {
  id: string;
  datasetId: string;
  version: string;
  label: string;
  createdAt: string;
  createdBy: string;
  changeDescription: string;
  parentVersion?: string;
  recordCount: number;
  sizeBytes: number;
  checksum: string;
  tags: string[];
  changes: VersionChange[];
}

export interface VersionChange {
  field: string;
  oldValue: string;
  newValue: string;
}

export interface LineageNode {
  id: string;
  label: string;
  type: 'source' | 'ingestion' | 'processing' | 'validation' | 'storage' | 'version' | 'training';
  datasetId?: string;
  status: 'active' | 'idle' | 'error';
  metadata: Record<string, string>;
  x: number;
  y: number;
}

export interface LineageEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface StorageObject {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  size: number;
  format?: DatasetFormat;
  modifiedAt: string;
  storageClass: StorageClass;
  children?: StorageObject[];
}

export type JobType = 'ingestion' | 'processing' | 'validation' | 'export' | 'training' | 'cleanup';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'retrying' | 'cancelled';

export interface ProcessingJob {
  id: string;
  name: string;
  type: JobType;
  status: JobStatus;
  datasetId?: string;
  workerId: string;
  priority: 'low' | 'normal' | 'high';
  progress: number;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  recordsProcessed: number;
  totalRecords: number;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  logs: JobLogEntry[];
}

export interface JobLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

export interface MetricPoint {
  timestamp: string;
  value: number;
}

export interface MonitoringMetrics {
  storageUsedGb: number;
  storageTotalGb: number;
  cpuUsage: number;
  memoryUsage: number;
  networkInMbps: number;
  networkOutMbps: number;
  processingThroughput: number;
  pipelineLatencyMs: number;
  failedJobs24h: number;
  activeWorkers: number;
  totalWorkers: number;
  storageHistory: MetricPoint[];
  cpuHistory: MetricPoint[];
  memoryHistory: MetricPoint[];
  networkHistory: MetricPoint[];
  throughputHistory: MetricPoint[];
  latencyHistory: MetricPoint[];
}

export type UserRole = 'admin' | 'data_engineer' | 'data_scientist' | 'analyst' | 'viewer';
export type Permission = 'read' | 'write' | 'delete' | 'admin' | 'export' | 'ingest';

export interface AccessUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  datasetIds: string[];
  lastActive: string;
  status: 'active' | 'suspended' | 'invited';
  avatarColor: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: string;
  read: boolean;
  source: string;
}

export interface DataDriftReport {
  datasetId: string;
  driftScore: number;
  driftDetected: boolean;
  features: { name: string; drift: number; baseline: number; current: number }[];
  lastChecked: string;
}

export interface StorageCostEstimate {
  datasetId: string;
  monthlyCost: number;
  annualCost: number;
  costPerGb: number;
  sizeGb: number;
  storageClass: StorageClass;
  optimizationPotential: number;
}
