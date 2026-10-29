import type {
  Dataset,
  IngestionSource,
  ProcessingStep,
  DataQualityReport,
  DatasetVersion,
  LineageNode,
  LineageEdge,
  StorageObject,
  ProcessingJob,
  MonitoringMetrics,
  AccessUser,
  Notification,
  DataDriftReport,
  StorageCostEstimate,
  MetricPoint,
} from '@/types';

const now = Date.now();
const iso = (offsetMs: number) => new Date(now - offsetMs).toISOString();

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const TAGS = [
  'nlp', 'vision', 'tabular', 'timeseries', 'audio', 'multimodal',
  'healthcare', 'finance', 'retail', 'autonomous', 'production', 'experimental',
];

const FORMATS: Dataset['format'][] = ['parquet', 'csv', 'json', 'avro', 'orc', 'tfrecord', 'images', 'text'];

const DATASET_NAMES = [
  'ImageNet-Custom-22K', 'Customer-Churn-v3', 'Medical-Imaging-CXR', 'Financial-Tick-Data',
  'Sentiment-Corpus-Multi', 'Retail-Transactions-2024', 'Autonomous-Driving-Lidar',
  'Conversational-Dialogues', 'Product-Reviews-Amazon', 'Genomics-Sequence-DB',
  'Weather-Sensor-IoT', 'Legal-Document-Archive', 'Robotics-Grasp-Demo', 'Speech-To-Text-Audio',
  'ECommerce-Behavior-Logs',
];

const USER_NAMES = [
  'Sarah Chen', 'Marcus Webb', 'Aisha Patel', 'Diego Ramirez', 'Yuki Tanaka',
  'Olivia Foster', 'Kwame Mensah', 'Elena Petrov',
];

export function generateDatasets(count = 12): Dataset[] {
  return Array.from({ length: count }, (_, i) => {
    const name = DATASET_NAMES[i % DATASET_NAMES.length];
    const recordCount = randInt(10_000, 50_000_000);
    const sizeBytes = recordCount * randInt(200, 5000);
    const tagCount = randInt(2, 5);
    const tags = [...new Set(Array.from({ length: tagCount }, () => pick(TAGS)))];
    const fieldCount = randInt(4, 10);
    const schema = Array.from({ length: fieldCount }, (_, fi) => ({
      id: `fld_${i}_${fi}`,
      name: pick(['id', 'timestamp', 'label', 'feature_1', 'feature_2', 'category',
        'value', 'score', 'text', 'image_url', 'embedding', 'user_id', 'amount', 'status', 'region']),
      type: pick(['string', 'integer', 'float', 'boolean', 'datetime', 'array', 'object']) as Dataset['schema'][0]['type'],
      nullable: Math.random() > 0.4,
      description: `Field ${fi + 1} of ${name}`,
    }));

    return {
      id: `ds_${i + 1}`,
      name,
      description: `Curated ${name.toLowerCase()} dataset for AI model training and evaluation. Contains ${recordCount.toLocaleString()} records across multiple partitions.`,
      format: FORMATS[i % FORMATS.length],
      status: pick(['active', 'active', 'active', 'archived', 'draft', 'processing']) as Dataset['status'],
      sizeBytes,
      recordCount,
      ownerId: pick(USER_NAMES),
      tags,
      schema,
      storagePath: `s3://datalake/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}/`,
      storageClass: pick(['standard', 'standard', 'infrequent', 'archive']) as Dataset['storageClass'],
      createdAt: iso(randInt(1, 90) * 86400_000),
      updatedAt: iso(randInt(1, 72) * 3600_000),
      healthScore: randInt(65, 99),
      qualityScore: randInt(60, 98),
      trainingReadiness: randInt(40, 95),
      version: `v${randInt(1, 3)}.${randInt(0, 9)}.${randInt(0, 2)}`,
      partitions: randInt(1, 64),
      encryption: Math.random() > 0.3,
    } satisfies Dataset;
  });
}

