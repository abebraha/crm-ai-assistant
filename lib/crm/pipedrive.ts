import axios from 'axios';
import {
  CRMAdapter, SearchResult, CRMResult,
  ContactData, CompanyData, DealData, ActivityData, TaskData,
} from './types';

const BASE = 'https://api.pipedrive.com/v1';

function pd() {
  const key = process.env.PIPEDRIVE_API_KEY;
  if (!key) throw new Error('PIPEDRIVE_API_KEY is not set');
  return axios.create({ baseURL: BASE, params: { api_token: key } });
}

export class PipedriveAdapter implements CRMAdapter {
  async searchContacts(query: string): Promise<SearchResult[]> {
    const res = await pd().get('/persons/search', { params: { term: query, limit: 5 } });
    return (res.data.data?.items ?? []).map((item: { item: { id: number; name: string } }) => ({
      id:   String(item.item.id),
      name: item.item.name,
      type: 'contact' as const,
      extra: item.item,
    }));
  }

  async searchCompanies(query: string): Promise<SearchResult[]> {
    const res = await pd().get('/organizations/search', { params: { term: query, limit: 5 } });
    return (res.data.data?.items ?? []).map((item: { item: { id: number; name: string } }) => ({
      id:   String(item.item.id),
      name: item.item.name,
      type: 'company' as const,
      extra: item.item,
    }));
  }

  async searchDeals(query: string): Promise<SearchResult[]> {
    const res = await pd().get('/deals/search', { params: { term: query, limit: 5 } });
    return (res.data.data?.items ?? []).map((item: { item: { id: number; title: string } }) => ({
      id:   String(item.item.id),
      name: item.item.title,
      type: 'deal' as const,
      extra: item.item,
    }));
  }

  async createContact(data: ContactData): Promise<CRMResult> {
    const res = await pd().post('/persons', {
      name:   `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim(),
      email:  data.email ? [{ value: data.email, primary: true }] : undefined,
      phone:  data.phone ? [{ value: data.phone, primary: true }] : undefined,
    });
    return { success: true, id: String(res.data.data.id), message: `Contact created (ID: ${res.data.data.id})` };
  }

  async updateContact(id: string, data: Partial<ContactData>): Promise<CRMResult> {
    await pd().put(`/persons/${id}`, {
      ...(data.firstName || data.lastName
        ? { name: `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim() }
        : {}),
      ...(data.email ? { email: [{ value: data.email, primary: true }] } : {}),
      ...(data.phone ? { phone: [{ value: data.phone, primary: true }] } : {}),
    });
    return { success: true, id, message: `Contact ${id} updated` };
  }

  async createCompany(data: CompanyData): Promise<CRMResult> {
    const res = await pd().post('/organizations', { name: data.name });
    return { success: true, id: String(res.data.data.id), message: `Organization created (ID: ${res.data.data.id})` };
  }

  async updateCompany(id: string, data: Partial<CompanyData>): Promise<CRMResult> {
    await pd().put(`/organizations/${id}`, { ...(data.name ? { name: data.name } : {}) });
    return { success: true, id, message: `Organization ${id} updated` };
  }

  async createDeal(data: DealData): Promise<CRMResult> {
    // Get stage id if stage name provided
    let stage_id: number | undefined;
    if (data.stage) {
      const stages = await pd().get('/stages');
      const found = (stages.data.data as { id: number; name: string }[])
        .find((s) => s.name.toLowerCase().includes(data.stage!.toLowerCase()));
      stage_id = found?.id;
    }

    const res = await pd().post('/deals', {
      title:    data.name ?? 'New Deal',
      value:    data.value,
      currency: data.currency ?? 'USD',
      stage_id,
      expected_close_date: data.closeDate,
      person_id: data.contactId ? parseInt(data.contactId) : undefined,
      org_jVita: data.companyId ? parseInt(data.companyId) : undefined,
    });
    return { success: true, id: String(res.data.data.id), message: `Deal "${data.name}" created (ID: ${res.data.data.id})` };
  }

  async updateDeal(id: string, data: Partial<DealData>): Promise<CRMResult> {
    // Resolve stage name → id
    let stage_id: number | undefined;
    if (data.stage) {
      const stages = await pd().get('/stages');
      const found = (stages.data.data as { id: number; name: string }[])
        .find((s) => s.name.toLowerCase().includes(data.stage!.toLowerCase()));
      stage_id = found?.id;
    }

    await pd().put(`/deals/${id}`, {
      ...(data.name       && { title:              data.name }),
      ...(data.value     && { value:               data.value }),
      ...(data.currency  && { currency:            data.currency }),
      ...(stage_id       && { stage_id }),
      ...(data.closeDate && { expected_close_date: data.closeDate }),
    });
    return { success: true, id, message: `Deal ${id} updated` };
  }

  async logActivity(data: ActivityData): Promise<CRMResult> {
    const typeMap: Record<string, string> = {
      call: 'call', email: 'email', meeting: 'meeting', note: 'note', sms: 'task',
    };
    const res = await pd().post('/activities', {
      subject:   data.title,
      note:      data.body,
      type:      typeMap[data.type] ?? 'task',
      done:      1,
      person_id: data.contactId ? parseInt(data.contactId) : undefined,
      deal_id:   data.dealId    ? parseInt(data.dealId)    : undefined,
      org_id:    data.companyId ? parseInt(data.companyId) : undefined,
      due_date:  data.occurredAt ? data.occurredAt.split('T')[0] : new Date().toISOString().split('T')[0],
    });
    return { success: true, id: String(res.data.data.id), message: `${data.type} logged` };
  }

  async createTask(data: TaskData): Promise<CRMResult> {
    const res = await pd().post('/activities', {
      subject:   data.title,
      note:      data.notes,
      type:      'task',
      done:      0,
      due_date:  data.dueDate ? data.dueDate.split('T')[0] : undefined,
      due_time:  data.dueDate ? data.dueDate.split('T')[1]?.slice(0, 5) : undefined,
      person_id: data.contactId ? parseInt(data.contactId) : undefined,
      deal_id:   data.dealId    ? parseInt(data.dealId)    : undefined,
    });
    return { success: true, id: String(res.data.data.id), message: `Task "${data.title}" created` };
  }

  async getPipelineStages(): Promise<{ id: string; name: string }[]> {
    const res = await pd().get('/stages');
    return (res.data.data as { id: number; name: string }[]).map((s) => ({
      id:   String(s.id),
      name: s.name,
    }));
  }
}