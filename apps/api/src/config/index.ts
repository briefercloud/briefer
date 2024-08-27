import dotenv from 'dotenv'
import getComposeConfig, { IComposeConfig } from './compose.js'
import { IBaseConfig } from './base.js'

dotenv.config()

export type BrieferConfig = IBaseConfig & IComposeConfig

export function getVar(key: string, allowEmpty?: boolean) {
  const value = process.env[key]

  if (allowEmpty && value === '') {
    return ''
  }

  if (!value) {
    throw new Error(`Missing ${key} environment variable`)
  }

  return value
}

export function parseIntOr(value: string, defaultValue: number): number {
  const parsed = parseInt(value)
  return Number.isNaN(parsed) ? defaultValue : parsed
}

function getConfig(): BrieferConfig {
  return getComposeConfig()
}

export default getConfig
