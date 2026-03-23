import axios from 'axios';
import {
  CRMAdapter, SearchResult, CRMResult,
  ContactData, CompanyData, DealData, ActivityData, TaskData,
} from './types';

const BASE = 'https://api.close.com/api/v1';

function close() {
  const key = process.env.CLOSE_API_KEY;
  if (!key) throw new Error('CLOSE_API_KEY is not set');
  return axios.create({
    baseURL: BASE,
    auth: { username: key, password: '' },
    headers: { 'Content-Type': 'application/json' },
  });
}

export class CloseAdapter implements CRMAdapter {
  async searchContacts(query: string): Promise<SearchResult[]> {
    // Close stores contacts inside Leads; search contacts by name
    const res = await close().get('/contact/', { params: { query } });
    return (res.data.data ?? []).slice(0, 5).map((c: { id: string; name: string; lead_id: string }) => ({
      id:   c.id,
      name: c.name,
      type: 'contact' as const,
      extra: c,
    }));
  }

  async searchCompanies(query: string): Promise<SearchResult[]> {
    // In Close, Leads serve as companies/accounts
    const res = await close().get('/lead/', { params: { query } });
    return (res.data.data ?? []).slice(0, 5).map((l: { id: string; display_name: string }) => ({
      id:   l.id,
      name: l.display_name,
      type: 'company' as const,
      extra: l,
    }));
  }

  async searchDeals(query: string): Promise<SearchResult[]> {
    // Close calls deals "Opportunities"
    const res = await close().get('/opportunity/', { params: { query } });
    return (res.data.data ?? []).slice(0, 5).map((o: { id: string; note: string; lead_name: string }) => ({
      id:   o.id,
      name: o.note || o.lead_name || 'Opportunity',
      type: 'deal' as const,
      extra: o,
    }));
  }

  async createContact(data: ContactData): Promise<CRMResult> {
    // Contacts in Close are nested under Leads. Create a lead + contact together.
    const res = await close().post('/lead/', {
      name:     data.company ?? `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim(),
      contacts: [{
        name:   `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim(),
        emails: data.email ? [{ email: data.email, type: 'office' }] : [],
        phones: data.phone ? [{ phone: data.phone, type: 'office' }] : [],
        title:  data.title,
      }],
    });
    const contactId = res.data.contacts?.[0]?.id;
    return { success: true, id: contactId ?? res.data.id, message: `Contact created under Lead (ID: ${res.data.id})` };
  }

  async updateContact(id: string, data: Partial<ContactData>): Promise<CRMResult> {
    await close().put(`/contact/${id}/`, {
      ...(data.firstName || data.lastName
        ? { name: `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim() }
        : {}),
      ...(data.email ? { emails: [{ email: data.email, type: 'office' }] } : {}),
      ...(data.phone ? { phones: [{ phone: data.phone, type: 'office' }] } : {}),
      ...(data.title ? { title: data.title } : {}),
    });
    return { success: true, id, message: `Contact ${id} updated` };
  }

  async createCompany(data: CompanyData): Promise<CRMResult> {
    const res = await close().post('/lead/', {
      name: data.name,
      url:  data.website ?? (data.domain ? `https://${data.domain}` : undefined),
    });
    return { success: true, id: res.data.id, message: `Lead/Company created (ID: ${res.data.id})` };
  }

  async updateCompany(id: string, data: Partial<CompanyData>): Promise<CRMResult> {
    await close().put(`/lead/${id}/`, {
      ...(data.name    && { name: data.name }),
      ...(data.website && { url:  data.website }),
    });
    return { success: true, id, message: `Lead ${id} updated` };
  }

  async createDeal(data: DealData): Promise<CRMResult> {
    // Must have a lead_id. Use companyId if provided, otherwise fail gracefully
    if (!data.companyId) {
      return { success: false, message: 'Close CRM requires a lead (company) ID to create an opportunity. Please search for the company first.' };
    }
    const res = await close().post('/opportunity/', {
      lead_id:     data.companyId,
      note:        data.name,
      value:       data.value ? Math.round(data.value * 100) : undefined, // Close uses cents
      value_currency: data.currency ?? 'USD',
      status:      data.stage ?? 'Active',
      date_won:    data.closeDate,
      contact_id:  data.contactId,
    });
    return { success: true, id: res.data.id, message: `Opportunity created (ID: ${res.data.id})` };
  }

  async updateDeal(id: string, data: Partial<DealData>): Promise<CRMResult> {
    await close().put(`/opportunity/${id}/`, {
      ...(data.name      && { note:           data.name }),
      ...(data.value     && { value:          Math.round(data.value * 100) }),
      ...(data.currency  && { value_currency: data.currency }),
      ...(data.stage      && { status:        data.stage }),
      ...(data.closeDate && { date_won:       data.closeDate }),
    });
    return { success: true, id, message: `Opportunity ${id} updated` };
  }

  async logActivity(data: ActivityData): Promise<CRMResult> {
    const typeEndpoints: Record<string, string> = {
      call: '/activity/call/', email: '/activity/email/',
      meeting: '/activity/meeting/', note: '/activity/note/', sms: '/activity/sms/',
    };
    const endpoint = typeEndpoints[data.type] ?? '/activity/note/';

    const body: Record<string, unknown> = {
      lead_id:    data.companyId ?? data.contactId, // Close needs lead_id
      note:       `${data.title}\n\n${data.body ?? ''}`.trim(),
      date_created: data.occurredAt ?? new Date().toISOString(),
    };

    if (data.type === 'call') {
      body.status = 'completed';
      body.duration = 0;
    }

    const res = await close().post(endpoint, body);
    return { success: true, id: res.data.id, message: `${data.type} logged` };
  }

  async createTask data: TaskData): Promise<CRMResult> {
    const res = await close().post('/task/', {
      lead_id:  data.dealId ?? data.contactId,
      text:     data.title,
      due_date: data.dueDate?.split('T')[0],
      is_complete: false,
    });
    return { success: true, id: res.data.id, message: `Task "${data.title}" created` };
  }

  async getPipelineStages(): Promise<{ id: string; name: string }[]> {
    // Close uses text statuses for opportunities: Active, Won, Lost
    return [
      { id: 'Active',  name: 'Active' },
      { id: 'Won',     name: 'Won' },
      { id: 'Lost',    name: 'Lost' },
    ];
  }
}