export function generateIngestionSources(datasets: Dataset[]): IngestionSource[] {
  const types: IngestionSource['type'][] = ['s3', 'kafka', 'api', 'local', 'database'];
  return datasets.slice(0, 10).map((ds, i) => {
    const type = types[i % types.length];
    const total = ds.recordCount;
    const processed = type === 'database' ? total : randInt(Math.floor(total * 0.3), total);
    const status: IngestionSource['status'] = processed >= total
      ? pick(['completed', 'idle', 'completed'])
      : pick(['running', 'running', 'paused', 'error', 'idle']);
    const logs = Array.from({ length: randInt(5, 15) }, (_, li) => ({
      id: `log_${i}_${li}`,
      timestamp: iso(li * 60_000),
      level: pick(['info', 'info', 'info', 'warn', 'error']) as IngestionSource['logs'][0]['level'],
      message: pick([
        `Connected to ${type} source, streaming records...`,
        `Batch ${li + 1} processed: ${randInt(1000, 50000)} records`,
        `Throughput: ${randInt(500, 5000)} records/sec`,
        `Schema validation passed for batch ${li + 1}`,
        `Retrying failed partition after timeout`,
        `Checkpoint saved at offset ${randInt(10000, 999999)}`,
        `Warning: slow response from upstream, latency ${randInt(200, 800)}ms`,
      ]),
    }));

    return {
      id: `ing_${i + 1}`,
      name: `${type.toUpperCase()}-Source-${ds.name.slice(0, 12)}`,
      type,
      status,
      config: (type === 'kafka'
        ? { broker: 'kafka-cluster:9092', topic: `input.${ds.name.toLowerCase()}`, group: 'dl-consumers' }
        : type === 's3'
        ? { bucket: 'raw-data-lake', prefix: `incoming/${ds.name.toLowerCase()}/`, region: 'us-east-1' }
        : type === 'api'
        ? { endpoint: `https://api.source.io/v1/data/${ds.id}`, auth: 'OAuth2', pollInterval: '60s' }
        : type === 'database'
        ? { host: 'pg-primary.internal', port: '5432', database: 'source_db', table: ds.name.toLowerCase() }
        : { path: `/data/uploads/${ds.name.toLowerCase()}/`, format: ds.format }) as Record<string, string>,
      datasetId: ds.id,
      recordsProcessed: processed,
      totalRecords: total,
      throughputRps: status === 'running' ? randInt(500, 8000) : 0,
      failureCount: status === 'error' ? randInt(5, 50) : randInt(0, 5),
      lastError: status === 'error' ? 'Connection timeout: upstream source unreachable after 30s' : undefined,
      startedAt: iso(randInt(1, 48) * 3600_000),
      mode: type === 'kafka' || type === 'api' ? 'streaming' : 'batch',
      logs,
    } satisfies IngestionSource;
  });
}

export function generateProcessingSteps(datasets: Dataset[]): ProcessingStep[] {
  const types: ProcessingStep['type'][] = [
    'cleaning', 'deduplication', 'transformation', 'partitioning', 'normalization', 'augmentation',
  ];
  const steps: ProcessingStep[] = [];
  datasets.slice(0, 8).forEach((ds, i) => {
    const stepCount = randInt(2, 5);
    for (let s = 0; s < stepCount; s++) {
      const type = types[(i + s) % types.length];
      const status: ProcessingStep['status'] = pick(['completed', 'completed', 'running', 'pending', 'failed']);
      steps.push({
        id: `proc_${i}_${s}`,
        datasetId: ds.id,
        type,
        name: `${type.charAt(0).toUpperCase() + type.slice(1)} — ${ds.name.slice(0, 15)}`,
        status,
        progress: status === 'completed' ? 100 : status === 'running' ? randInt(20, 90) : 0,
        config: { strategy: pick(['mean', 'median', 'drop', 'knn']), threshold: '0.05', batchSize: '10000' },
        startedAt: status !== 'pending' ? iso(randInt(1, 24) * 3600_000) : undefined,
        completedAt: status === 'completed' ? iso(randInt(1, 20) * 3600_000) : undefined,
        recordsAffected: randInt(1000, ds.recordCount),
        durationMs: status === 'completed' ? randInt(5_000, 300_000) : undefined,
        outputRows: status === 'completed' ? randInt(Math.floor(ds.recordCount * 0.9), ds.recordCount) : undefined,
      });
    }
  });
  return steps;
}

