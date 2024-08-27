import { BaseConfig } from './base.js'
import { getVar, parseIntOr } from './index.js'

export interface IComposeConfig {
  DEPLOY_MODE: 'compose'
  JUPYTER_HOST: string
  JUPYTER_PORT: number
  JUPYTER_TOKEN: string
  JUPYTER_FILES_DIR: string
}

export class ComposeConfig extends BaseConfig implements IComposeConfig {
  public DEPLOY_MODE: 'compose' = 'compose'
  public JUPYTER_HOST: string
  public JUPYTER_PORT: number
  public JUPYTER_TOKEN: string
  public JUPYTER_FILES_DIR: string

  public constructor() {
    super()
    this.JUPYTER_HOST = getVar('JUPYTER_HOST')
    this.JUPYTER_PORT = parseIntOr(process.env['JUPYTER_PORT'] ?? '8888', 8888)
    this.JUPYTER_TOKEN = getVar('JUPYTER_TOKEN')
    this.JUPYTER_FILES_DIR = getVar('JUPYTER_FILES_DIR')
  }
}

let config: ComposeConfig
function getComposeConfig() {
  if (config) {
    return config
  }

  config = new ComposeConfig()

  return config
}

export default getComposeConfig
