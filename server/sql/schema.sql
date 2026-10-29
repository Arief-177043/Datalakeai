CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'data_engineer' CHECK (role IN ('admin','data_engineer','data_scientist','analyst','viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS users_email_lower_idx ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  format VARCHAR(24) NOT NULL DEFAULT 'parquet' CHECK (format IN ('parquet','csv','json','avro','orc','tfrecord','images','text')),
  status VARCHAR(24) NOT NULL DEFAULT 'draft' CHECK (status IN ('active','archived','draft','processing')),
  size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  record_count BIGINT NOT NULL DEFAULT 0 CHECK (record_count >= 0),
  tags TEXT[] NOT NULL DEFAULT '{}',
  schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  storage_path TEXT NOT NULL DEFAULT '',
  storage_class VARCHAR(24) NOT NULL DEFAULT 'standard' CHECK (storage_class IN ('standard','infrequent','archive','glacier')),
  health_score INTEGER NOT NULL DEFAULT 100 CHECK (health_score BETWEEN 0 AND 100),
  quality_score INTEGER NOT NULL DEFAULT 100 CHECK (quality_score BETWEEN 0 AND 100),
  training_readiness INTEGER NOT NULL DEFAULT 0 CHECK (training_readiness BETWEEN 0 AND 100),
  version VARCHAR(32) NOT NULL DEFAULT 'v1.0',
  partitions INTEGER NOT NULL DEFAULT 1 CHECK (partitions > 0),
  encryption BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS datasets_owner_updated_idx ON datasets(owner_id, updated_at DESC);
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS dataset_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL
        REFERENCES datasets(id) ON DELETE CASCADE,
    version VARCHAR(30) NOT NULL,
    label VARCHAR(180) NOT NULL,
    change_description TEXT NOT NULL DEFAULT '',
    created_by VARCHAR(254) NOT NULL DEFAULT '',
    record_count BIGINT NOT NULL DEFAULT 0,
    size_bytes BIGINT NOT NULL DEFAULT 0,
    checksum VARCHAR(100) NOT NULL DEFAULT '',
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (dataset_id, version)
);

CREATE INDEX IF NOT EXISTS idx_dataset_versions_dataset_id
ON dataset_versions(dataset_id, created_at DESC);