export function generateQualityReports(datasets: Dataset[]): DataQualityReport[] {
  return datasets.map((ds, i) => {
    const totalRows = ds.recordCount;
    const missingValues = randInt(0, Math.floor(totalRows * 0.05));
    const duplicateRows = randInt(0, Math.floor(totalRows * 0.02));
    const outliers = randInt(0, Math.floor(totalRows * 0.03));
    const schemaViolations = randInt(0, Math.floor(totalRows * 0.01));
    const completeness = Math.round(100 - (missingValues / totalRows) * 100);
    const uniqueness = Math.round(100 - (duplicateRows / totalRows) * 100);
    const validity = Math.round(100 - (schemaViolations / totalRows) * 100);
    const consistency = Math.round(100 - (outliers / totalRows) * 100);
    const overall = Math.round((completeness + uniqueness + validity + consistency) / 4);

    return {
      id: `qr_${i + 1}`,
      datasetId: ds.id,
      overallScore: overall,
      completeness,
      consistency,
      uniqueness,
      validity,
      missingValues,
      duplicateRows,
      outliers,
      schemaViolations,
      totalRows,
      columnStats: ds.schema.slice(0, 6).map((f) => ({
        column: f.name,
        type: f.type,
        nullCount: randInt(0, Math.floor(totalRows * 0.1)),
        nullPercent: Math.round(Math.random() * 10 * 100) / 100,
        uniqueCount: randInt(Math.floor(totalRows * 0.5), totalRows),
        duplicates: randInt(0, Math.floor(totalRows * 0.05)),
        outliers: f.type === 'float' || f.type === 'integer' ? randInt(0, Math.floor(totalRows * 0.04)) : 0,
        mean: f.type === 'float' || f.type === 'integer' ? Math.round(Math.random() * 1000 * 100) / 100 : undefined,
        stdDev: f.type === 'float' || f.type === 'integer' ? Math.round(Math.random() * 100 * 100) / 100 : undefined,
        min: f.type === 'float' || f.type === 'integer' ? randInt(0, 100) : undefined,
        max: f.type === 'float' || f.type === 'integer' ? randInt(100, 10000) : undefined,
      })),
      generatedAt: iso(randInt(1, 48) * 3600_000),
    } satisfies DataQualityReport;
  });
}

export function generateVersions(datasets: Dataset[]): DatasetVersion[] {
  const versions: DatasetVersion[] = [];
  datasets.forEach((ds) => {
    const major = randInt(1, 3);
    const minorCount = randInt(2, 5);
    for (let m = 0; m <= minorCount; m++) {
      const v = `${major}.${m}`;
      versions.push({
        id: `ver_${ds.id}_${m}`,
        datasetId: ds.id,
        version: v,
        label: m === 0 ? 'Initial Release' : m === minorCount ? 'Latest' : `Update ${m}`,
        createdAt: iso((minorCount - m) * 86400_000 * 7),
        createdBy: pick(USER_NAMES),
        changeDescription: pick([
          'Added 50K new records from latest ingestion batch',
          'Cleaned duplicate entries, improved schema validation',
          'Normalized feature columns, fixed encoding issues',
          'Repartitioned for optimal query performance',
          'Augmented dataset with synthetic samples',
        ]),
        parentVersion: m > 0 ? `${major}.${m - 1}` : undefined,
        recordCount: Math.floor(ds.recordCount * (0.7 + m * 0.08)),
        sizeBytes: Math.floor(ds.sizeBytes * (0.7 + m * 0.08)),
        checksum: Math.random().toString(36).slice(2, 18),
        tags: ds.tags.slice(0, 2),
        changes: m > 0 ? [
          { field: 'recordCount', oldValue: String(Math.floor(ds.recordCount * (0.7 + (m - 1) * 0.08))), newValue: String(Math.floor(ds.recordCount * (0.7 + m * 0.08))) },
          { field: 'schema', oldValue: `${ds.schema.length - 1} fields`, newValue: `${ds.schema.length} fields` },
        ] : [],
      });
    }
  });
  return versions;
}

