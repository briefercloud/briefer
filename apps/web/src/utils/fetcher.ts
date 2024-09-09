export class ResourceNotFoundError extends Error {
  public url: string
  constructor(url: string) {
    super('Resource not found')
    this.name = 'ResourceNotFoundError'
    this.url = url
  }
}

export default async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' })
  if (res.status === 404) {
    throw new ResourceNotFoundError(url)
  }

  const data = await res.json()
  return data
}
