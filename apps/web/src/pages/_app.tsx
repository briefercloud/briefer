import { NextPage } from 'next'
import type { AppProps } from 'next/app'
import dynamic from 'next/dynamic'
import { Fragment } from 'react'
import { ComponentType } from 'react'

import { DocumentsProvider } from '@/hooks/useDocuments'
import { EnvironmentStatusProvider } from '@/hooks/useEnvironmentStatus'
import { useCookieCheck } from '@/hooks/useSessionRedirect'
import { WebsocketProvider } from '@/hooks/useWebsocket'
import '@/styles/globals.css'
import 'simplebar-react/dist/simplebar.min.css'

import '../../scripts/wdyr'
import DndBackendProvider from '@/components/DndBackendProvider'
import { SideBarProvider } from '@/hooks/useSideBar'
const MonacoProvider = dynamic(() => import('@/components/MonacoProvider'), {
  ssr: false,
})

type Page<P = {}> = NextPage<P> & {
  layout?: ComponentType
}

type Props = AppProps & {
  Component: Page
}

function App({ Component, pageProps: { session, ...pageProps } }: Props) {
  const Layout = Component.layout ?? Fragment

  useCookieCheck()

  return (
    <>
      <DndBackendProvider>
        <WebsocketProvider>
          <EnvironmentStatusProvider>
            <DocumentsProvider>
              <SideBarProvider>
                <Layout>
                  <MonacoProvider>
                    <Component {...pageProps} />
                  </MonacoProvider>
                </Layout>
              </SideBarProvider>
            </DocumentsProvider>
          </EnvironmentStatusProvider>
        </WebsocketProvider>
      </DndBackendProvider>
    </>
  )
}

export default dynamic(() => Promise.resolve(App), {
  ssr: false,
})
