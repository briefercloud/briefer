import config from '../config/index.js'
import prisma, {
  DataSource,
  OracleDataSource,
  getOraclePassword,
} from '@briefer/database'
import oracle from 'oracledb'
import { logger } from '../logger.js'
import { DataSourceStatus } from './index.js'
import { DataSourceConnectionError } from '@briefer/types'

async function getConnectionAttributes(ds: OracleDataSource) {
  const password = await getOraclePassword(
    ds,
    config().DATASOURCES_ENCRYPTION_KEY
  )

  let connectData = ''
  if (ds.serviceName) {
    connectData += `(service_name=${ds.serviceName})`
  }
  if (ds.sid) {
    connectData += `(sid=${ds.sid})`
  }

  if (connectData === '' && ds.database) {
    return {
      user: ds.username,
      password,
      connectString: `${ds.host}:${ds.port}/${ds.database}`,
    }
  }

  if (connectData !== '') {
    connectData = `(connect_data=${connectData})`
  }

  return {
    user: ds.username,
    password,
    connectString: `(description=(retry_count=3)(retry_delay=3)(address=(protocol=tcps)(port=${ds.port})(host=${ds.host}))${connectData}(security=(ssl_server_dn_match=yes)))`,
  }
}

export async function ping(datasource: OracleDataSource): Promise<DataSource> {
  const lastConnection = new Date()

  try {
    const attrs = await getConnectionAttributes(datasource)
    const connection = await oracle.getConnection(attrs)

    await connection.ping()

    return updateConnStatus(datasource, {
      connStatus: 'online',
      lastConnection,
    })
  } catch (err) {
    logger.info({ err, id: datasource.id }, 'Error pinging Oracle')
    const parsedErr = DataSourceConnectionError.safeParse(err)
    if (!parsedErr.success) {
      logger.error(
        { err, id: datasource.id },
        'Error parsing Oracle connection error'
      )
      return updateConnStatus(datasource, {
        connStatus: 'offline',
        connError: {
          name: 'UnknownError',
          message: 'Unknown error',
        },
      })
    }

    return updateConnStatus(datasource, {
      connStatus: 'offline',
      connError: parsedErr.data,
    })
  }
}

export async function updateConnStatus(
  ds: OracleDataSource,
  status: DataSourceStatus
): Promise<DataSource> {
  const newDs = await prisma().oracleDataSource.update({
    where: { id: ds.id },
    data: {
      connStatus: status.connStatus,
      lastConnection:
        status.connStatus === 'online' ? status.lastConnection : undefined,
      connError:
        status.connStatus === 'offline'
          ? JSON.stringify(status.connError)
          : undefined,
    },
  })

  return {
    type: 'oracle',
    data: {
      ...ds,
      connStatus: newDs.connStatus,
      lastConnection: newDs.lastConnection?.toISOString() ?? null,
      connError: newDs.connError,
    },
  }
}
