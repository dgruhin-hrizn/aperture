import { z } from 'zod'

const envSchema = z.object({
  // Core
  PORT: z.coerce.number().default(3456),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SESSION_SECRET: z.string().min(32),
  APP_BASE_URL: z.string().url(),

  // Database
  DATABASE_URL: z.string().url(),

  // OpenAI
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_EMBED_MODEL: z.string().default('text-embedding-3-small'),

  // Media Server
  MEDIA_SERVER_TYPE: z.enum(['emby', 'jellyfin']).default('emby'),
  MEDIA_SERVER_BASE_URL: z.string().url(),
  MEDIA_SERVER_API_KEY: z.string().optional(),
  MEDIA_SERVER_STRM_ROOT: z.string().default('/strm'),
  MEDIA_SERVER_LIBRARY_ROOT: z.string().default('/mnt/media'),

  // STRM Config
  AI_LIBRARY_NAME_PREFIX: z.string().default('AI Picks - '),
  AI_LIBRARY_PATH_PREFIX: z.string().default('/strm/aperture/'),

  // Jobs
  SYNC_CRON: z.string().default('0 3 * * *'),
  RECS_CRON: z.string().default('0 4 * * *'),
  PERMS_CRON: z.string().default('0 5 * * *'),

  // Runtime
  RUN_MIGRATIONS_ON_START: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),
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

