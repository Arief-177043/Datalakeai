import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { pool } from './db.js';

const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters.');
}

app.disable('x-powered-by');
app.use(helmet());
app.use(
  cors({
    origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
      .split(',')
      .map((s) => s.trim()),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '1mb' }));

app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Please try again later.' },
  })
);

// Multer stores uploads in memory temporarily. The route below writes them to
// server/uploads after validating ownership and the file extension.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
    files: 1,
  },
});

interface AuthRequest extends Request {
  user?: { id: string; email: string; name: string; role: string };
}

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(72),
});

const datasetSchema = z.object({
  name: z.string().trim().min(1).max(180),
  description: z.string().max(5000).optional(),
  format: z.enum(['parquet', 'csv', 'json', 'avro', 'orc', 'tfrecord', 'images', 'text']).optional(),
  status: z.enum(['active', 'archived', 'draft', 'processing']).optional(),
  tags: z.array(z.string().max(80)).max(50).optional(),
  schema: z.array(z.record(z.unknown())).max(500).optional(),
  storageClass: z.enum(['standard', 'infrequent', 'archive', 'glacier']).optional(),
  encryption: z.boolean().optional(),
  partitions: z.number().int().positive().max(100000).optional(),
});

function tokenFor(user: { id: string; email: string; name: string; role: string }) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, role: user.role },
    jwtSecret!,
    {
      expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as jwt.SignOptions['expiresIn'],
      issuer: 'datalake-ai-api',
      audience: 'datalake-ai-client',
    }
  );
}

function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const value = req.headers.authorization;

  if (!value?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(value.slice(7), jwtSecret!, {
      issuer: 'datalake-ai-api',
      audience: 'datalake-ai-client',
    }) as jwt.JwtPayload;

    if (!payload.sub) {
      return res.status(401).json({ error: 'Invalid access token.' });
    }

    req.user = {
      id: String(payload.sub),
      email: String(payload.email || ''),
      name: String(payload.name || ''),
      role: String(payload.role || 'data_engineer'),
    };

    next();
  } catch {
    return res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
  }
}

const asyncRoute =
  (fn: (req: AuthRequest, res: Response) => Promise<unknown>) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

app.get(
  '/api/health',
  asyncRoute(async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  })
);

app.post(
  '/api/auth/register',
  asyncRoute(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid registration details.',
      });
    }

    const { name, password } = parsed.data;
    const email = parsed.data.email.toLowerCase();
    const hash = await bcrypt.hash(password, 12);

    try {
      const result = await pool.query(
        'INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,role',
        [name, email, hash]
      );

      const user = result.rows[0];
      return res.status(201).json({ token: tokenFor(user), user });
    } catch (error: unknown) {
      if ((error as { code?: string }).code === '23505') {
        return res.status(409).json({
          error: 'An account with this email already exists. Please sign in.',
        });
      }
      throw error;
    }
  })
);

app.post(
  '/api/auth/login',
  asyncRoute(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: 'Enter a valid email and password.' });
    }

    const email = parsed.data.email.toLowerCase();
    const result = await pool.query(
      'SELECT id,name,email,role,password_hash FROM users WHERE email=$1',
      [email]
    );
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const publicUser = { id: user.id, name: user.name, email: user.email, role: user.role };
    return res.json({ token: tokenFor(publicUser), user: publicUser });
  })
);

