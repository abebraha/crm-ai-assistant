/**
 * Fetch decrypted CRM credentials for the current user.
 * Falls back to env vars if no DB connection exists (single-user mode).
 */
import { prisma } from '@/lib/db';
import { safeDecrypt } from '@/lib/crypto';
import { CRMType } from '@/lib/crm/types';

export interface CRMCredentials {
  apiKey?:         string;
  accessToken?:    string;
  refreshToken?:   string;
  tokenExpiry?:    Date;
  clientId?:       string;
  clientSecret?:   string;
  extraConfig?:    Record<string, unknown>;
}

export async function getUserCredentials(
  userId: string,
  crmType: CRMType
): Promise<CRMCredentials | null> {
  const conn = await prisma.cRMConnection.findUnique({
    where: { userId_crmType: { userId, crmType } },
  });

  if (!conn) return null;

  return {
    apiKey:        safeDecrypt(conn.apiKey)        ?? undefined,
    accessToken:   safeDecrypt(conn.accessToken)   ?? undefined,
    refreshToken:  safeDecrypt(conn.refreshToken)  ?? undefined,
    tokenExpiry:   conn.tokenExpiry                ?? undefined,
    clientId:      conn.oauthClientId              ?? undefined,
    clientSecret:  safeDecrypt(conn.oauthClientSecret) ?? undefined,
    extraConfig:   conn.extraConfig ? JSON.parse(conn.extraConfig) : undefined,
  };
}

/** Inject user credentials into process.env-style vars so adapters can pick them up */
export function applyCredentialsToEnv(crmType: CRMType, creds: CRMCredentials) {
  switch (crmType) {
    case 'hubspot':
      if (creds.apiKey)       process.env.HUBSPOT_API_KEY       = creds.apiKey;
      if (creds.accessToken)  process.env.HUBSPOT_API_KEY       = creds.accessToken;
      break;
    case 'salesforce':
      if (creds.extraConfig?.username)      process.env.SALESFORCE_USERNAME       = creds.extraConfig.username as string;
      if (creds.extraConfig?.password)      process.env.SALESFORCE_PASSWORD       = creds.extraConfig.password as string;
      if (creds.extraConfig?.securityToken) process.env.SALESFORCE_SECURITY_TOKEN = creds.extraConfig.securityToken as string;
      if (creds.extraConfig?.loginUrl)      process.env.SALESFORCE_LOGIN_URL      = creds.extraConfig.loginUrl as string;
      break;
    case 'pipedrive':
      if (creds.apiKey)       process.env.PIPEDRIVE_API_KEY     = creds.apiKey;
      if (creds.accessToken)  process.env.PIPEDRIVE_API_KEY     = creds.accessToken;
      break;
    case 'zoho':
      if (creds.accessToken)  process.env.ZOHO_ACCESS_TOKEN     = creds.accessToken;
      if (creds.refreshToken) process.env.ZOHO_REFRESH_TOKEN    = creds.refreshToken;
      if (creds.clientId)     process.env.ZOHO_CLIENT_ID        = creds.clientId;
      if (creds.clientSecret) process.env.ZOHO_CLIENT_SECRET    = creds.clientSecret;
      break;
    case 'close':
      if (creds.apiKey)       process.env.CLOSE_API_KEY         = creds.apiKey;
      break;
  }
}