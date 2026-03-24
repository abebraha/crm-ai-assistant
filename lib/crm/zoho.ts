import axios from 'axios';
import {
  CRMAdapter, SearchResult, CRMResult,
  ContactData, CompanyData, DealData, ActivityData, TaskData,
} from './types';

const BASE = 'https://www.zohoapis.com/crm/v3';

async function getAccessToken(): Promise<string> {
  if (process.env.ZOHO_ACCESS_TOKEN) return process.env.ZOHO_ACCESS_TOKEN;
  const { ZOHO_REFRESH_TOKEN, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET } = process.env;
  if (!ZOHO_REFRESH_TOKEN || !ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET) {
    throw new Error('Zoho CRM credentials not set. Need ZOHO_ACCESS_TOKEN or ZOHO_REFRESH_TOKEN + ZOHO_CLIENT_ID + ZOHO_CLIENT_SECRET');
  }
  const res = await axios.post('https://accounts.zoho.com/oauth/v2/token', null, {
    params: {
      refresh_token: ZOHO_REFRESH_TOKEN,
      client_id: ZOHO_CLIENT_ID,
      client_secret: ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token',
    },
  });
  return res.data.access_token;
}

async function client() {
  const token = await getAccessToken();
  return axios.create({
    baseURL: BASE,
    headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
  });
}

export class ZohoAdapter implements CRMAdapter {
  async searchContacts(query: string): Promise<SearchResult[]> {
    const z = await client();
    const res = await z.get('/Contacts/search', { params: { criteria: `(Last_Name:contains:${query})` } });
    const data = res.data.data ?? [];
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: `${r.First_Name ?? ''} ${r.Last_Name ?? ''}`.trim(),
      type: 'contact' as const,
      extra: r,
    }));
  }

  async searchCompanies(query: string): Promise<SearchResult[]> {
    const z = await client();
    const res = await z.get('/Accounts/search', { params: { criteria: `(Account_Name:contains:${query})` } });
    const data = res.data.data ?? [];
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: r.Account_Name as string,
      type: 'company' as const,
      extra: r,
    }));
  }

  async searchDeals(query: string): Promise<SearchResult[]> {
    const z = await client();
    const res = await z.get('/Deals/search', { params: { criteria: `(Deal_Name:contains:${query})` } });
    const data = res.data.data ?? [];
    return data.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      name: r.Deal_Name as string,
      type: 'deal' as const,
      extra: r,
    }));
  }

  async createContact(data: ContactData): Promise<CRMResult> {
    const z = await client();
    const res = await z.post('/Contacts', {
      data: [{
        First_Name: data.firstName,
        Last_Name: data.lastName ?? 'Unknown',
        Email: data.email,
        Phone: data.phone,
        Title: data.title,
        Account_Name: data.company,
        Description: data.notes,
      }],
    });
    const id = res.data.data?.[0]?.details?.id;
    return { success: true, id, message: `Contact created (ID: ${id})` };
  }

  async updateContact(id: string, data: Partial<ContactData>): Promise<CRMResult> {
    const z = await client();
    await z.put(`/Contacts/${id}`, {
      data: [{
        First_Name: data.firstName,
        Last_Name: data.lastName,
        Email: data.email,
        Phone: data.phone,
        Title: data.title,
        Account_Name: data.company,
        Description: data.notes,
      }],
    });
    return { success: true, id, message: `Contact updated` };
  }

  async createCompany(data: CompanyData): Promise<CRMResult> {
    const z = await client();
    const res = await z.post('/Accounts', {
      data: [{
        Account_Name: data.name,
        Phone: data.phone,
        Website: data.website,
        Industry: data.industry,
        Description: data.notes,
      }],
    });
    const id = res.data.data?.[0]?.details?.id;
    return { success: true, id, message: `Company created (ID: ${id})` };
  }

  async updateCompany(id: string, data: Partial<CompanyData>): Promise<CRMResult> {
    const z = await client();
    await z.put(`/Accounts/${id}`, {
      data: [{
        Account_Name: data.name,
        Phone: data.phone,
        Website: data.website,
        Industry: data.industry,
        Description: data.notes,
      }],
    });
    return { success: true, id, message: `Company updated` };
  }

  async createDeal(data: DealData): Promise<CRMResult> {
    const z = await client();
    const res = await z.post('/Deals', {
      data: [{
        Deal_Name: data.title,
        Amount: data.value,
        Stage: data.stage ?? 'Qualification',
        Closing_Date: data.closeDate ?? new Date().toISOString().split('T')[0],
        Description: data.notes,
      }],
    });
    const id = res.data.data?.[0]?.details?.id;
    return { success: true, id, message: `Deal created (ID: ${id})` };
  }

  async updateDeal(id: string, data: Partial<DealData>): Promise<CRMResult> {
    const z = await client();
    await z.put(`/Deals/${id}`, {
      data: [{
        Deal_Name: data.title,
        Amount: data.value,
        Stage: data.stage,
        Closing_Date: data.closeDate,
        Description: data.notes,
      }],
    });
    return { success: true, id, message: `Deal updated` };
  }

  async logActivity(data: ActivityData): Promise<CRMResult> {
    const z = await client();
    const res = await z.post('/Activities', {
      data: [{
        Subject: data.title ?? data.type,
        Activity_Type: data.type,
        Description: data.body,
      }],
    });
    const id = res.data.data?.[0]?.details?.id;
    return { success: true, id, message: `${data.type} logged` };
  }

  async getPipelineStages(): Promise<{ id: string; name: string }[]> {
    return [
      { id: 'Qualification', name: 'Qualification' },
      { id: 'Needs Analysis', name: 'Needs Analysis' },
      { id: 'Value Proposition', name: 'Value Proposition' },
      { id: 'Decision Makers', name: 'Decision Makers' },
      { id: 'Proposal/Price Quote', name: 'Proposal/Price Quote' },
      { id: 'Negotiation/Review', name: 'Negotiation/Review' },
      { id: 'Closed Won', name: 'Closed Won' },
      { id: 'Closed Lost', name: 'Closed Lost' },
    ];
  }

  async createTask(data: TaskData): Promise<CRMResult> {
    const z = await client();
    const res = await z.post('/Tasks', {
      data: [{
        Subject: data.title,
        Due_Date: data.dueDate ?? new Date().toISOString().split('T')[0],
        Description: data.notes,
        Priority: 'Normal',
      }],
    });
    const id = res.data.data?.[0]?.details?.id;
    return { success: true, id, message: `Task created (ID: ${id})` };
  }
}
