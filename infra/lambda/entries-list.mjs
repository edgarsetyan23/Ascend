import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { ddb, TABLE_NAME } from './shared/db.mjs';
import { getUserId } from './shared/auth.mjs';
import { ok, err } from './shared/response.mjs';

/**
 * GET /trackers/{trackerId}/entries
 *
 * Returns all entries for a given tracker, newest first.
 * Query uses begins_with(SK, "TRACKER#{id}#ENTRY#") — O(entries) not O(table).
 */
export async function handler(event) {
  try {
    const userId = getUserId(event);
    const { trackerId } = event.pathParameters;

    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':skPrefix': `TRACKER#${trackerId}#ENTRY#`,
        },
        ScanIndexForward: false, // newest first (descending SK order)
      }),
    );

    // Strip DynamoDB housekeeping keys — return only the app payload
    const entries = (result.Items ?? []).map((item) => item.data);
    return ok(entries);
  } catch (e) {
    if (e.message?.startsWith('Unauthorized')) return err(401, e.message);
    console.error('entries-list error:', e);
    return err(500, 'Internal server error');
  }
}
