import prisma, {
  getDocumentExecutionSchedule,
  createSchedule,
  ScheduleParams,
} from '@briefer/database'
import { Router, Request, Response, NextFunction } from 'express'
import scheduleRouter from './schedule.js'
import { getParam } from '../../../../../../utils/express.js'
import { validate } from 'uuid'
import { canUpdateWorkspace } from '../../../../../../auth/token.js'

const schedulesRouter = Router({ mergeParams: true })

export type CreateSchedulePayload = {
  scheduleParams: ScheduleParams
}

schedulesRouter.post('/', async (req, res) => {
  const workspaceId = getParam(req, 'workspaceId')
  const documentId = getParam(req, 'documentId')

  try {
    const reqBody = req.body as CreateSchedulePayload

    const savedSchedule = await createSchedule(reqBody.scheduleParams)

    res.status(201).json(savedSchedule)
  } catch (error) {
    req.log.error(
      { workspaceId, documentId, err: error },
      'Error creating schedule'
    )
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

schedulesRouter.get('/', async (req, res) => {
  try {
    const documentId = getParam(req, 'documentId')
    const schedules = await getDocumentExecutionSchedule(documentId)
    res.status(200).json(schedules)
  } catch (error) {
    req.log.error({ err: error }, 'Error listing schedules')
    res.status(500).end()
  }
})

async function belongsToDoc(req: Request, res: Response, next: NextFunction) {
  const documentId = getParam(req, 'documentId')
  const scheduleId = getParam(req, 'scheduleId')

  if (!validate(scheduleId) || !validate(documentId)) {
    res.status(400).end()
    return
  }

  const query = await prisma().executionSchedule.findUnique({
    where: { id: scheduleId },
    select: { documentId: true },
  })
  if (!query) {
    res.status(404).end()
    return
  }

  if (query.documentId !== documentId) {
    res.status(403).end()
    return
  }

  next()
}

schedulesRouter.use(
  '/:scheduleId',
  canUpdateWorkspace,
  belongsToDoc,
  scheduleRouter
)

export default schedulesRouter
