import { HomeIcon } from '@heroicons/react/20/solid'
import Link from 'next/link'

export type Page = {
  name: string
  href: string
  current: boolean
  // TODO fix this type
  icon?: any
}

type PagePathProps = {
  pages: Page[]
}

export default function PagePath({ pages }: PagePathProps) {
  return (
    <nav className="flex h-full items-center" aria-label="Breadcrumb">
      <ol role="list" className="flex items-center">
        <li>
          <div>
            <Link href="/" className="text-gray-400/70 hover:text-gray-500">
              <HomeIcon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span className="sr-only">Home</span>
            </Link>
          </div>
        </li>
        {pages.map((page) => (
          <li key={page.name}>
            <div className="flex items-center">
              <div className="px-1">
                <svg
                  className="h-5 w-5 flex-shrink-0 text-gray-300"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path d="M5.555 17.776l8-16 .894.448-8 16-.894-.448z" />
                </svg>
              </div>
              <a
                href={page.href}
                className="text-sm font-medium text-gray-400 hover:text-gray-700 flex items-center gap-x-2"
                aria-current={page.current ? 'page' : undefined}
              >
                <page.icon strokeWidth={1} className="h-4 w-4" />
                <span className="lg:max-w-[180px] xl:max-w-[300px] truncate">
                  {page.name}
                </span>
              </a>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  )
}