export function generateLineage(dataset: Dataset): { nodes: LineageNode[]; edges: LineageEdge[] } {
  const nodes: LineageNode[] = [
    { id: 'src', label: dataset.name + ' Source', type: 'source', status: 'active', x: 50, y: 250, metadata: { type: 'S3 Bucket', records: dataset.recordCount.toLocaleString() } },
    { id: 'ing', label: 'Ingestion Pipeline', type: 'ingestion', datasetId: dataset.id, status: 'active', x: 250, y: 250, metadata: { source: 'Kafka', mode: 'Streaming', throughput: '4.2K rps' } },
    { id: 'proc', label: 'Processing', type: 'processing', datasetId: dataset.id, status: 'active', x: 450, y: 150, metadata: { steps: '6', type: 'Cleaning + Transform' } },
    { id: 'aug', label: 'Augmentation', type: 'processing', datasetId: dataset.id, status: 'idle', x: 450, y: 350, metadata: { type: 'Synthetic', status: 'Optional' } },
    { id: 'val', label: 'Validation', type: 'validation', datasetId: dataset.id, status: 'active', x: 650, y: 250, metadata: { score: String(dataset.qualityScore), rules: '24 checks' } },
    { id: 'stor', label: 'Data Lake (S3)', type: 'storage', datasetId: dataset.id, status: 'active', x: 850, y: 250, metadata: { class: dataset.storageClass, encrypted: String(dataset.encryption) } },
    { id: 'ver', label: `Version ${dataset.version}`, type: 'version', datasetId: dataset.id, status: 'active', x: 1050, y: 250, metadata: { version: dataset.version, checksum: 'a3f9...' } },
    { id: 'train', label: 'AI Training', type: 'training', datasetId: dataset.id, status: 'active', x: 1250, y: 250, metadata: { model: 'transformer-v2', readiness: String(dataset.trainingReadiness) } },
  ];
  const edges: LineageEdge[] = [
    { id: 'e1', from: 'src', to: 'ing', label: 'raw data' },
    { id: 'e2', from: 'ing', to: 'proc', label: 'batch' },
    { id: 'e3', from: 'ing', to: 'aug', label: 'stream' },
    { id: 'e4', from: 'proc', to: 'val' },
    { id: 'e5', from: 'aug', to: 'val' },
    { id: 'e6', from: 'val', to: 'stor', label: 'validated' },
    { id: 'e7', from: 'stor', to: 'ver' },
    { id: 'e8', from: 'ver', to: 'train', label: 'training set' },
  ];
  return { nodes, edges };
}

export function generateStorageTree(): StorageObject[] {
  const folders = [
    { name: 'raw-data', count: 15 },
    { name: 'processed', count: 20 },
    { name: 'validated', count: 12 },
    { name: 'archives', count: 8 },
    { name: 'temp-uploads', count: 5 },
    { name: 'exports', count: 6 },
  ];
  return folders.map((f) => ({
    id: rid('dir'),
    name: f.name,
    type: 'folder' as const,
    path: `s3://datalake/${f.name}/`,
    size: 0,
    modifiedAt: iso(randInt(1, 48) * 3600_000),
    storageClass: 'standard' as const,
    children: Array.from({ length: f.count }, (_, ci) => ({
      id: rid('file'),
      name: `${f.name}_part_${String(ci).padStart(4, '0')}.${pick(['parquet', 'csv', 'json', 'avro'])}`,
      type: 'file' as const,
      path: `s3://datalake/${f.name}/${f.name}_part_${String(ci).padStart(4, '0')}`,
      size: randInt(1024 * 1024, 1024 * 1024 * 500),
      format: pick(['parquet', 'csv', 'json', 'avro']) as StorageObject['format'],
      modifiedAt: iso(randInt(1, 48) * 3600_000),
      storageClass: pick(['standard', 'standard', 'infrequent', 'archive']) as StorageObject['storageClass'],
    })),
  }));
}

