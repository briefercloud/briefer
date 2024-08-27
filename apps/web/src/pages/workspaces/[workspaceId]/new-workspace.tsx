import { SquaresPlusIcon } from '@heroicons/react/24/outline'
import React from 'react'

import Layout from '@/components/Layout'
import NewWorkspace from '@/components/forms/NewWorkspace'

const pagePath = [
  { name: 'Add workspace', icon: SquaresPlusIcon, href: '#', current: false },
]

export default function NewWorkspacePage() {
  return (
    <Layout pagePath={pagePath}>
      <NewWorkspace />
    </Layout>
  )
}
