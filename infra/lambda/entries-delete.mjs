import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from './shared/db.mjs';
import { getUserId } from './shared/auth.mjs';
import { ok, err } from './shared/response.mjs';

/**
 * DELETE /trackers/{trackerId}/entries/{entryId}
 *
 * Idempotent — deleting a non-existent entry returns 200.
 */
export async function handler(event) {
  try {
    const userId = getUserId(event);
    const { trackerId, entryId } = event.pathParameters;

    await ddb.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `TRACKER#${trackerId}#ENTRY#${entryId}`,
        },
      }),
    );

    return ok({ deleted: entryId });
  } catch (e) {
    if (e.message?.startsWith('Unauthorized')) return err(401, e.message);
    console.error('entries-delete error:', e);
    return err(500, 'Internal server error');
  }
}
