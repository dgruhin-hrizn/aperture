import { z } from 'zod'

const envSchema = z.object({
  // Core runtime settings
  PORT: z.coerce.number().default(3456),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // SESSION_SECRET: defaults for easy startup, but should be set in production
  SESSION_SECRET: z.string().min(32).default('CHANGE-ME-IN-PRODUCTION-32-CHARS'),
  // APP_BASE_URL: defaults to localhost, should be set for production/external access
  APP_BASE_URL: z.string().url().default('http://localhost:3456'),

  // Database (required)
  DATABASE_URL: z.string().url(),

  // Filesystem paths (not UI-configurable, must be set via env for Docker volume mounts)
  MEDIA_SERVER_STRM_ROOT: z.string().default('/strm'),
  MEDIA_SERVER_LIBRARY_ROOT: z.string().default('/mnt/media'),
  AI_LIBRARY_PATH_PREFIX: z.string().default('/strm/aperture/'),

  // Job schedules (optional - have sensible defaults)
  SYNC_CRON: z.string().default('0 3 * * *'),
  RECS_CRON: z.string().default('0 4 * * *'),
  PERMS_CRON: z.string().default('0 5 * * *'),

  // Runtime flags
  RUN_MIGRATIONS_ON_START: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),

  // NOTE: The following are NOT in this schema because they are UI-configurable
  // and read directly from process.env as fallbacks in systemSettings.ts:
  // - OPENAI_API_KEY, OPENAI_EMBED_MODEL (Settings > AI)
  // - MEDIA_SERVER_TYPE, MEDIA_SERVER_BASE_URL, MEDIA_SERVER_API_KEY (Settings > Media Server)
  // - AI_LIBRARY_NAME_PREFIX (Settings > Libraries)
})

export type Env = z.infer<typeof envSchema>

let cachedEnv: Env | null = null

export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv
  }

  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('❌ Invalid environment variables:')
    console.error(result.error.format())
    throw new Error('Invalid environment variables')
  }

  cachedEnv = result.data

  // Warn about insecure defaults in production
  if (cachedEnv.NODE_ENV === 'production') {
    if (cachedEnv.SESSION_SECRET === 'CHANGE-ME-IN-PRODUCTION-32-CHARS') {
      console.warn(
        '⚠️  WARNING: Using default SESSION_SECRET in production! Set a secure random value.'
      )
    }
    if (cachedEnv.APP_BASE_URL === 'http://localhost:3456') {
      console.warn(
        '⚠️  WARNING: APP_BASE_URL is set to localhost. Update this for external access.'
      )
    }
  }

  return cachedEnv
}

export function validateEnv(): Env {
  return getEnv()
}

// Helper to check if we're in production
export function isProduction(): boolean {
  return getEnv().NODE_ENV === 'production'
}

// Helper to check if we're in development
export function isDevelopment(): boolean {
  return getEnv().NODE_ENV === 'development'
}

// Helper to get DATABASE_URL adjusted for local development
// When running outside Docker, replace 'db' hostname with 'localhost'
export function getDatabaseUrl(): string {
  const url = getEnv().DATABASE_URL
  // If DOCKER_ENV is set, we're in Docker and should use the URL as-is
  // Otherwise, replace @db: with @localhost: for local development
  if (process.env.DOCKER_ENV) {
    return url
  }
  return url.replace(/@db:/, '@localhost:')
}
