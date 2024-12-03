export class AuthenticationError extends Error {
  constructor(public readonly url: string) {
    super('Authentication required')
    this.name = 'AuthenticationError'
  }
}

export class UnauthorizedError extends AuthenticationError {
  constructor(public readonly url: string) {
    super(url)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AuthenticationError {
  constructor(public readonly url: string) {
    super(url)
    this.name = 'ForbiddenError'
  }
}

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

  if (res.status === 401) {
    throw new UnauthorizedError(url)
  }

  if (res.status === 403) {
    throw new ForbiddenError(url)
  }

  const data = await res.json()
  return data
}
