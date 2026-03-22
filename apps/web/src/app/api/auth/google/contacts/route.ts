import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient, GetItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';

const dynamo = new DynamoDBClient({ region: 'us-east-1' });
const TABLE  = process.env.DYNAMODB_TABLE ?? 'eventcraft-staging';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  try {
    const result = await dynamo.send(new GetItemCommand({
      TableName: TABLE,
      Key: {
        PK: { S: `GMPORT#${token}` },
        SK: { S: 'DATA' },
      },
    }));

    if (!result.Item) {
      return NextResponse.json({ error: 'Session expired. Please try importing again.' }, { status: 404 });
    }

    const contacts = JSON.parse(result.Item.contacts.S ?? '[]');

    // Delete after reading — one-time use
    await dynamo.send(new DeleteItemCommand({
      TableName: TABLE,
      Key: {
        PK: { S: `GMPORT#${token}` },
        SK: { S: 'DATA' },
      },
    }));

    return NextResponse.json({ contacts });

  } catch (err) {
    console.error('Contacts fetch error:', err);
    return NextResponse.json({ error: 'Failed to load contacts' }, { status: 500 });
  }
}
