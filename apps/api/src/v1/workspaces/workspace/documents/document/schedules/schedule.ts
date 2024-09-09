import { deleteExecutionSchedule } from '@briefer/database'
import { getParam } from '../../../../../../utils/express.js'
import { Router } from 'express'

const scheduleRouter = Router({ mergeParams: true })

scheduleRouter.delete('/', async (req, res) => {
  try {
    const scheduleId = getParam(req, 'scheduleId')
    await deleteExecutionSchedule(scheduleId)
    res.status(200).end()
  } catch (error) {
    req.log.error({ err: error }, 'Error deleting schedule')
    res.status(500).end()
  }
})

export default scheduleRouter
