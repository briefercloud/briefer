import {
  CpuChipIcon,
  Cog8ToothIcon,
  CommandLineIcon,
  PencilIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import React from 'react'

import Layout from '@/components/Layout'
import { useStringQuery } from '@/hooks/useQueryArgs'
import clsx from 'clsx'
import ScrollBar from '@/components/ScrollBar'
import { useSession } from '@/hooks/useAuth'

const pagePath = (workspaceId: string) => [
  { name: 'Configurations', icon: Cog8ToothIcon, href: '#', current: false },
  {
    name: 'Environments',
    icon: CpuChipIcon,
    href: `/workspaces/${workspaceId}/environments`,
    current: true,
  },
  {
    name: 'Current Environment',
    icon: CommandLineIcon,
    href: `/workspaces/${workspaceId}/environments/current`,
    current: true,
  },
]

export default function CurrentEnvironmentPage() {
  const session = useSession({ redirectToLogin: true })
  const workspaceId = useStringQuery('workspaceId')

  if (!session.data) {
    return null
  }

  return (
    <Layout pagePath={pagePath(workspaceId ?? '')} user={session.data}>
      <ScrollBar className="w-full bg-white h-full overflow-auto">
        <div className="px-4 sm:p-6 lg:p-8">
          <div className="border-b border-gray-200 pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium leading-6 text-gray-900">
                Python 3.9
              </h2>
              <p className="mt-1 text-sm leading-6 text-gray-500">
                This is the environment for your documents.{' '}
              </p>
            </div>

            {/* We'll uncomment once we're done with environments */}
            <div className={clsx('flex items-center', 'hidden')}>
              <Link
                href={`/workspaces/${workspaceId}/environments/new`}
                className="flex items-center gap-x-2 rounded-sm shadow-sm px-3.5 py-2.5 text-sm font-semibold hover:bg-gray-100 border border-gray-200"
              >
                <PencilIcon className="h-4 w-4" /> Edit environment
              </Link>
            </div>
          </div>

          <div className="py-6">
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6 bg-ceramic-50/60">
                <h2
                  id="applicant-information-title"
                  className="text-md font-medium leading-6 text-gray-900"
                >
                  Compute
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Information about the compute resources for this environment.
                </p>
              </div>
              <div className="border-t border-gray-200 px-4 py-5 px-6">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-8 grid-cols-2">
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">
                      Memory
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      Local machine memory
                    </dd>
                  </div>
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">CPU</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      Local machine CPU
                    </dd>
                  </div>
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">GPU</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      Local machine GPU
                    </dd>
                  </div>
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">
                      Network Performance
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      Up to 5 Gigabit
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500">Notes</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      This is the default environment for your documents.
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>

          <div className="py-6">
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-5 sm:px-6 bg-ceramic-50/60">
                <h2
                  id="applicant-information-title"
                  className="text-md font-medium leading-6 text-gray-900"
                >
                  Python
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-gray-500">
                  Information about the Python tooling for this environment.
                </p>
              </div>
              <div className="border-t border-gray-200 px-4 py-5 px-6">
                <dl className="grid grid-cols-1 gap-x-4 gap-y-8 grid-cols-2">
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">
                      Version
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">3.9</dd>
                  </div>
                  <div className="sm:col-span-1">
                    <dt className="text-sm font-medium text-gray-500">
                      Pip version
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">23.0.1</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-sm font-medium text-gray-500 flex items-center gap-x-2">
                      <span>Libraries</span>
                      <span className="font-mono text-xs">
                        (requirements.txt)
                      </span>
                    </dt>
                    <dd className="mt-1 text-xs text-gray-900 py-1">
                      <pre className="bg-gray-50 rounded-sm max-h-96 p-4 overflow-y-scroll overflow-x-auto border border-gray-200">
                        {requirements}
                      </pre>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </ScrollBar>
    </Layout>
  )
}

const requirements = `jupyter_server==2.12.1
ipykernel==6.27.1
matplotlib==3.8.2
numpy==1.26.2
pandas==1.5.3
psycopg2==2.9.9
plotly==5.18.0
scipy==1.11.4
transformers==4.36.0
ipywidgets==7.8.1
seaborn==0.13.0
altair==5.2.0
altair-viewer
altair-transform==0.2.0
boto3==1.35.5
vegafusion==1.5.0
vegafusion-python-embed==1.5.0
vl-convert-python==1.2.0
tiktoken==0.5.2
polars==0.19.19
SQLAlchemy==1.4.50
google-api-core==2.15.0
google-api-python-client==1.6.7
google-api-support==0.1.4
google-auth==2.25.2
google-auth-httplib2==0.2.0
google-auth-oauthlib==1.2.0
google-cloud-aiplatform==1.38.0
google-cloud-appengine-logging==1.4.0
google-cloud-audit-log==0.2.5
google-cloud-bigquery==3.14.0
google-cloud-bigquery-connection==1.14.0
google-cloud-bigquery-storage==2.24.0
google-cloud-billing==1.12.0
google-cloud-core==2.4.1
google-cloud-functions==1.14.0
google-cloud-iam==2.13.0
google-cloud-logging==3.9.0
google-cloud-resource-manager==1.11.0
google-cloud-storage==2.14.0
google-crc32c==1.5.0
google-pasta==0.2.0
google-resumable-media==2.7.0
googleapis-common-protos==1.62.0
db-dtypes==1.2.0
fastparquet==2024.2.0
oracledb==2.2.0
redshift-connector==2.0.917
sqlalchemy-redshift==0.8.14
trino==0.329.0
duckdb==1.0.0
openpyxl==3.1.2
mysqlclient==2.2.4
pymongo==4.8.0
snowflake-connector-python==3.12.2
snowflake-sqlalchemy==1.6.1`