app.get('/api/auth/me', auth, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

const selectDatasets = `
  SELECT
    id, name, description, format, status,
    size_bytes AS "sizeBytes",
    record_count AS "recordCount",
    owner_id AS "ownerId",
    tags, schema,
    storage_path AS "storagePath",
    storage_class AS "storageClass",
    created_at AS "createdAt",
    updated_at AS "updatedAt",
    health_score AS "healthScore",
    quality_score AS "qualityScore",
    training_readiness AS "trainingReadiness",
    version, partitions, encryption
  FROM datasets
`;

app.get(
  '/api/datasets',
  auth,
  asyncRoute(async (req: AuthRequest, res: Response) => {
    const result = await pool.query(
      `${selectDatasets} WHERE owner_id=$1 ORDER BY updated_at DESC`,
      [req.user!.id]
    );
    res.json(result.rows.map(normalizeDataset));
  })
);

app.get(
  '/api/datasets/:id',
  auth,
  asyncRoute(async (req: AuthRequest, res: Response) => {
    const result = await pool.query(
      `${selectDatasets} WHERE id=$1 AND owner_id=$2`,
      [req.params.id, req.user!.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Dataset not found.' });
    }

    res.json(normalizeDataset(result.rows[0]));
  })
);

app.post(
  '/api/datasets',
  auth,
  asyncRoute(async (req: AuthRequest, res: Response) => {
    const parsed = datasetSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid dataset details.',
      });
    }

    const d = parsed.data;
    const slug = d.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const result = await pool.query(
      `INSERT INTO datasets(
        owner_id, name, description, format, status, tags, schema,
        storage_path, storage_class, encryption, partitions
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING id`,
      [
        req.user!.id,
        d.name,
        d.description || '',
        d.format || 'parquet',
        d.status || 'draft',
        d.tags || [],
        JSON.stringify(d.schema || []),
        `s3://datalake/${slug}/`,
        d.storageClass || 'standard',
        d.encryption ?? true,
        d.partitions || 1,
      ]
    );

    const created = await pool.query(
      `${selectDatasets} WHERE id=$1 AND owner_id=$2`,
      [result.rows[0].id, req.user!.id]
    );

    res.status(201).json(normalizeDataset(created.rows[0]));
  })
);

app.patch(
  '/api/datasets/:id',
  auth,
  asyncRoute(async (req: AuthRequest, res: Response) => {
    const parsed = datasetSchema.partial().safeParse(req.body);

    if (!parsed.success || !Object.keys(parsed.data || {}).length) {
      return res.status(400).json({ error: 'Provide valid fields to update.' });
    }

    const d = parsed.data;
    const columns: Record<string, string> = {
      name: 'name',
      description: 'description',
      format: 'format',
      status: 'status',
      tags: 'tags',
      schema: 'schema',
      storageClass: 'storage_class',
      encryption: 'encryption',
      partitions: 'partitions',
    };

    const values: unknown[] = [];
    const setters: string[] = [];

    for (const [key, value] of Object.entries(d)) {
      values.push(key === 'schema' ? JSON.stringify(value) : value);
      setters.push(`${columns[key]}=$${values.length}${key === 'schema' ? '::jsonb' : ''}`);
    }

    values.push(req.params.id);
    const idIndex = values.length;
    values.push(req.user!.id);
    const ownerIndex = values.length;

    const result = await pool.query(
      `UPDATE datasets SET ${setters.join(',')}, updated_at=NOW()
       WHERE id=$${idIndex} AND owner_id=$${ownerIndex}
       RETURNING id`,
      values
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Dataset not found.' });
    }

    const updated = await pool.query(
      `${selectDatasets} WHERE id=$1 AND owner_id=$2`,
      [req.params.id, req.user!.id]
    );

    res.json(normalizeDataset(updated.rows[0]));
  })
);

app.delete(
  '/api/datasets/:id',
  auth,
  asyncRoute(async (req: AuthRequest, res: Response) => {
    const result = await pool.query(
      'DELETE FROM datasets WHERE id=$1 AND owner_id=$2',
      [req.params.id, req.user!.id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Dataset not found.' });
    }

    res.status(204).end();
  })
);

// Upload one file for an existing dataset.
// Frontend must send multipart/form-data with field name "file" and a Bearer token.
app.post(
  '/api/datasets/:id/upload',
  auth,
  upload.single('file'),
  asyncRoute(async (req: AuthRequest, res: Response) => {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Please select a file to upload.' });
    }

    const allowedExtensions = new Set([
      '.csv',
      '.json',
      '.parquet',
      '.avro',
      '.orc',
      '.tfrecord',
      '.txt',
      '.zip',
    ]);
    const extension = extname(file.originalname).toLowerCase();

    if (!allowedExtensions.has(extension)) {
      return res.status(400).json({ error: 'Unsupported file extension.' });
    }

    const datasetId = req.params.id;
    const dataset = await pool.query(
      'SELECT id FROM datasets WHERE id=$1 AND owner_id=$2',
      [datasetId, req.user!.id]
    );

    if (!dataset.rowCount) {
      return res.status(404).json({ error: 'Dataset not found or access denied.' });
    }

    const uploadDirectory = resolve(process.cwd(), 'uploads');
    const storedName = `${randomUUID()}${extension}`;
    const absolutePath = resolve(uploadDirectory, storedName);
    const relativePath = `uploads/${storedName}`;

    await mkdir(uploadDirectory, { recursive: true });
    await writeFile(absolutePath, file.buffer, { flag: 'wx' });

    try {
      await pool.query(
        `UPDATE datasets
         SET storage_path=$1, size_bytes=$2, updated_at=NOW()
         WHERE id=$3 AND owner_id=$4`,
        [relativePath, file.size, datasetId, req.user!.id]
      );
    } catch (error) {
      await unlink(absolutePath).catch(() => undefined);
      throw error;
    }

    return res.json({
      message: 'Dataset file uploaded successfully.',
      datasetId,
      fileName: file.originalname,
      sizeBytes: file.size,
      storagePath: relativePath,
    });
  })
);

