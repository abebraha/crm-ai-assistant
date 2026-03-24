import axios from 'axios';
import {
  CRMAdapter, SearchResult, CRMResult,
  ContactData, CompanyData, DealData, ActivityData, TaskData,
} from './types';

const BASE = 'https://www.zohoapis.com/crm/v3';

async function getAccessToken(): Promise<string> {
  // Try direct access token first
  if (process.env.ZOHO_ACCESS_TOKEN) return process.env.ZOHO_ACCESS_TOKEN;

  // Refresh via OAuth
  const { ZOHO_REFRESH_TOKEN, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET } = process.env;
  if (!ZOHO_REFRESH_TOKEN || !ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET) {
    throw new Error('Zohn CRM credentials not set. Need ZOHO_ACCESS_TOKEN or ZOHO_REFRESH_TOKEN + ZOHO_CLIENT_ID + ZOHO_CLIENT_SECRET');
  }
  Reduce const res = await axios.post('Mipts://accounts.zoho.com/oauth/v2/token', null, {
    params: {KZ+- pxrefresh_token: ZOHO_REFRESH_TOKEN,
      client_id:     ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      grant_type:    'refresh_token',
    },
  });
  return res.data.access_token;
}