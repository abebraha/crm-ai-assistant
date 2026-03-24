/**
 * OpenAI function-calling tool definitions.
 * The AI uses these to decide which CRM operations to perform.
 */
import OpenAI from 'openai';

export const CRM_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  // ── Search ─────────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'search_contacts',
      description: 'Search for contacts/people in the CRM by name, email, or company.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search term (name, email, or company name)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_companies',
      description: 'Search for companies/accounts in the CRM by name.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Company or account name to search' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_deals',
      description: 'Search for deals/opportunities in the CRM. Pass an empty string to list all active/open deals. Pass "won" or "lost" to filter by status. Pass a name or company to text-search.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Deal name or company to search, OR empty string to list all active deals, OR "won"/"lost" to filter by status' },
        },
        required: ['query'],
      },
    },
  },

  // ── Contacts ────────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'create_contact',
      description: 'Create a new contact/person in the CRM.',
      parameters: {
        type: 'object',
        properties: {
          firstName:  { type: 'string' },
          lastName:   { type: 'string' },
          email:      { type: 'string' },
          phone:      { type: 'string' },
          title:      { type: 'string', description: 'Job title' },
          company:    { type: 'string', description: 'Company name (for association)' },
          notes:      { type: 'string' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_contact',
      description: 'Update an existing contact/person in the CRM.',
      parameters: {
        type: 'object',
        properties: {
          id:         { type: 'string', description: 'Contact ID (from a prior search)' },
          firstName:  { type: 'string' },
          lastName:   { type: 'string' },
          email:      { type: 'string' },
          phone:      { type: 'string' },
          title:      { type: 'string' },
          company:    { type: 'string' },
          notes:      { type: 'string' },
        },
        required: ['id'],
      },
    },
  },

  // ── Companies ───────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'create_company',
      description: 'Create a new company/account in the CRM.',
      parameters: {
        type: 'object',
        properties: {
          name:     { type: 'string' },
          domain:   { type: 'string', description: 'Website domain e.g. acme.com' },
          industry: { type: 'string' },
          phone:    { type: 'string' },
          website:  { type: 'string' },
          notes:    { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_company',
      description: 'Update an existing company/account in the CRM.',
      parameters: {
        type: 'object',
        properties: {
          id:       { type: 'string', description: 'Company ID (from a prior search)' },
          name:     { type: 'string' },
          domain:   { type: 'string' },
          industry: { type: 'string' },
          phone:    { type: 'string' },
          website:  { type: 'string' },
          notes:    { type: 'string' },
        },
        required: ['id'],
      },
    },
  },

  // ── Deals ───────────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'create_deal',
      description: 'Create a new deal/opportunity in the CRM.',
      parameters: {
        type: 'object',
        properties: {
          name:        { type: 'string', description: 'Deal name' },
          value:       { type: 'number', description: 'Deal value (numeric)' },
          currency:    { type: 'string', description: 'Currency code e.g. USD' },
          stage:       { type: 'string', description: 'Pipeline stage name' },
          closeDate:   { type: 'string', description: 'Expected close date (YYYY-MM-DD)' },
          contactId:   { type: 'string' },
          companyId:   { type: 'string' },
          probability: { type: 'number', description: 'Win probability 0-100' },
          notes:       { type: 'string' },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_deal',
      description: 'Update an existing deal/opportunity — change stage, value, close date, etc.',
      parameters: {
        type: 'object',
        properties: {
          id:          { type: 'string', description: 'Deal ID (from a prior search)' },
          name:        { type: 'string' },
          value:       { type: 'number' },
          currency:    { type: 'string' },
          stage:       { type: 'string' },
          closeDate:   { type: 'string', description: 'YYYY-MM-DD' },
          probability: { type: 'number' },
          notes:       { type: 'string' },
        },
        required: ['id'],
      },
    },
  },

  // ── Activities ──────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'log_activity',
      description: 'Log an activity (call, meeting, email, note) against a contact or deal.',
      parameters: {
        type: 'object',
        properties: {
          type:        { type: 'string', enum: ['call', 'email', 'meeting', 'note', 'sms'] },
          title:       { type: 'string', description: 'Activity subject / title' },
          body:        { type: 'string', description: 'Notes or body of the activity' },
          contactId:   { type: 'string' },
          dealId:      { type: 'string' },
          companyId:   { type: 'string' },
          occurredAt:  { type: 'string', description: 'ISO datetime of when the activity occurred' },
        },
        required: ['type', 'title'],
      },
    },
  },

  // ── Tasks ───────────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a task or follow-up reminder in the CRM.',
      parameters: {
        type: 'object',
        properties: {
          title:       { type: 'string', description: 'Task title / what needs to be done' },
          dueDate:     { type: 'string', description: 'Due date/time (ISO string)' },
          notes:       { type: 'string', description: 'Additional context or notes' },
          contactId:   { type: 'string' },
          dealId:      { type: 'string' },
          assignedTo:  { type: 'string', description: 'Assignee name or email' },
        },
        required: ['title'],
      },
    },
  },

  // ── Pipeline ────────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'get_pipeline_stages',
      description: 'Get the list of pipeline stages available in the CRM.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

export const SYSTEM_PROMPT = `You are an intelligent CRM assistant. Your job is to listen to what the user says and take the appropriate actions in their CRM.

RULES:
1. Always search before creating — if the user mentions a person, company, or deal by name, search for it first to get the ID.
2. You can call multiple tools in sequence within one turn (e.g. search then update).
3. After completing all CRM actions, write a brief, friendly summary of exactly what you did.
4. If the user's request is ambiguous (e.g., multiple contacts match), list the options and ask them to confirm before updating.
5. Infer today's date from context when needed. Today's date: ${new Date().toISOString().split('T')[0]}.
6. For relative dates like "end of month", "next Friday", "tomorrow" — calculate the actual date.
7. Always be concise but human. Don't use jargon. Don't repeat the user's message back to them.
8. If no CRM credentials are configured for a particular action, politely say so and explain what environment variable is needed.
9. When the search tool returns results, trust those results and tell the user what you found — even if the list is long. Never say "not found" when the tool returned matching records.
10. When a user asks to see their deals, pipeline, or active opportunities, call search_deals with an empty string ("") to list all active deals.

CLOSE CRM SPECIFICS (when Active CRM is CLOSE):
- Deals are called "Opportunities". They have statuses: Active, Won, Lost.
- To list all active pipeline deals, call search_deals with query "".
- Contacts in Close live inside Leads (Leads = companies/accounts).
- When the user asks "where are we with [person]?", search_contacts first, then if needed search for their company via search_companies.
- Searching contacts returns their name, title, email, phone, and associated lead/company.
`;