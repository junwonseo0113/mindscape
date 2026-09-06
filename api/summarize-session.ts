import { handleSummarizeSession } from '../src/server/aiHandlers'
import { withApiRoute } from './_lib'

export default withApiRoute(handleSummarizeSession)
