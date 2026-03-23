import axios from 'axios';
import {
  CRMAdapter, SearchResult, CRMResult,
  ContactData, CompanyData, DealData, ActivityData, TaskData,
} from './types';

const BASE = 'https://api.hubapi.com';

function client() {
  const key = process.env.HUBSPOT_API_KEY;
  if (!key) throw new Error('HUBSPOT_API_KEY is not set');
  return axios.create({
    baseURL: BASE,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  });
}

async function searchObjects(objectType: string, query: string): Promise<SearchResult[]> {
  const hs = client();
  const res = await hs.post(`/crm/v3/objects/${objectType}/search`, {
    query,
    limit: 5,
    properties: ['firstname', 'lastname', 'name', 'email', 'company', 'dealname', 'amount', 'dealstage'],
  });
  return res.data.results.map((r: Record<string, unknown>) => {
    const props = r.properties as Record<string, string>;
    return {
      id: r.id as string,
      name: props.dealname ?? props.name ?? `${props.firstname ?? ''} ${props.lastname ?? ''}`.trim(),
      type: objectType === 'deals' ? 'deal' : objectType === 'companies' ? 'company' : 'contact',
      extra: props,
    } as SearchResult;
  });
}

export class HubSpotAdapter implements CRMAdapter {
  async searchContacts(query: string) { return searchObjects('contacts', query); }
  async searchCompanies(query: string) { return searchObjects('companies', query); }
  async searchDeals(query: string) { return searchObjects('deals', query); }

  async createContact(data: ContactData): Promise<CRMResult> {
    const hs = client();
    const res = await hs.post('/crm/v3/objects/contacts', {
      properties: {
        firstname: data.firstName,
        lastname:  data.lastName,
        email:     data.email,
        phone:     data.phone,
        jobtitle:  data.title,
        company:   data.company,
        hs_note_status: data.notes,
      },
    });
    return { success: true, id: res.data.id, message: `Contact created (ID: ${res.data.id})` };
  }

  async updateContact(id: string, data: Partial<ContactData>): Promise<CRMResult> {
    const hs = client();
    await hs.patch(`/crm/v3/objects/contacts/${id}`, {
      properties: {
        ...(data.firstName && { firstname: data.firstName }),
        ...(data.lastName  && { lastname:  data.lastName }),
        ...(data.email     && { email:     data.email }),
        ...(data.phone     && { phone:     data.phone }),
        ...(data.title     && { jobtitle:  data.title }),
        ...(data.company   && { company:   data.company }),
      },
    });
    return { success: true, id, message: `Contact ${id} updated` };
  }

  async createCompany(data: CompanyData): Promise<CRMResult> {
    const hs = client();
    const res = await hs.post('/crm/v3/objects/companies', {
      properties: {
        name:     data.name,
        domain:   data.domain,
        industry: data.industry,
        phone:    data.phone,
        website:  data.website,
      },
    });
    return { success: true, id: res.data.id, message: `Company created (ID: ${res.data.id})` };
  }

  async updateCompany(id: string, data: Partial<CompanyData>): Promise<CRMResult> {
    const hs = client();
    await hs.patch(`/crm/v3/objects/companies/${id}`, {
      properties: {
        ...(data.name     && { name:     data.name }),
        ...(data.domain   && { domain:   data.domain }),
        ...(data.industry && { industry: data.industry }),
        ...(data.phone    && { phone:    data.phone }),
        ...(data.website  && { website:  data.website }),
      },
    });
    return { success: true, id, message: `Company ${id} updated` };
  }

  async createDeal(data: DealData): Promise<CRMResult> {
    const hs = client();
    const res = await hs.post('/crm/v3/objects/deals', {
      properties: {
        dealname:       data.name,
        amount:         data.value?.toString(),
        dealstage:      data.stage,
        closedate:      data.closeDate,
        deal_currency_code: data.currency ?? 'USD',
      },
    });
    // Associate contact/company if provided
    if (data.contactId) {
      await hs.put(`/crm/v3/objects/deals/${res.data.id}/associations/contacts/${data.contactId}/deal_to_contact`, {});
    }
    if (data.companyId) {
      await hs.put(`/crm/v3/objects/deals/${res.data.id}/associations/companies/${data.companyId}/deal_to_company`, {});
    }
    return { success: true, id: res.data.id, message: `Deal "${data.name}" created (ID: ${res.data.id})` };
  }

  async updateDeal(id: string, data: Partial<DealData>): Promise<CRMResult> {
    const hs = client();
    await hs.patch(`/crm/v3/objects/deals/${id}`, {
      properties: {
        ...(data.name      && { dealname:  data.name }),
        ...(data.value     && { amount:    data.value.toString() }),
        ...(data.stage     && { dealstage: data.stage }),
        ...(data.closeDate && { closedate: data.closeDate }),
      },
    });
    return { success: true, id, message: `Deal ${id} updated` };
  }

  async logActivity(data: ActivityData): Promise<CRMResult> {
    const hs = client();
    // HubSpot uses engagement objects for activities
    const engagementType = data.type === 'call' ? 'CALL'
      : data.type === 'email' ? 'EMAIL'
      : data.type === 'meeting' ? 'MEETING'
      : 'NOTE';

    const body: Record<string, unknown> = {
      engagement: { active: true, type: engagementType, timestamp: data.occurredAt ? new Date(data.occurredAt).getTime() : Date.now() },
      associations: {
        contactIds: data.contactId ? [parseInt(data.contactId)] : [],
        companyIds: data.companyId ? [parseInt(data.companyId)] : [],
        dealIds:    data.dealId    ? [parseInt(data.dealId)]    : [],
      },
      metadata: {
        body: data.body ?? data.title,
        ...(engagementType === 'CALL' && { toNumber: '', fromNumber: '', status: 'COMPLETED', disposition: '' }),
      },
    };

    const res = await hs.post('/engagements/v1/engagements', body);
    return { success: true, id: res.data.engagement?.id?.toString(), message: `${data.type} logged` };
  }

  async createTask(data: TaskData): Promise<CRMResult> {
    const hs = client();
    const res = await hs.post('/crm/v3/objects/tasks', {
      properties: {
        hs_task_subject: data.title,
        hs_task_body:    data.notes ?? '',
        hs_timestamp:    data.dueDate ? new Date(data.dueDate).getTime().toString() : undefined,
        hs_task_status:  'NOT_STARTED',
      },
    });
    return { success: true, id: res.data.id, message: `Task "${data.title}" created` };
  }

  async getPipelineStages(): Promise<{ id: string; name: string }[]> {
    const hs = client();
    const res = await hs.get('/crm/v3/pipelines/deals');
    const pipeline = res.data.results?.[0];
    if (!pipeline) return [];
    return pipeline.stages.map((s: Record<string, string>) => ({ id: s.id, name: s.label }));
  }
}