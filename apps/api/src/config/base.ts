import fs from 'fs'
import { getVar, parseIntOr } from './index.js'
import { logger } from '../logger.js'

export interface IBaseConfig {
  NODE_ENV: string
  ALLOW_HTTP: boolean
  VERSION: string
  LOG_LEVEL: string
  API_URL: string
  FRONTEND_URL: string
  LOGIN_LINK_EXPIRATION: string
  LOGIN_JWT_SECRET: string
  AUTH_JWT_EXPIRATION: string
  AUTH_JWT_SECRET: string
  AI_API_URL: string
  AI_API_USERNAME: string
  AI_API_PASSWORD: string
  PYTHON_ALLOWED_LIBRARIES: string
  POSTGRES_USERNAME: string
  POSTGRES_HOSTNAME: string
  POSTGRES_PORT: string
  POSTGRES_DATABASE: string
  POSTGRES_PASSWORD: string
  POSTGRES_CONNECTION_LIMIT: number
  POSTGRES_POOL_TIMEOUT: number
  POSTGRES_SSL_MODE: string
  ENVIRONMENT_VARIABLES_ENCRYPTION_KEY: string
  DATASOURCES_ENCRYPTION_KEY: string
  WORKSPACE_SECRETS_ENCRYPTION_KEY: string
  DISABLE_CUSTOM_OAI_KEY: boolean
  YJS_DOCS_CACHE_SIZE_MB: number
  DISABLE_ANONYMOUS_TELEMETRY: boolean
  DISABLE_UPDATE_CHECK: boolean
}

export class BaseConfig implements IBaseConfig {
  public readonly NODE_ENV: string
  public readonly ALLOW_HTTP: boolean
  public readonly VERSION: string
  public readonly LOG_LEVEL: string
  public readonly API_URL: string
  public readonly FRONTEND_URL: string
  public readonly LOGIN_LINK_EXPIRATION: string
  public readonly LOGIN_JWT_SECRET: string
  public readonly AUTH_JWT_EXPIRATION: string
  public readonly AUTH_JWT_SECRET: string
  public readonly AI_API_URL: string
  public readonly AI_API_USERNAME: string
  public readonly AI_API_PASSWORD: string
  public readonly PYTHON_ALLOWED_LIBRARIES: string
  public readonly POSTGRES_USERNAME: string
  public readonly POSTGRES_HOSTNAME: string
  public readonly POSTGRES_PORT: string
  public readonly POSTGRES_DATABASE: string
  public readonly POSTGRES_PASSWORD: string
  public readonly POSTGRES_CONNECTION_LIMIT: number
  public readonly POSTGRES_POOL_TIMEOUT: number
  public readonly POSTGRES_SSL_MODE: string
  public readonly ENVIRONMENT_VARIABLES_ENCRYPTION_KEY: string
  public readonly DATASOURCES_ENCRYPTION_KEY: string
  public readonly WORKSPACE_SECRETS_ENCRYPTION_KEY: string
  public readonly YJS_DOCS_CACHE_SIZE_MB: number
  public readonly DISABLE_CUSTOM_OAI_KEY: boolean
  public readonly DISABLE_ANONYMOUS_TELEMETRY: boolean
  public readonly DISABLE_UPDATE_CHECK: boolean

  public constructor() {
    this.NODE_ENV = getVar('NODE_ENV')
    this.ALLOW_HTTP = this.getBooleanVar('ALLOW_HTTP')
    this.VERSION = this.getVersion()
    this.LOG_LEVEL = getVar('LOG_LEVEL')
    this.API_URL = getVar('API_URL')
    this.FRONTEND_URL = getVar('FRONTEND_URL')
    this.LOGIN_LINK_EXPIRATION = process.env['LOGIN_LINK_EXPIRATION'] || '15m'
    this.LOGIN_JWT_SECRET = getVar('LOGIN_JWT_SECRET')
    this.AUTH_JWT_EXPIRATION = process.env['AUTH_JWT_EXPIRATION'] || '30d'
    this.AUTH_JWT_SECRET = getVar('AUTH_JWT_SECRET')
    this.AI_API_URL = getVar('AI_API_URL')
    this.AI_API_USERNAME = getVar('AI_API_USERNAME')
    this.AI_API_PASSWORD = getVar('AI_API_PASSWORD')
    this.PYTHON_ALLOWED_LIBRARIES = getVar('PYTHON_ALLOWED_LIBRARIES')
    this.POSTGRES_USERNAME = getVar('POSTGRES_USERNAME')
    this.POSTGRES_HOSTNAME = getVar('POSTGRES_HOSTNAME')
    this.POSTGRES_PORT = getVar('POSTGRES_PORT')
    this.POSTGRES_DATABASE = getVar('POSTGRES_DATABASE')
    this.POSTGRES_PASSWORD = getVar('POSTGRES_PASSWORD')
    this.POSTGRES_CONNECTION_LIMIT = parseIntOr(
      process.env['POSTGRES_CONNECTION_LIMIT'] ?? '10',
      10
    )
    this.POSTGRES_POOL_TIMEOUT = parseIntOr(
      process.env['POSTGRES_POOL_TIMEOUT'] ?? '5',
      5
    )
    this.POSTGRES_SSL_MODE =
      process.env['POSTGRES_SSL_MODE']?.trim() || 'prefer'
    this.ENVIRONMENT_VARIABLES_ENCRYPTION_KEY = getVar(
      'ENVIRONMENT_VARIABLES_ENCRYPTION_KEY'
    )
    this.DATASOURCES_ENCRYPTION_KEY = getVar('DATASOURCES_ENCRYPTION_KEY')
    this.WORKSPACE_SECRETS_ENCRYPTION_KEY = getVar(
      'WORKSPACE_SECRETS_ENCRYPTION_KEY'
    )
    this.YJS_DOCS_CACHE_SIZE_MB = parseIntOr(
      process.env['YJS_DOCS_CACHE_SIZE_MB'] ?? '',
      // set default to 1 byte in MB to effectively disable the cache
      // can't be 0 because LRUCache doesn't allow that
      1 / 1024 / 1024
    )
    this.DISABLE_CUSTOM_OAI_KEY = this.getBooleanVar(
      'DISABLE_CUSTOM_OAI_KEY',
      false
    )
    this.DISABLE_ANONYMOUS_TELEMETRY = this.getBooleanVar(
      'DISABLE_ANONYMOUS_TELEMETRY'
    )
    this.DISABLE_UPDATE_CHECK = this.getBooleanVar('DISABLE_UPDATE_CHECK')
  }

  private getVersion() {
    const fromEnv = process.env['VERSION']?.trim() ?? ''
    if (fromEnv !== '') {
      return fromEnv
    }

    try {
      const fromFile = String(
        JSON.parse(fs.readFileSync('package.json', 'utf8').trim()).version
      )
      return `v${fromFile}`
    } catch (err) {
      logger().warn(
        {
          err,
        },
        'Failed to read VERSION file'
      )

      return 'unknown'
    }
  }

  private getBooleanVar(name: string, or?: boolean): boolean {
    const value = process.env[name]?.toLowerCase()
    if (value === undefined && or !== undefined) {
      return or
    }

    if (value === 'true' || value === '1' || value === 'yes') {
      return true
    }

    return false
  }
}
