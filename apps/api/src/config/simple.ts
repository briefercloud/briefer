import { BaseConfig } from './base.js'
import { getVar, parseIntOr } from './index.js'

export interface ISimpleConfig {
  DEPLOY_MODE: 'compose'
  JUPYTER_HOST: string
  JUPYTER_PORT: number
  JUPYTER_TOKEN: string
}

export class SimpleConfig extends BaseConfig implements ISimpleConfig {
  public DEPLOY_MODE: 'compose' = 'compose'
  public JUPYTER_HOST: string
  public JUPYTER_PORT: number
  public JUPYTER_TOKEN: string

  public constructor() {
    super()
    this.JUPYTER_HOST = getVar('JUPYTER_HOST')
    this.JUPYTER_PORT = parseIntOr(process.env['JUPYTER_PORT'] ?? '8888', 8888)
    this.JUPYTER_TOKEN = getVar('JUPYTER_TOKEN')
  }
}

let config: SimpleConfig
function getComposeConfig() {
  if (config) {
    return config
  }

  config = new SimpleConfig()

  return config
}

export default getComposeConfig
