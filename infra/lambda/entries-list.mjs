import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from './shared/db.mjs';
import { getUserId } from './shared/auth.mjs';
import { ok, err } from './shared/response.mjs';
import { makeLogger } from './shared/logger.mjs';
import { validateTrackerId } from './shared/validate.mjs';

/**
 * GET /trackers/{trackerId}/entries
 *
 * Returns all entries for a given tracker, newest first.
 * Query uses begins_with(SK, "TRACKER#{id}#ENTRY#") — O(entries) not O(table).
 */
export async function handler(event) {
  const { log, startTimer, requestId } = makeLogger(event)
  const stop = startTimer()

  try {
    const userId    = getUserId(event)
    const { trackerId } = event.pathParameters

    validateTrackerId(trackerId)

    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk':       `USER#${userId}`,
          ':skPrefix': `TRACKER#${trackerId}#ENTRY#`,
        },
        ScanIndexForward: false,
      }),
    )

    const entries = (result.Items ?? []).map((item) => item.data)

    log('info', 'entries-list', { trackerId, itemCount: entries.length, statusCode: 200, ...stop() })
    return ok(entries)
  } catch (e) {
    if (e.message?.startsWith('Unauthorized')) {
      log('warn', 'entries-list unauthorized', { statusCode: 401, ...stop() })
      return err(401, e.message)
    }
    if (e.statusCode === 400) {
      log('warn', 'entries-list bad request', { error: e.message, statusCode: 400, ...stop() })
      return err(400, e.message)
    }
    log('error', 'entries-list error', { error: e.message, statusCode: 500, ...stop() })
    return err(500, 'Internal server error')
  }
}
