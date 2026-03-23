/**
 * GET /api/oauth/[crm]/callback
 * Exchanges the authorization code for tokens and stores them in the DB.
 */
import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/crypto';

const APP_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

interface TokenResponse {
  access_token:  string;
  refresh_token?: string;
  expires_in?:   number;
  token_type?:   string;
  instance_url?: string; // Salesforce
}

async function exchangeCode(
  crm: string,
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const endpoints: Record<string, string> = {
    hubspot:    'https://api.hubapi.com/oauth/v1/token',
    salesforce: 'https://login.salesforce.com/services/oauth2/token',
    pipedrive:  'https://oauth.pipedrive.com/oauth/token',
    zoho:       'https://accounts.zoho.com/oauth/v2/token',
  };

  const clientIdEnv:     Record<string, string> = {
    hubspot:    'HUBSPOT_CLIENT_ID',
    salesforce: 'SALESFORCE_CLIENT_ID',
    pipedrive:  'PIPEDRIVE_CLIENT_ID',
    zoho:       'ZOHO_CLIENT_ID',
  };
  const clientSecretEnv: Record<string, string> = {
    hubspot:    'HUBSPOT_CLIENT_SECRET',
    salesforce: 'SALESFORCE_CLIENT_SECRET',
    pipedrive:  'PIPEDRIVE_CLIENT_SECRET',
    zoho:       'ZOHO_CLIENT_SECRET',
  };

  const tokenUrl    = endpoints[crm];
  const clientId    = process.env[clientIdEnv[crm]];
  const clientSecret = process.env[clientSecretEnv[crm]];

  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error(`OAuth not fully configured for ${crm}`);
  }

  const params = new URLSearchParams({
    grant_type:    'authorization_code',
    code,
    redirect_uri:  redirectUri,
    client_id:     clientId,
    client_secret: clientSecret,
  });

  const res = await axios.post<TokenResponse>(tokenUrl, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return res.data;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { crm: string } }
) {
  const crm  = params.crm.toLowerCase();
  const url  = req.nextUrl;
  const code = url.searchParams.get('code');
  const stateRaw = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${APP_URL}/settings?error=${encodeURIComponent(error)}`);
  }
  if (!code || !stateRaw) {
    return NextResponse.redirect(`${APP_URL}/settings?error=missing_code`);
  }

  let userId: string;
  try {
    const state = JSON.parse(Buffer.from(stateRaw, 'base64url').toString());
    userId = state.userId;
  } catch {
    return NextResponse.redirect(`${APP_URL}/settings?error=invalid_state`);
  }

  const redirectUri = `${APP_URL}/api/oauth/${crm}/callback`;

  try {
    const tokens = await exchangeCode(crm, code, redirectUri);

    const tokenExpiry = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;

    const extraConfig: Record<string, string> = {};
    if (tokens.instance_url) extraConfig.instanceUrl = tokens.instance_url; // Salesforce

    await prisma.cRMConnection.upsert({
      where:  { userId_crmType: { userId, crmType: crm } },
      create: {
        userId,
        crmType:      crm,
        accessToken:  encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        tokenExpiry,
        extraConfig:  Object.keys(extraConfig).length ? JSON.stringify(extraConfig) : null,
        oauthClientId:     process.env[`${crm.toUpperCase()}_CLIENT_ID`] ?? null,
        oauthClientSecret: process.env[`${crm.toUpperCase()}_CLIENT_SECRET`]
          ? encrypt(process.env[`${crm.toUpperCase()}_CLIENT_SECRET`]!)
          : null,
      },
      update: {
        accessToken:  encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
        tokenExpiry,
        extraConfig:  Object.keys(extraConfig).length ? JSON.stringify(extraConfig) : undefined,
        updatedAt:    new Date(),
      },
    });

    // Set as user's default CRM
    await prisma.user.update({ where: { id: userId }, data: { defaultCRM: crm } });

    return NextResponse.redirect(`${APP_URL}/settings?connected=${crm}`);
  } catch (err) {
    console.error(`[oauth/${crm}/callback]`, err);
    const msg = err instanceof Error ? err.message : 'Token exchange failed';
    return NextResponse.redirect(`${APP_URL}/settings?error=${encodeURIComponent(msg)}`);
  }
}