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

// ─── Minimal type helpers ─────────────────────────────────────────────────────

interface CloseContact {
  id: string;
  name: string;
  title?: string;
  lead_id: string;
  lead_name?: string;
  emails?: { email: string; type: string }[];
  phones?: { phone: string; type: string }[];
}

interface CloseOpportunity {
  id: string;
  note?: string;
  lead_name?: string;
  status_label?: string;
  value?: number;
  value_formatted?: string;
  pipeline_name?: string;
  date_won?: string;
  contact_name?: string;
  close_date?: string;
}

interface CloseActivity {
  _type?: string;
  date_created?: string;
  note?: string;
  subject?: string;
  body_preview?: string;
  direction?: string;
  user_name?: string;
  duration?: number;
}

interface CloseLead {
  id: string;
  display_name?: string;
  status_label?: string;
  contacts?: CloseContact[];
  opportunities?: CloseOpportunity[];
  addresses?: { label: string; city?: string; country?: string }[];
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export class CloseAdapter implements CRMAdapter {

  // ── Search ──────────────────────────────────────────────────────────────────

  async searchContacts(query: string): Promise<SearchResult[]> {
    const res = await close().get('/contact/', { params: { query, _limit: 10 } });
    return (res.data.data ?? []).slice(0, 10).map((c: CloseContact) => ({
      id:   c.id,
      name: c.name,
      type: 'contact' as const,
      extra: {
        title:     c.title,
        lead_id:   c.lead_id,
        lead_name: c.lead_name,
        email:     c.emails?.[0]?.email,
        phone:     c.phones?.[0]?.phone,
      },
    }));
  }

  async searchCompanies(query: string): Promise<SearchResult[]> {
    const res = await close().get('/lead/', { params: { query, _limit: 10 } });
    return (res.data.data ?? []).slice(0, 10).map((l: CloseLead) => ({
      id:   l.id,
      name: l.display_name ?? '',
      type: 'company' as const,
      extra: { status: l.status_label },
    }));
  }

  async searchDeals(query: string): Promise<SearchResult[]> {
    const q = (query ?? '').toLowerCase().trim();
    const isListAll = !q || ['active', 'pipeline', 'all', 'open', 'deals', 'opportunities'].includes(q);

    // Close API uses status_type (lowercase: active, won, lost) not status=Active
    let params: Record<string, string | number>;
    if (isListAll) {
      params = { status_type: 'active', _limit: 25 };
    } else if (q === 'won') {
      params = { status_type: 'won', _limit: 25 };
    } else if (q === 'lost') {
      params = { status_type: 'lost', _limit: 25 };
    } else {
      params = { query, _limit: 10 };
    }

    const res = await close().get('/opportunity/', { params });
    return (res.data.data ?? []).slice(0, 25).map((o: CloseOpportunity) => ({
      id:   o.id,
      name: o.note || o.lead_name || 'Opportunity',
      type: 'deal' as const,
      extra: {
        status:       o.status_label,
        value:        o.value_formatted ?? o.value,
        lead_name:    o.lead_name,
        pipeline:     o.pipeline_name,
        close_date:   o.date_won ?? o.close_date,
        contact_name: o.contact_name,
      },
    }));
  }

  // ── Rich lookup (Close-specific) ─────────────────────────────────────────────

  /**
   * Comprehensive overview of a person or company:
   * searches contacts + leads, then fetches their opportunities and recent activities.
   */
  async getLeadOverview(query: string): Promise<Record<string, unknown>> {
    const api = close();
    let leadId: string | null = null;
    let matchedContact: CloseContact | null = null;

    // 1. Try contact search first
    try {
      const cRes = await api.get('/contact/', { params: { query, _limit: 5 } });
      const contacts: CloseContact[] = cRes.data.data ?? [];
      if (contacts.length > 0) {
        matchedContact = contacts[0];
        leadId = matchedContact.lead_id;
      }
    } catch { /* fall through */ }

    // 2. If no contact match, try lead (company) search
    if (!leadId) {
      try {
        const lRes = await api.get('/lead/', { params: { query, _limit: 5 } });
        const leads: CloseLead[] = lRes.data.data ?? [];
        if (leads.length > 0) leadId = leads[0].id;
      } catch { /* fall through */ }
    }

    if (!leadId) {
      return { found: false, message: `No contact or company matching "${query}" found in Close.` };
    }

    // 3. Fetch lead details, opportunities, and recent activities in parallel
    const [leadRes, oppsRes, actRes] = await Promise.all([
      api.get(`/lead/${leadId}/`).catch(() => null),
      api.get('/opportunity/', { params: { lead_id: leadId, _limit: 10 } }).catch(() => ({ data: { data: [] } })),
      api.get('/activity/', {
        params: { lead_id: leadId, _limit: 15, _order_by: '-date_created' },
      }).catch(() => ({ data: { data: [] } })),
    ]);

    const lead: CloseLead = leadRes?.data ?? {};
    const opps: CloseOpportunity[] = oppsRes.data.data ?? [];
    const acts: CloseActivity[] = actRes.data.data ?? [];

    return {
      found: true,
      lead: {
        id: leadId,
        name: lead.display_name,
        status: lead.status_label,
        contacts: (lead.contacts ?? []).map((c: CloseContact) => ({
          name:  c.name,
          title: c.title ?? null,
          email: c.emails?.[0]?.email ?? null,
          phone: c.phones?.[0]?.phone ?? null,
        })),
      },
      opportunities: opps.map((o) => ({
        id:         o.id,
        name:       o.note || 'Opportunity',
        status:     o.status_label,
        value:      o.value_formatted ?? (o.value != null ? `$${o.value / 100}` : null),
        pipeline:   o.pipeline_name,
        close_date: o.date_won ?? o.close_date ?? null,
      })),
      recent_activities: acts.slice(0, 8).map((a) => ({
        type:      (a._type ?? '').replace('ActivityCall', 'call').replace('ActivityEmail', 'email')
                      .replace('ActivityNote', 'note').replace('ActivityMeeting', 'meeting')
                      .replace('Activity', '').toLowerCase(),
        date:      a.date_created?.split('T')[0] ?? null,
        summary:   a.subject || a.note || a.body_preview || null,
        direction: a.direction ?? null,
        by:        a.user_name ?? null,
      })),
    };
  }

  /**
   * List recent activities for a lead (company) ID.
   */
  async listActivities(leadId: string): Promise<Record<string, unknown>[]> {
    const res = await close().get('/activity/', {
      params: { lead_id: leadId, _limit: 20, _order_by: '-date_created' },
    });
    return (res.data.data ?? []).map((a: CloseActivity) => ({
      type:      (a._type ?? '').replace(/Activity/gi, '').toLowerCase(),
      date:      a.date_created?.split('T')[0] ?? null,
      summary:   a.subject || a.note || a.body_preview || '',
      direction: a.direction ?? null,
      by:        a.user_name ?? null,
      duration:  a.duration ?? null,
    }));
  }

  // ── Write ────────────────────────────────────────────────────────────────────

  async createContact(data: ContactData): Promise<CRMResult> {
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
    if (!data.companyId) {
      return { success: false, message: 'Close CRM requires a lead (company) ID to create an opportunity. Search for the company first.' };
    }
    const res = await close().post('/opportunity/', {
      lead_id:        data.companyId,
      note:           data.name,
      value:          data.value ? Math.round(data.value * 100) : undefined,
      value_currency: data.currency ?? 'USD',
      status:         data.stage ?? 'Active',
      date_won:       data.closeDate,
      contact_id:     data.contactId,
    });
    return { success: true, id: res.data.id, message: `Opportunity created (ID: ${res.data.id})` };
  }

  async updateDeal(id: string, data: Partial<DealData>): Promise<CRMResult> {
    await close().put(`/opportunity/${id}/`, {
      ...(data.name      && { note:           data.name }),
      ...(data.value     && { value:          Math.round(data.value * 100) }),
      ...(data.currency  && { value_currency: data.currency }),
      ...(data.stage     && { status:         data.stage }),
      ...(data.closeDate && { date_won:       data.closeDate }),
    });
    return { success: true, id, message: `Opportunity ${id} updated` };
  }

  async logActivity(data: ActivityData): Promise<CRMResult> {
    const typeEndpoints: Record<string, string> = {
      call:    '/activity/call/',
      email:   '/activity/email/',
      meeting: '/activity/meeting/',
      note:    '/activity/note/',
      sms:     '/activity/sms/',
    };
    const endpoint = typeEndpoints[data.type] ?? '/activity/note/';

    const body: Record<string, unknown> = {
      lead_id:      data.companyId ?? data.contactId,
      note:         `${data.title}\n\n${data.body ?? ''}`.trim(),
      date_created: data.occurredAt ?? new Date().toISOString(),
    };
    if (data.type === 'call') { body.status = 'completed'; body.duration = 0; }

    const res = await close().post(endpoint, body);
    return { success: true, id: res.data.id, message: `${data.type} logged` };
  }

  async createTask(data: TaskData): Promise<CRMResult> {
    const res = await close().post('/task/', {
      lead_id:     data.dealId ?? data.contactId,
      text:        data.title,
      due_date:    data.dueDate?.split('T')[0],
      is_complete: false,
    });
    return { success: true, id: res.data.id, message: `Task "${data.title}" created` };
  }

  async getPipelineStages(): Promise<{ id: string; name: string }[]> {
    return [
      { id: 'Active', name: 'Active'  },
      { id: 'Won',    name: 'Won'     },
      { id: 'Lost',   name: 'Lost'    },
    ];
  }
}
