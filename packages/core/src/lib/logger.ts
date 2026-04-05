import pino, { type Logger, type LoggerOptions } from 'pino'

/** Safe for browser bundles (Vite) where `process` is undefined. */
function readProcessEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key]
  }
  return undefined
}

// LOG_LEVEL env var takes precedence, otherwise 'info'
const getLogLevel = () => {
  const level = readProcessEnv('LOG_LEVEL')
  if (level) return level
  return 'info'
}

// Paths to redact sensitive data from logs (defense-in-depth)
const REDACT_PATHS = [
  // Common sensitive field names
  'apiKey',
  'api_key',
  'password',
  'secret',
  'token',
  'accessToken',
  'refreshToken',
  'clientSecret',
  // Nested paths (one level deep)
  '*.apiKey',
  '*.api_key',
  '*.password',
  '*.secret',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.clientSecret',
  // Config object paths
  'config.apiKey',
  'config.api_key',
  'config.secret',
  'config.password',
]

const defaultOptions: LoggerOptions = {
  level: getLogLevel(),
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
  },
  // Only attach pino-pretty in Node dev; skip when `process` is missing (browser) or production
  transport:
    readProcessEnv('NODE_ENV') === 'production' || typeof process === 'undefined'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
}

let rootLogger: Logger | null = null

export function createLogger(name?: string, options?: LoggerOptions): Logger {
  const opts = { ...defaultOptions, ...options }

  if (name) {
    opts.name = name
  }

  return pino(opts)
}

export function getLogger(): Logger {
  if (!rootLogger) {
    rootLogger = createLogger('aperture')
  }
  return rootLogger
}

export function createChildLogger(name: string): Logger {
  return getLogger().child({ module: name })
}

export type { Logger }


