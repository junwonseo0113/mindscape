import { handleInferGoals } from '../src/server/aiHandlers'
import { withApiRoute } from './_lib'

export default withApiRoute(handleInferGoals)
