import { handleWeeklyReflection } from '../src/server/weeklyReflection'
import { withApiRoute } from './_lib'

export default withApiRoute((key, body, authorization) => handleWeeklyReflection(key, body, undefined, authorization))