// Dataset versioning routes. The dataset_versions table stores metadata snapshots.
const createVersionSchema = z.object({
  datasetId: z.string().uuid(),
  label: z.string().trim().min(1).max(180),
  changeDescription: z.string().max(5000).optional().default(''),
});

function normalizeVersion(row: Record<string, any>) {
  return {
    id: row.id,
    datasetId: row.datasetId ?? row.dataset_id,
    version: row.version,
    label: row.label,
    createdAt: new Date(row.createdAt ?? row.created_at).toISOString(),
    createdBy: row.createdBy ?? row.created_by ?? '',
    changeDescription: row.changeDescription ?? row.change_description ?? '',
    parentVersion: row.parentVersion ?? row.parent_version ?? undefined,
    recordCount: Number(row.recordCount ?? row.record_count ?? 0),
    sizeBytes: Number(row.sizeBytes ?? row.size_bytes ?? 0),
    checksum: row.checksum ?? '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    changes: Array.isArray(row.changes) ? row.changes : [],
  };
}

app.get(
  '/api/versions',
  auth,
  asyncRoute(async (req: AuthRequest, res: Response) => {
    const result = await pool.query(
      `SELECT
         v.id,
         v.dataset_id AS "datasetId",
         v.version,
         v.label,
         v.created_at AS "createdAt",
         v.created_by AS "createdBy",
         v.change_description AS "changeDescription",
         v.parent_version AS "parentVersion",
         v.record_count AS "recordCount",
         v.size_bytes AS "sizeBytes",
         v.checksum,
         v.tags,
         v.changes
       FROM dataset_versions v
       INNER JOIN datasets d ON d.id = v.dataset_id
       WHERE d.owner_id = $1
       ORDER BY v.created_at DESC`,
      [req.user!.id],
    );

    return res.json(result.rows.map(normalizeVersion));
  }),
);

