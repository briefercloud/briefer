import { pino } from 'pino'
import { config } from './config/index.js'

const redactionConfig = {
  paths: ['req.headers.cookie', 'req.headers.authorization'],
  censor: '[REDACTED]',
}

let loggerInstance: pino.Logger
export const logger = () => {
  if (loggerInstance) {
    return loggerInstance
  }

  loggerInstance = pino({
    level: process.env['NODE_ENV'] === 'test' ? 'silent' : config().LOG_LEVEL,
    redact: redactionConfig,
  })

  return loggerInstance
}
