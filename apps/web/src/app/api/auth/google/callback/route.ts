import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const dynamo = new DynamoDBClient({ region: 'us-east-1' });
const TABLE  = process.env.DYNAMODB_TABLE ?? 'eventcraft-staging';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get('code');
  const error = searchParams.get('error');

  const appUrl      = process.env.NEXT_PUBLIC_APP_URL!;
  const redirectUri = `${appUrl}/api/auth/google/callback`;

  if (error || !code) {
    return NextResponse.redirect(`${appUrl}/contacts/import?error=cancelled`);
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return NextResponse.redirect(`${appUrl}/contacts/import?error=token_failed`);
    }

    // Fetch contacts from Google People API
    const peopleRes = await fetch(
      'https://people.googleapis.com/v1/people/me/connections' +
      '?personFields=names,emailAddresses,phoneNumbers&pageSize=500&sortOrder=FIRST_NAME_ASCENDING',
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );

    const peopleData  = await peopleRes.json();
    const connections = peopleData.connections ?? [];

    const contacts = connections
      .map((person: any) => ({
        name:  person.names?.[0]?.displayName ?? '',
        email: person.emailAddresses?.[0]?.value ?? '',
        phone: person.phoneNumbers?.[0]?.value?.replace(/[^0-9+]/g, '') ?? '',
      }))
      .filter((c: any) => c.name && (c.email || c.phone));

    // Store in DynamoDB with a short token — TTL 10 minutes
    const token = Math.random().toString(36).substring(2, 12);
    const ttl   = Math.floor(Date.now() / 1000) + 600;

    await dynamo.send(new PutItemCommand({
      TableName: TABLE,
      Item: {
        PK:       { S: `GMPORT#${token}` },
        SK:       { S: 'DATA' },
        contacts: { S: JSON.stringify(contacts) },
        ttl:      { N: ttl.toString() },
      },
    }));

    return NextResponse.redirect(`${appUrl}/contacts/import?token=${token}`);

  } catch (err) {
    console.error('Google OAuth error:', err);
    return NextResponse.redirect(`${appUrl}/contacts/import?error=server_error`);
  }
}
