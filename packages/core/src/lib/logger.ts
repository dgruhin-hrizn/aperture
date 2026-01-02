import pino, { type Logger, type LoggerOptions } from 'pino'

const defaultOptions: LoggerOptions = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
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

