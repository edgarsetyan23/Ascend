import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from './shared/db.mjs';
import { getUserId } from './shared/auth.mjs';
import { ok, err } from './shared/response.mjs';

/**
 * POST /trackers/{trackerId}/entries
 *
 * Body: tracker entry payload (may include id/createdAt for migration).
 * If id is absent, a new UUID is generated.
 */
export async function handler(event) {
  try {
    const userId = getUserId(event);
    const { trackerId } = event.pathParameters;
    const data = JSON.parse(event.body ?? '{}');

    const entryId = data.id ?? crypto.randomUUID();
    // Support numeric timestamp (Date.now()) or ISO string from the frontend
    const createdAt = data.createdAt
      ? new Date(data.createdAt).toISOString()
      : new Date().toISOString();

    const entryData = { ...data, id: entryId, createdAt: data.createdAt ?? Date.now() };

    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `USER#${userId}`,
          SK: `TRACKER#${trackerId}#ENTRY#${entryId}`,
          // GSI1 allows querying entries by tracker ordered by creation time
          GSI1PK: `USER#${userId}#TRACKER#${trackerId}`,
          GSI1SK: createdAt,
          data: entryData,
        },
      }),
    );

    return ok(entryData);
  } catch (e) {
    if (e.message?.startsWith('Unauthorized')) return err(401, e.message);
    console.error('entries-create error:', e);
    return err(500, 'Internal server error');
  }
}