export function generateJobs(count = 20): ProcessingJob[] {
  const types: ProcessingJob['type'][] = ['ingestion', 'processing', 'validation', 'export', 'training', 'cleanup'];
  const statuses: ProcessingJob['status'][] = ['queued', 'running', 'completed', 'completed', 'failed', 'retrying', 'cancelled'];
  return Array.from({ length: count }, (_, i) => {
    const status = pick(statuses);
    const total = randInt(10_000, 5_000_000);
    const processed = status === 'completed' ? total : status === 'running' ? Math.floor(total * Math.random()) : status === 'queued' ? 0 : randInt(0, total);
    return {
      id: `job_${String(i + 1).padStart(3, '0')}`,
      name: `${pick(['Ingest', 'Process', 'Validate', 'Export', 'Train', 'Cleanup'])} — ${pick(DATASET_NAMES).slice(0, 15)}`,
      type: types[i % types.length],
      status,
      datasetId: `ds_${randInt(1, 12)}`,
      workerId: `worker-${randInt(1, 8)}`,
      priority: pick(['low', 'normal', 'normal', 'high']) as ProcessingJob['priority'],
      progress: status === 'completed' ? 100 : status === 'running' ? randInt(10, 95) : 0,
      startedAt: iso(randInt(1, 24) * 3600_000),
      completedAt: status === 'completed' ? iso(randInt(1, 12) * 3600_000) : undefined,
      durationMs: status === 'completed' ? randInt(5_000, 600_000) : undefined,
      recordsProcessed: processed,
      totalRecords: total,
      errorMessage: status === 'failed' ? pick([
        'OutOfMemoryError: worker exceeded 8GB limit during shuffle',
        'SchemaValidationException: column "timestamp" has invalid format',
        'ConnectionRefused: upstream S3 bucket not accessible',
        'TimeoutError: processing exceeded 10 minute limit',
      ]) : undefined,
      retryCount: status === 'retrying' ? randInt(1, 3) : 0,
      maxRetries: 3,
      logs: Array.from({ length: randInt(8, 20) }, (_, li) => ({
        id: `jl_${i}_${li}`,
        timestamp: iso(li * 30_000),
        level: pick(['info', 'info', 'info', 'debug', 'warn', 'error']) as ProcessingJob['logs'][0]['level'],
        message: pick([
          `Job initialized on ${pick(['worker-1', 'worker-2', 'worker-3'])}`,
          `Processing batch ${li + 1}: ${randInt(1000, 50000)} records`,
          `Memory usage: ${randInt(30, 90)}%`,
          `Writing output partition ${li}`,
          `Checkpoint saved`,
          `Warning: slow disk I/O detected`,
          `Completed stage ${li} in ${randInt(100, 5000)}ms`,
        ]),
      })),
    } satisfies ProcessingJob;
  });
}

function genMetricHistory(points: number, min: number, max: number, variance: number): MetricPoint[] {
  let current = (min + max) / 2;
  return Array.from({ length: points }, (_, i) => {
    current += (Math.random() - 0.5) * variance;
    current = Math.max(min, Math.min(max, current));
    return { timestamp: iso((points - i) * 5 * 60_000), value: Math.round(current * 10) / 10 };
  });
}

export function generateMetrics(): MonitoringMetrics {
  return {
    storageUsedGb: 4280,
    storageTotalGb: 10240,
    cpuUsage: 67,
    memoryUsage: 58,
    networkInMbps: 1240,
    networkOutMbps: 890,
    processingThroughput: 42000,
    pipelineLatencyMs: 240,
    failedJobs24h: 7,
    activeWorkers: 6,
    totalWorkers: 8,
    storageHistory: genMetricHistory(24, 3800, 4500, 50),
    cpuHistory: genMetricHistory(24, 20, 90, 15),
    memoryHistory: genMetricHistory(24, 30, 85, 12),
    networkHistory: genMetricHistory(24, 200, 2000, 300),
    throughputHistory: genMetricHistory(24, 10000, 80000, 10000),
    latencyHistory: genMetricHistory(24, 100, 600, 80),
  };
}

