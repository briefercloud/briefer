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

export const NEXT_PUBLIC_API_URL = () =>
  process.env.NEXT_PUBLIC_API_URL || getFromWindow('NEXT_PUBLIC_API_URL')

export const NEXT_PUBLIC_API_WS_URL = () =>
  process.env.NEXT_PUBLIC_API_WS_URL || getFromWindow('NEXT_PUBLIC_API_WS_URL')

export const NEXT_PUBLIC_PUBLIC_URL = () =>
  process.env.NEXT_PUBLIC_PUBLIC_URL || getFromWindow('NEXT_PUBLIC_PUBLIC_URL')

export const NEXT_PUBLIC_GATEWAY_IP = () =>
  process.env.NEXT_PUBLIC_GATEWAY_IP ||
  getFromWindow('NEXT_PUBLIC_GATEWAY_IP', '')
