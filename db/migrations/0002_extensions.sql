-- Migration: 0002_extensions
-- Description: Enable required PostgreSQL extensions

-- pgvector for embedding similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;


