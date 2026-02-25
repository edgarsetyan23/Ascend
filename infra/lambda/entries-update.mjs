import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from './shared/db.mjs';
import { getUserId } from './shared/auth.mjs';
import { ok, err } from './shared/response.mjs';
import { makeLogger } from './shared/logger.mjs';
import { validateTrackerId, validateBody } from './shared/validate.mjs';

/**
 * PUT /trackers/{trackerId}/entries/{entryId}
 *
 * Replaces the entry's `data` attribute with the new payload.
 * Fails with 404 if the entry doesn't exist (ConditionExpression).
 */
export async function handler(event) {
  const { log, startTimer } = makeLogger(event)
  const stop = startTimer()

  try {
    const userId                  = getUserId(event)
    const { trackerId, entryId }  = event.pathParameters
    const patch                   = JSON.parse(event.body ?? '{}')

    validateTrackerId(trackerId)
    validateBody(patch)

    const updatedData = { ...patch, id: entryId, updatedAt: Date.now() }

    const result = await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `TRACKER#${trackerId}#ENTRY#${entryId}`,
        },
        UpdateExpression:          'SET #d = :data',
        ExpressionAttributeNames:  { '#d': 'data' },
        ExpressionAttributeValues: { ':data': updatedData },
        ConditionExpression:       'attribute_exists(PK)',
        ReturnValues:              'ALL_NEW',
      }),
    )

    log('info', 'entries-update', { trackerId, entryId, statusCode: 200, ...stop() })
    return ok(result.Attributes?.data ?? updatedData)
  } catch (e) {
    if (e.message?.startsWith('Unauthorized')) {
      log('warn', 'entries-update unauthorized', { statusCode: 401, ...stop() })
      return err(401, e.message)
    }
    if (e.statusCode === 400) {
      log('warn', 'entries-update bad request', { error: e.message, statusCode: 400, ...stop() })
      return err(400, e.message)
    }
    if (e.name === 'ConditionalCheckFailedException') {
      log('warn', 'entries-update not found', { trackerId, entryId, statusCode: 404, ...stop() })
      return err(404, 'Entry not found')
    }
    log('error', 'entries-update error', { error: e.message, statusCode: 500, ...stop() })
    return err(500, 'Internal server error')
  }
}
