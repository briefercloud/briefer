import { useRouter } from 'next/router'

// props to chat gpt
function extractParamValue(
  pathname: string,
  path: string,
  paramName: string
): string {
  const regexPattern = pathname.replace(/\[([^\]]+)\]/g, (_match, p1) =>
    p1 === paramName ? '([\\w-]+)' : '[^/]+'
  )

  const regex = new RegExp(regexPattern)

  const match = regex.exec(path)

  return match?.[1] ?? ''
}

export const useStringQuery = (name: string): string => {
  const router = useRouter()

  const pathname = router.pathname
  const path = typeof window === 'undefined' ? '' : window.location.pathname

  const arg = router.query[name] ?? extractParamValue(pathname, path, name)

  if (Array.isArray(arg)) {
    return arg[0]
  }

  return arg
}
