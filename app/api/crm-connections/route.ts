/**
 * GET  /api/crm-connections        → list all connections for current user
 * POST /api/crm-connections        → save/update a connection (API key flow)
 * DELETE /api/crm-connections?crm= → disconnect a CRM
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import { CRMType } from '@/lib/crm/types';

const VALID_CRMS: CRMType[] = ['hubspot', 'salesforce', 'pipedrive', 'zoho', 'close'];

export async function GET() {
  const session = await getAuth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const connections = await prisma.cRMConnection.findMany({
    where: { userId },
    select: { crmType: true, connectedAt: true, updatedAt: true,
              // Return only whether fields exist, not the encrypted values
              apiKey: true, accessToken: true, oauthClientId: true },
  });

  // Return sanitized list — never expose encrypted values to the client
  const sanitized = connections.map((c: Record<string, unknown>) => ({
    crmType:     c.crmType,
    connected:   !!(c.apiKey || c.accessToken),
    authMethod:  c.accessToken ? 'oauth' : 'apikey',
    connectedAt: c.connectedAt,
    updatedAt:   c.updatedAt,
  }));

  return NextResponse.json({ connections: sanitized });
}

export async function POST(req: NextRequest) {
  const session = await getAuth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const body = await req.json() as {
    crmType:     CRMType;
    apiKey?:     string;
    // Salesforce username/password flow
    username?:   string;
    password?:   string;
    securityToken?: string;
    loginUrl?:   string;
  };

  if (!VALID_CRMS.includes(body.crmType)) {
    return NextResponse.json({ error: 'Invalid CRM type' }, { status: 400 });
  }

  // Build update payload
  const data: Record<string, unknown> = { updatedAt: new Date() };

  if (body.apiKey) {
    data.apiKey = encrypt(body.apiKey.trim());
    data.accessToken  = null;
    data.refreshToken = null;
  }

  // Salesforce stores credentials in extraConfig
  if (body.crmType === 'salesforce' && body.username && body.password) {
    data.extraConfig = JSON.stringify({
      username:      body.username,
      password:      encrypt(body.password),
      securityToken: body.securityToken ? encrypt(body.securityToken) : '',
      loginUrl:      body.loginUrl ?? 'https://login.salesforce.com',
    });
    data.apiKey = null;
  }

  await prisma.cRMConnection.upsert({
    where:  { userId_crmType: { userId, crmType: body.crmType } },
    create: { userId, crmType: body.crmType, ...data },
    update: data,
  });

  // Update user's default CRM preference
  await prisma.user.update({ where: { id: userId }, data: { defaultCRM: body.crmType } });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getAuth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as { id: string }).id;
  const crm = req.nextUrl.searchParams.get('crm') as CRMType | null;
  if (!crm || !VALID_CRMS.includes(crm)) {
    return NextResponse.json({ error: 'Invalid CRM type' }, { status: 400 });
  }

  await prisma.cRMConnection.deleteMany({ where: { userId, crmType: crm } });
  return NextResponse.json({ success: true });
}
