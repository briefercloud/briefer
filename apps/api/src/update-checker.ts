import qs from 'querystring'
import semver from 'semver'
import { config } from './config/index.js'
import { logger } from './logger.js'
import { homedir } from 'os'
import path from 'path'
import { uuidv4 } from 'lib0/random.js'
import fsp from 'fs/promises'

async function getDeploymentId() {
  const home = homedir()
  const configDir = path.join(home, '.config', 'briefer')
  const idFile = path.join(configDir, 'id')

  try {
    await fsp.access(idFile)
    return (await fsp.readFile(idFile, 'utf-8')).trim()
  } catch (err) {
    const id = uuidv4()
    await fsp.mkdir(configDir, { recursive: true })
    await fsp.writeFile(idFile, id)
    return id
  }
}

async function fetchLatestVersion(): Promise<string> {
  const ourVersion = config().VERSION
  const deploymentId = await getDeploymentId()
  const params = qs.stringify({ version: ourVersion, deploymentId })
  const res = await fetch(`https://api.briefer.cloud/v1/oss/version?${params}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch latest version: ${res.statusText}`)
  }

  const version = await res.json()

  return version
}

export async function checkForUpdates() {
  try {
    const version = config().VERSION
    const latestVersion = await fetchLatestVersion()

    if (semver.gt(latestVersion, version)) {
      logger().warn(
        {
          current: version,
          latest: latestVersion,
        },
        "You're running an outdated version of Briefer. Please check our repository at https://github.com/briefercloud/briefer to obtain the latest version."
      )
    }
  } catch (err) {
    logger().error({ err }, 'Failed to check for updates')
  }
}

const UPDATE_CHECK_INTERVAL = 1000 * 60 * 60 * 4 // 4 hours
export async function initUpdateChecker() {
  if (config().DISABLE_UPDATE_CHECK) {
    logger().warn('Automatic update checks are disabled')
    return () => {}
  }

  await checkForUpdates()
  const interval = setInterval(checkForUpdates, UPDATE_CHECK_INTERVAL)

  return () => {
    clearInterval(interval)
  }
}
