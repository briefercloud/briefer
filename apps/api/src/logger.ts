import { pino } from 'pino'

const redactionConfig = {
  paths: ['req.headers.cookie', 'req.headers.authorization'],
  censor: '[REDACTED]',
}

export const logger = pino({
  level:
    process.env['NODE_ENV'] === 'test'
      ? 'silent'
      : process.env['LOG_LEVEL'] ?? 'info',
  redact: redactionConfig,
})
