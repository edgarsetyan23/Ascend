import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from './shared/db.mjs';
import { getUserId } from './shared/auth.mjs';
import { ok, err } from './shared/response.mjs';
import { makeLogger } from './shared/logger.mjs';
import { validateTrackerId, validateBody } from './shared/validate.mjs';

/**
 * POST /trackers/{trackerId}/entries
 *
 * Body: tracker entry payload (may include id/createdAt for migration).
 * If id is absent, a new UUID is generated.
 */
export async function handler(event) {
  const { log, startTimer } = makeLogger(event)
  const stop = startTimer()

  try {
    const userId        = getUserId(event)
    const { trackerId } = event.pathParameters
    const data          = JSON.parse(event.body ?? '{}')

    validateTrackerId(trackerId)
    validateBody(data)

    const entryId   = data.id ?? crypto.randomUUID()
    const createdAt = data.createdAt
      ? new Date(data.createdAt).toISOString()
      : new Date().toISOString()

    const entryData = { ...data, id: entryId, createdAt: data.createdAt ?? Date.now() }

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK:     `USER#${userId}`,
          SK:     `TRACKER#${trackerId}#ENTRY#${entryId}`,
          GSI1PK: `USER#${userId}#TRACKER#${trackerId}`,
          GSI1SK: createdAt,
          data:   entryData,
        },
      }),
    )

    log('info', 'entries-create', { trackerId, entryId, statusCode: 200, ...stop() })
    return ok(entryData)
  } catch (e) {
    if (e.message?.startsWith('Unauthorized')) {
      log('warn', 'entries-create unauthorized', { statusCode: 401, ...stop() })
      return err(401, e.message)
    }
    if (e.statusCode === 400) {
      log('warn', 'entries-create bad request', { error: e.message, statusCode: 400, ...stop() })
      return err(400, e.message)
    }
    log('error', 'entries-create error', { error: e.message, statusCode: 500, ...stop() })
    return err(500, 'Internal server error')
  }
}
