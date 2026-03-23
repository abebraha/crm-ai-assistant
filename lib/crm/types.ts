// ─── CRM selection ──────────────────────────────────────────────────────────

export type CRMType = 'hubspot' | 'salesforce' | 'pipedrive' | 'zoho' | 'close';

// ─── Chat message ────────────────────────────────────────────────────────

export interface ActionResult {
  label: string;
  status: 'success' | 'error' | 'info';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isVoice?: boolean;
  actions?: ActionResult[];
}

// ─── Normalized CRM entity types ─────────────────────────────────────────────

export interface ContactData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  title?: string;
  company?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface CompanyData {
  name: string;
  domain?: string;
  industry?: string;
  phone?: string;
  website?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface DealData {
  name?: string;
  value?: number;
  currency?: string;
  stage?: string;
  closeDate?: string;      // ISO date string
  contactId?: string;
  companyId?: string;
  probability?: number;
  notes?: string;
  [key: string]: unknown;
}

export interface ActivityData {
  type: 'call' | 'email' | 'meeting' | 'note' | 'sms';
  title: string;
  body?: string;
  contactId?: string;
  dealId?: string;
  companyId?: string;
  occurredAt?: string;     // ISO date string
}

export interface TaskData {
  title: string;
  dueDate?: string;        // ISO date string
  notes?: string;
  contactId?: string;
  dealId?: string;
  assignedTo?: string;
}

// ─── Generic result wrappers ─────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  name: string;
  type: 'contact' | 'company' | 'deal';
  extra?: Record<string, unknown>;
}

export interface CRMResult {
  success: boolean;
  id?: string;
  message?: string;
  data?: unknown;
}

// ─── CRM Adapter interface ───────────────────────────────────────────────────

export interface CRMAdapter {
  // Search
  searchContacts(query: string): Promise<SearchResult[]>;
  searchCompanies(query: string): Promise<SearchResult[]>;
  searchDeals(query: string): Promise<SearchResult[]>;

  // Contacts
  createContact(data: ContactData): Promise<CRMResult>;
  updateContact(id: string, data: Partial<ContactData>): Promise<CRMResult>;

  // Companies
  createCompany(data: CompanyData): Promise<CRMResult>;
  updateCompany(id: string, data: Partial<CompanyData>): Promise<CRMResult>;

  // Deals
  createDeal(data: DealData): Promise<CRMResult>;
  updateDeal(id: string, data: Partial<DealData>): Promise<CRMResult>;

  // Activities & tasks
  logActivity(data: ActivityData): Promise<CRMResult>;
  createTask(data: TaskData): Promise<CRMResult>;

  // Pipeline
  getPipelineStages(): Promise<{ id: string; name: string }[]>;
}