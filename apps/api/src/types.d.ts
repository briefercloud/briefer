import { ApiUser, UserWorkspace } from '@briefer/database'

export interface Session {
  user: ApiUser
  userWorkspaces: Record<string, UserWorkspace>
}

declare global {
  namespace Express {
    interface Request {
      session: Session
    }
    interface Response {
      sentry: string
    }
  }
}
