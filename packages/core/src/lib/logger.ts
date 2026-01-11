import pino, { type Logger, type LoggerOptions } from 'pino'

// LOG_LEVEL env var takes precedence, otherwise 'info' in production, 'info' in development
const getLogLevel = () => {
  if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL
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
  transport:
    process.env.NODE_ENV === 'production'
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