app.post(
  '/api/versions',
  auth,
  asyncRoute(async (req: AuthRequest, res: Response) => {
    const parsed = createVersionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid version details.',
      });
    }

    const { datasetId, label, changeDescription } = parsed.data;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      // Serialize version creation for the same dataset to avoid duplicate numbers.
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [datasetId]);

      const datasetResult = await client.query(
        `SELECT id, name, version, record_count AS "recordCount",
                size_bytes AS "sizeBytes", tags
         FROM datasets WHERE id = $1 AND owner_id = $2 FOR UPDATE`,
        [datasetId, req.user!.id],
      );

      if (!datasetResult.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Dataset not found.' });
      }

      const dataset = datasetResult.rows[0];
      const latestResult = await client.query(
        `SELECT version, record_count AS "recordCount", size_bytes AS "sizeBytes",
                tags, changes
         FROM dataset_versions
         WHERE dataset_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [datasetId],
      );
      const latest = latestResult.rows[0];
      const currentVersion = latest?.version ?? dataset.version ?? '1.0';
      const match = String(currentVersion).match(/^v?(\d+)\.(\d+)$/);
      const major = match ? Number(match[1]) : 1;
      const minor = match ? Number(match[2]) : 0;
      const newVersion = `${major}.${minor + 1}`;
      const tags = Array.isArray(dataset.tags) ? dataset.tags : [];
      const changes = latest
        ? [{ field: 'version', from: currentVersion, to: newVersion }]
        : [{ field: 'version', from: null, to: newVersion }];

      const inserted = await client.query(
        `INSERT INTO dataset_versions (
           dataset_id, version, label, created_by, change_description,
           parent_version, record_count, size_bytes, checksum, tags, changes
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
         RETURNING
           id, dataset_id AS "datasetId", version, label,
           created_at AS "createdAt", created_by AS "createdBy",
           change_description AS "changeDescription", parent_version AS "parentVersion",
           record_count AS "recordCount", size_bytes AS "sizeBytes", checksum, tags, changes`,
        [
          datasetId,
          newVersion,
          label,
          req.user!.email || req.user!.name || 'User',
          changeDescription,
          latest?.version ?? null,
          Number(dataset.recordCount || 0),
          Number(dataset.sizeBytes || 0),
          randomUUID().replace(/-/g, ''),
          tags,
          JSON.stringify(changes),
        ],
      );

      await client.query(
        'UPDATE datasets SET version = $1, updated_at = NOW() WHERE id = $2 AND owner_id = $3',
        [newVersion, datasetId, req.user!.id],
      );
      await client.query('COMMIT');
      return res.status(201).json(normalizeVersion(inserted.rows[0]));
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }),
);

app.delete(
  '/api/versions/:id',
  auth,
  asyncRoute(async (req: AuthRequest, res: Response) => {
    const result = await pool.query(
      `DELETE FROM dataset_versions v
       USING datasets d
       WHERE v.dataset_id = d.id
         AND v.id = $1
         AND d.owner_id = $2`,
      [req.params.id, req.user!.id],
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: 'Version not found.' });
    }
    return res.status(204).end();
  }),
);

app.post(
  '/api/versions/:id/restore',
  auth,
  asyncRoute(async (req: AuthRequest, res: Response) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const versionResult = await client.query(
        `SELECT v.id, v.dataset_id AS "datasetId", v.version, v.label,
                v.created_at AS "createdAt", v.created_by AS "createdBy",
                v.change_description AS "changeDescription", v.parent_version AS "parentVersion",
                v.record_count AS "recordCount", v.size_bytes AS "sizeBytes",
                v.checksum, v.tags, v.changes
         FROM dataset_versions v
         INNER JOIN datasets d ON d.id = v.dataset_id
         WHERE v.id = $1 AND d.owner_id = $2
         FOR UPDATE OF d`,
        [req.params.id, req.user!.id],
      );

      if (!versionResult.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Version not found.' });
      }

      const version = versionResult.rows[0];
      await client.query(
        `UPDATE datasets
         SET version = $1, record_count = $2, size_bytes = $3, tags = $4, updated_at = NOW()
         WHERE id = $5 AND owner_id = $6`,
        [version.version, version.recordCount, version.sizeBytes, version.tags || [], version.datasetId, req.user!.id],
      );
      await client.query('COMMIT');
      return res.json(normalizeVersion(version));
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }),
);

function normalizeDataset(row: Record<string, any>) {
  return {
    ...row,
    sizeBytes: Number(row.sizeBytes || 0),
    recordCount: Number(row.recordCount || 0),
    partitions: Number(row.partitions || 1),
    healthScore: Number(row.healthScore ?? 100),
    qualityScore: Number(row.qualityScore ?? 100),
    trainingReadiness: Number(row.trainingReadiness ?? 0),
    ownerId: row.ownerId,
    storageClass: row.storageClass,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

// Keep the 404 handler after all routes.
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));

// Multer can raise errors before the async route handler runs.
app.use(
  (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof multer.MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      const message =
        error.code === 'LIMIT_FILE_SIZE'
          ? 'File exceeds the 100 MB upload limit.'
          : error.message;
      return res.status(status).json({ error: message });
    }

    console.error(
      'API error:',
      error instanceof Error ? error.message : 'Unknown error'
    );

    return res.status(500).json({
      error:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error.'
          : error instanceof Error
            ? error.message
            : 'Internal server error.',
    });
  }
);

const server = app.listen(port, () => {
  console.log(`DataLake AI API listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close();
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
