function getFromWindow(key: string, or?: string): string {
  try {
    // @ts-ignore
    return window.env[key]
  } catch (e) {
    if (or !== undefined) {
      return or
    }

    throw e
  }
}

function currentUrl() {
  return `${window.location.protocol}//${window.location.host}`
}

export const NEXT_PUBLIC_API_URL = () =>
  process.env.NEXT_PUBLIC_API_URL ||
  getFromWindow('NEXT_PUBLIC_API_URL') ||
  `${currentUrl()}/api`

export const NEXT_PUBLIC_API_WS_URL = () =>
  process.env.NEXT_PUBLIC_API_WS_URL ||
  getFromWindow('NEXT_PUBLIC_API_WS_URL') ||
  `${currentUrl().replace('http', 'ws')}/api`

export const NEXT_PUBLIC_PUBLIC_URL = () =>
  process.env.NEXT_PUBLIC_PUBLIC_URL ||
  getFromWindow('NEXT_PUBLIC_PUBLIC_URL') ||
  currentUrl()

export const NEXT_PUBLIC_GATEWAY_IP = () =>
  process.env.NEXT_PUBLIC_GATEWAY_IP ||
  getFromWindow('NEXT_PUBLIC_GATEWAY_IP', '')
