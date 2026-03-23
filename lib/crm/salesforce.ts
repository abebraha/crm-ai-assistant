import jsforce from 'jsforce';
import {
  CRMAdapter, SearchResult, CRMResult,
  ContactData, CompanyData, DealData, ActivityData, TaskData,
} from './types';

function getConn() {
  const { SALESFORCE_USERNAME, SALESFORCE_PASSWORD, SALESFORCE_SECURITY_TOKEN, SALESFORCE_LOGIN_URL } = process.env;
  if (!SALESFORCE_USERNAME || !SALESFORCE_PASSWORD) {
    throw new Error('SALESFORCE_USERNAME and SALESFORCE_PASSWORD are not set');
  }
  return new jsforce.Connection({ loginUrl: SALESFORCE_LOGIN_URL ?? 'https://login.salesforce.com' });
}

async function withAuth<T>(fn: (conn: jsforce.Connection) => Promise<T>): Promise<T> {
  const conn = getConn();
  await conn.login(
    process.env.SALESFORCE_USERNAME!,
    (process.env.SALESFORCE_PASSWORD ?? '') + (process.env.SALESFORCE_SECURITY_TOKEN ?? '')
  );
  return fn(conn);
}

export class SalesforceAdapter implements CRMAdapter {
  async searchContacts(query: string): Promise<SearchResult[]> {
    return withAuth(async (conn) => {
      const q = `SELECT Id, FirstName, LastName, Email, Account.Name FROM Contact WHERE Name LIKE '%${query}%' OR Email LIKE '%${query}%' LIMIT 5`;
      const res = await conn.query<{ Id: string; FirstName: string; LastName: string; Email: string }>(q);
      return res.records.map((r) => ({
        id: r.Id,
        name: `${r.FirstName} ${r.LastName}`.trim(),
        type: 'contact' as const,
        extra: r,
      }));
    });
  }

  async searchCompanies(query: string): Promise<SearchResult[]> {
    return withAuth(async (conn) => {
      const q = `SELECT Id, Name, Industry, Website FROM Account WHERE Name LIKE '%${query}%' LIMIT 5`;
      const res = await conn.query<{ Id: string; Name: string }>(q);
      return res.records.map((r) => ({ id: r.Id, name: r.Name, type: 'company' as const, extra: r }));
    });
  }

  async searchDeals(query: string): Promise<SearchResult[]> {
    return withAuth(async (conn) => {
      const q = `SELECT Id, Name, Amount, StageName, CloseDate FROM Opportunity WHERE Name LIKE '%${query}%' LIMIT 5`;
      const res = await conn.query<{ Id: string; Name: string }>(q);
      return res.records.map((r) => ({ id: r.Id, name: r.Name, type: 'deal' as const, extra: r }));
    });
  }

  async createContact(data: ContactData): Promise<CRMResult> {
    return withAuth(async (conn) => {
      const res = await conn.sobject('Contact').create({
        FirstName: data.firstName,
        LastName:  data.lastName ?? 'Unknown',
        Email:     data.email,
        Phone:     data.phone,
        Title:     data.title,
        Department: data.company,
      });
      if (Array.isArray(res) || !res.success) throw new Error('Contact creation failed');
      return { success: true, id: res.id, message: `Contact created (ID: ${res.id})` };
    });
  }

  async updateContact(id: string, data: Partial<ContactData>): Promise<CRMResult> {
    return withAuth(async (conn) => {
      await conn.sobject('Contact').update({
        Id: id,
        ...(data.firstName && { FirstName: data.firstName }),
        ...(data.lastName  && { LastName:  data.lastName }),
        ...(data.email     && { Email:     data.email }),
        ...(data.phone     && { Phone:     data.phone }),
        ...(data.title     && { Title:     data.title }),
      });
      return { success: true, id, message: `Contact ${id} updated` };
    });
  }

  async createCompany(data: CompanyData): Promise<CRMResult> {
    return withAuth(async (conn) => {
      const res = await conn.sobject('Account').create({
        Name:     data.name,
        Website:  data.website ?? data.domain,
        Industry: data.industry,
        Phone:    data.phone,
      });
      if (Array.isArray(res) || !res.success) throw new Error('Account creation failed');
      return { success: true, id: res.id, message: `Account created (ID: ${res.id})` };
    });
  }

