import Link from 'next/link'

type DataSourceBlockProps = {
  name: string
  icon: string
  href: string
}

const DataSourceBlock = ({ name, icon, href }: DataSourceBlockProps) => {
  return (
    <Link
      href={href}
      className="h-32 w-32 p-2 border border-gray-200 rounded-md flex flex-col items-center justify-around bg-gray-50 hover:bg-ceramic-50 hover:border-gray-300"
    >
      <img src={icon} alt="" className="h-12 w-12" />
      <span className="text-sm">{name}</span>
    </Link>
  )
}

export const DataSourceIcons = ({
  workspaceId,
  onCSV,
}: {
  workspaceId: string
  onCSV: () => void
}) => {
  return (
    <div className="w-full flex gap-x-4 gap-y-4 flex-wrap">
      <DataSourceBlock
        icon="/icons/sqlserver.png"
        name="SQLServer"
        href={`/workspaces/${workspaceId}/data-sources/new/sqlserver`}
      />
      <DataSourceBlock
        icon="/icons/athena.png"
        name="Athena"
        href={`/workspaces/${workspaceId}/data-sources/new/athena`}
      />
      <DataSourceBlock
        icon="/icons/bigquery.png"
        name="BigQuery"
        href={`/workspaces/${workspaceId}/data-sources/new/bigquery`}
      />
      <DataSourceBlock
        icon="/icons/postgres.png"
        name="PostgreSQL"
        href={`/workspaces/${workspaceId}/data-sources/new/postgresql`}
      />
      <DataSourceBlock
        icon="/icons/redshift.png"
        name="Redshift"
        href={`/workspaces/${workspaceId}/data-sources/new/redshift`}
      />
      <DataSourceBlock
        icon="/icons/oracle.png"
        name="Oracle"
        href={`/workspaces/${workspaceId}/data-sources/new/oracle`}
      />
      <DataSourceBlock
        icon="/icons/snowflake.png"
        name="Snowflake"
        href={`/workspaces/${workspaceId}/data-sources/new/snowflake`}
      />
      <DataSourceBlock
        icon="/icons/databrickssql.png"
        name="Databricks SQL"
        href={`/workspaces/${workspaceId}/data-sources/new/databrickssql`}
      />
      <button
        onClick={onCSV}
        className="h-32 w-32 py-3 px-6 border border-gray-200 rounded-md flex flex-col items-center justify-around bg-gray-50 hover:bg-ceramic-50 hover:border-gray-300"
      >
        <img src="/icons/csv.png" alt="" className="h-12 w-12" />
        <span className="text-sm">Files</span>
      </button>
    </div>
  )
}
