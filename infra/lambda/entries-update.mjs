import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from './shared/db.mjs';
import { getUserId } from './shared/auth.mjs';
import { ok, err } from './shared/response.mjs';

/**
 * PUT /trackers/{trackerId}/entries/{entryId}
 *
 * Replaces the entry's `data` attribute with the new payload.
 * Fails with 404 if the entry doesn't exist (ConditionExpression).
 */
export async function handler(event) {
  try {
    const userId = getUserId(event);
    const { trackerId, entryId } = event.pathParameters;
    const patch = JSON.parse(event.body ?? '{}');

    const updatedData = { ...patch, id: entryId, updatedAt: Date.now() };

    const result = await ddb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `TRACKER#${trackerId}#ENTRY#${entryId}`,
        },
        UpdateExpression: 'SET #d = :data',
        ExpressionAttributeNames: { '#d': 'data' },
        ExpressionAttributeValues: { ':data': updatedData },
        // Guard: reject if item was deleted between optimistic update and API call
        ConditionExpression: 'attribute_exists(PK)',
        ReturnValues: 'ALL_NEW',
      }),
    );

    return ok(result.Attributes?.data ?? updatedData);
  } catch (e) {
    if (e.message?.startsWith('Unauthorized')) return err(401, e.message);
    if (e.name === 'ConditionalCheckFailedException') return err(404, 'Entry not found');
    console.error('entries-update error:', e);
    return err(500, 'Internal server error');
  }
}