export function generateUsers(): AccessUser[] {
  const roles: AccessUser['role'][] = ['admin', 'data_engineer', 'data_scientist', 'analyst', 'viewer'];
  const colors = ['#1994d6', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#fd7e14', '#20c997', '#e83e8c'];
  const permMap: Record<AccessUser['role'], AccessUser['permissions']> = {
    admin: ['read', 'write', 'delete', 'admin', 'export', 'ingest'],
    data_engineer: ['read', 'write', 'export', 'ingest'],
    data_scientist: ['read', 'write', 'export'],
    analyst: ['read', 'export'],
    viewer: ['read'],
  };
  return USER_NAMES.map((name, i) => ({
    id: `usr_${i + 1}`,
    name,
    email: name.toLowerCase().replace(/[^a-z]+/g, '.') + '@datalake.io',
    role: i === 0 ? 'admin' : pick(roles),
    permissions: permMap[i === 0 ? 'admin' : pick(roles)],
    datasetIds: [`ds_${randInt(1, 12)}`, `ds_${randInt(1, 12)}`, `ds_${randInt(1, 12)}`],
    lastActive: iso(randInt(1, 72) * 3600_000),
    status: pick(['active', 'active', 'active', 'suspended', 'invited']) as AccessUser['status'],
    avatarColor: colors[i % colors.length],
  }));
}

export function generateNotifications(): Notification[] {
  return [
    { id: rid('ntf'), title: 'Ingestion Pipeline Alert', message: 'Kafka source for Financial-Tick-Data has high failure rate (12 failures in 5 min)', type: 'warning', timestamp: iso(5 * 60_000), read: false, source: 'Ingestion Monitor' },
    { id: rid('ntf'), title: 'Processing Complete', message: 'Cleaning step for Medical-Imaging-CXR completed successfully (2.3M records)', type: 'success', timestamp: iso(25 * 60_000), read: false, source: 'Processing Engine' },
    { id: rid('ntf'), title: 'Data Drift Detected', message: 'Customer-Churn-v3 shows 34% feature drift from baseline — retraining recommended', type: 'error', timestamp: iso(60 * 60_000), read: false, source: 'Drift Detector' },
    { id: rid('ntf'), title: 'New Version Published', message: 'ImageNet-Custom-22K v2.4 has been published by Sarah Chen', type: 'info', timestamp: iso(3 * 3600_000), read: true, source: 'Versioning Service' },
    { id: rid('ntf'), title: 'Storage Threshold', message: 'Storage usage at 42% (4.2TB / 10TB). Consider archiving cold data.', type: 'info', timestamp: iso(6 * 3600_000), read: true, source: 'Storage Monitor' },
    { id: rid('ntf'), title: 'Job Failed', message: 'Export job #017 failed: OutOfMemoryError on worker-3', type: 'error', timestamp: iso(8 * 3600_000), read: true, source: 'Job Scheduler' },
    { id: rid('ntf'), title: 'Quality Report Ready', message: 'Quality analysis for Retail-Transactions-2024 is available (score: 87)', type: 'info', timestamp: iso(12 * 3600_000), read: true, source: 'Quality Engine' },
  ];
}

export function generateDriftReports(datasets: Dataset[]): DataDriftReport[] {
  return datasets.slice(0, 8).map((ds) => {
    const featureCount = randInt(3, 6);
    const features = Array.from({ length: featureCount }, (_, fi) => {
      const baseline = Math.round(Math.random() * 100 * 100) / 100;
      const current = Math.round((baseline + (Math.random() - 0.5) * 40) * 100) / 100;
      return {
        name: ds.schema[fi]?.name ?? `feature_${fi}`,
        drift: Math.round(Math.abs(current - baseline) / Math.max(baseline, 1) * 100 * 100) / 100,
        baseline,
        current,
      };
    });
    const driftScore = Math.round(features.reduce((a, f) => a + f.drift, 0) / features.length);
    return {
      datasetId: ds.id,
      driftScore,
      driftDetected: driftScore > 20,
      features,
      lastChecked: iso(randInt(1, 24) * 3600_000),
    } satisfies DataDriftReport;
  });
}

export function generateCostEstimates(datasets: Dataset[]): StorageCostEstimate[] {
  const costPerGb: Record<Dataset['storageClass'], number> = {
    standard: 0.023,
    infrequent: 0.0125,
    archive: 0.004,
    glacier: 0.00099,
  };
  return datasets.map((ds) => {
    const sizeGb = ds.sizeBytes / (1024 ** 3);
    const costPerGbVal = costPerGb[ds.storageClass];
    const monthlyCost = Math.round(sizeGb * costPerGbVal * 100) / 100;
    return {
      datasetId: ds.id,
      monthlyCost,
      annualCost: Math.round(monthlyCost * 12 * 100) / 100,
      costPerGb: costPerGbVal,
      sizeGb: Math.round(sizeGb * 100) / 100,
      storageClass: ds.storageClass,
      optimizationPotential: Math.round((costPerGbVal - 0.004) * sizeGb * 100) / 100,
    } satisfies StorageCostEstimate;
  });
}