  async updateCompany(id: string, data: Partial<CompanyData>): Promise<CRMResult> {
    return withAuth(async (conn) => {
      await conn.sobject('Account').update({
        Id: id,
        ...(data.name     && { Name:     data.name }),
        ...(data.website  && { Website:  data.website }),
        ...(data.industry && { Industry: data.industry }),
        ...(data.phone    && { Phone:    data.phone }),
      });
      return { success: true, id, message: `Account ${id} updated` };
    });
  }

  async createDeal(data: DealData): Promise<CRMResult> {
    return withAuth(async (conn) => {
      const res = await conn.sobject('Opportunity').create({
        Name:        data.name ?? 'New Opportunity',
        Amount:      data.value,
        StageName:   data.stage ?? 'Prospecting',
        CloseDate:   data.closeDate ?? new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0],
        Probability: data.probability,
        AccountId:   data.companyId,
        Description: data.notes,
      });
      if (Array.isArray(res) || !res.success) throw new Error('Opportunity creation failed');
      return { success: true, id: res.id, message: `Opportunity created (ID: ${res.id})` };
    });
  }

  async updateDeal(id: string, data: Partial<DealData>): Promise<CRMResult> {
    return withAuth(async (conn) => {
      await conn.sobject('Opportunity').update({
        Id: id,
        ...(data.name        && { Name:        data.name }),
        ...(data.value       && { Amount:      data.value }),
        ...(data.stage       && { StageName:   data.stage }),
        ...(data.closeDate   && { CloseDate:   data.closeDate }),
        ...(data.probability && { Probability: data.probability }),
        ...(data.notes       && { Description: data.notes }),
      });
      return { success: true, id, message: `Opportunity ${id} updated` };
    });
  }

  async logActivity(data: ActivityData): Promise<CRMResult> {
    return withAuth(async (conn) => {
      if (data.type === 'call') {
        const res = await conn.sobject('Task').create({
          Subject:      data.title,
          Description:  data.body,
          Type:         'Call',
          Status:       'Completed',
          ActivityDate: (data.occurredAt ?? new Date().toISOString()).split('T')[0],
          WhoId:        data.contactId,
          WhatId:       data.dealId ?? data.companyId,
        });
        if (Array.isArray(res) || !res.success) throw new Error('Task creation failed');
        return { success: true, id: res.id, message: `Call logged` };
      } else {
        const res = await conn.sobject('Task').create({
          Subject:      data.title,
          Description:  data.body,
          Type:         data.type === 'meeting' ? 'Meeting' : 'Other',
          Status:       'Completed',
          ActivityDate: (data.occurredAt ?? new Date().toISOString()).split('T')[0],
          WhoId:        data.contactId,
          WhatId:       data.dealId ?? data.companyId,
        });
        if (Array.isArray(res) || !res.success) throw new Error('Task creation failed');
        return { success: true, id: res.id, message: `${data.type} logged` };
      }
    });
  }

  async createTask(data: TaskData): Promise<CRMResult> {
    return withAuth(async (conn) => {
      const res = await conn.sobject('Task').create({
        Subject:      data.title,
        Description:  data.notes,
        Status:       'Not Started',
        ActivityDate: data.dueDate?.split('T')[0],
        WhoId:        data.contactId,
        WhatId:       data.dealId,
      });
      if (Array.isArray(res) || !res.success) throw new Error('Task creation failed');
      return { success: true, id: res.id, message: `Task "${data.title}" created` };
    });
  }

  async getPipelineStages(): Promise<{ id: string; name: string }[]> {
    return withAuth(async (conn) => {
      const res = await conn.describe('Opportunity');
      const stageField = res.fields.find((f: { name: string }) => f.name === 'StageName');
      if (!stageField) return [];
      return (stageField.picklistValues as { value: string; label: string }[]).map((v) => ({
        id:   v.value,
        name: v.label,
      }));
    });
  }
}