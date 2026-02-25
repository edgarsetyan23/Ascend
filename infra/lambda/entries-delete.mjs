import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from './shared/db.mjs';
import { getUserId } from './shared/auth.mjs';
import { ok, err } from './shared/response.mjs';
import { makeLogger } from './shared/logger.mjs';
import { validateTrackerId } from './shared/validate.mjs';

/**
 * DELETE /trackers/{trackerId}/entries/{entryId}
 *
 * Idempotent — deleting a non-existent entry returns 200.
 */
export async function handler(event) {
  const { log, startTimer } = makeLogger(event)
  const stop = startTimer()

  try {
    const userId                 = getUserId(event)
    const { trackerId, entryId } = event.pathParameters

    validateTrackerId(trackerId)

    await ddb.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `TRACKER#${trackerId}#ENTRY#${entryId}`,
        },
      }),
    )

    log('info', 'entries-delete', { trackerId, entryId, statusCode: 200, ...stop() })
    return ok({ deleted: entryId })
  } catch (e) {
    if (e.message?.startsWith('Unauthorized')) {
      log('warn', 'entries-delete unauthorized', { statusCode: 401, ...stop() })
      return err(401, e.message)
    }
    if (e.statusCode === 400) {
      log('warn', 'entries-delete bad request', { error: e.message, statusCode: 400, ...stop() })
      return err(400, e.message)
    }
    log('error', 'entries-delete error', { error: e.message, statusCode: 500, ...stop() })
    return err(500, 'Internal server error')
  }
}
