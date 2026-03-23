/**
 * GET /api/oauth/[crm]/connect
 * Redirects the user to the CRM's OAuth authorization page.
 * Each CRM requires its own OAuth app registered on the CRM's developer portal.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';

const APP_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

const OAUTH_CONFIGS: Record<string, {
  authUrl: string;
  clientIdEnv: string;
  scopes: string;
  extra?: Record<string, string>;
}> = {
  hubspot: {
    authUrl:      'https://app.hubspot.com/oauth/authorize',
    clientIdEnv:  'HUBSPOT_CLIENT_ID',
    scopes:       'crm.objects.contacts.read crm.objects.contacts.write crm.objects.companies.read crm.objects.companies.write crm.objects.deals.read crm.objects.deals.write crm.objects.owners.read',
  },
  salesforce: {
    authUrl:      'https://login.salesforce.com/services/oauth2/authorize',
    clientIdEnv:  'SALESFORCE_CLIENT_ID',
    scopes:       'api refresh_token offline_access',
    extra:        { response_type: 'code' },
  },
  pipedrive: {
    authUrl:      'https://oauth.pipedrive.com/oauth/authorize',
    clientIdEnv:  'PIPEDRIVE_CLIENT_ID',
    scopes:       '',
  },
  zoho: {
    authUrl:      'https://accounts.zoho.com/oauth/v2/auth',
    clientIdEnv:  'ZOHO_CLIENT_ID',
    scopes:       'ZohoCRM.modules.ALL,ZohoCRM.settings.ALL,ZohoCRM.bulk.ALL',
    extra:        { access_type: 'offline', prompt: 'consent' },
  },
};

export async function GET(
  req: NextRequest,
  { params }: { params: { crm: string } }
) {
  const session = await getAuth();
  if (!session?.user) {
    return NextResponse.redirect(`${APP_URL}/login`);
  }

  const crm = params.crm.toLowerCase();
  const config = OAUTH_CONFIGS[crm];

  if (!config) {
    return NextResponse.json({ error: `OAuth not supported for ${crm}. Use API key instead.` }, { status: 400 });
  }

  const clientId = process.env[config.clientIdEnv];
  if (!clientId) {
    return NextResponse.json({
      error: `${config.clientIdEnv} is not configured. Set it in your .env.local to enable one-click connect for ${crm}.`,
    }, { status: 400 });
  }

  const redirectUri = `${APP_URL}/api/oauth/${crm}/callback`;
  const state = Buffer.from(JSON.stringify({
    userId: (session.user as { id: string }).id,
    ts:     Date.now(),
  })).toString('base64url');

  const params_ = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    scope:         config.scopes,
    state,
    response_type: 'code',
    ...config.extra,
  });

  return NextResponse.redirect(`${config.authUrl}?${params_.toString()}`);
}