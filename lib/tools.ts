/**
 * OpenAI function-calling tool definitions + system prompt.
 */
import OpenAI from 'openai';

export const CRM_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [

  // ── Rich lookup ──────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'get_lead_overview',
      description: [
        'Get a comprehensive status update on a person or company: their contact details,',
        'all active deals/opportunities, and recent call/email/meeting history.',
        'Use this when the user asks "where are we with X?", "what\'s the status of X?",',
        '"catch me up on X", "what happened with X?", or any status-check question.',
        'This is the most powerful lookup tool — prefer it over separate searches for status questions.',
      ].join(' '),
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Person name or company name to look up (e.g. "Chaim Handler", "Acme Corp")',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_activities',
      description: 'List recent calls, emails, meetings, and notes for a specific lead/company by their CRM ID.',
      parameters: {
        type: 'object',
        properties: {
          lead_id: {
            type: 'string',
            description: 'The lead/company ID (obtained from get_lead_overview or search_companies)',
          },
        },
        required: ['lead_id'],
      },
    },
  },

  // ── Search ───────────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'search_contacts',
      description: 'Search for contacts/people by name, email, or company. Returns name, email, phone, title, and associated company.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Name, email, or company to search' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_companies',
      description: 'Search for companies/accounts by name.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Company or account name' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_deals',
      description: [
        'Search for deals/opportunities.',
        'Pass an EMPTY STRING to list all active/open deals in the pipeline.',
        'Pass "won" or "lost" to filter by outcome.',
        'Pass a company or deal name to text-search.',
      ].join(' '),
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Empty string = all active deals. "won"/"lost" = filter by status. Otherwise = text search.',
          },
        },
        required: ['query'],
      },
    },
  },

  // ── Contacts ─────────────────────────────────────────────────────────────────
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
          company:    { type: 'string', description: 'Company name' },
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
      description: 'Update an existing contact. Requires the contact ID from a prior search.',
      parameters: {
        type: 'object',
        properties: {
          id:        { type: 'string', description: 'Contact ID' },
          firstName: { type: 'string' },
          lastName:  { type: 'string' },
          email:     { type: 'string' },
          phone:     { type: 'string' },
          title:     { type: 'string' },
          company:   { type: 'string' },
          notes:     { type: 'string' },
        },
        required: ['id'],
      },
    },
  },

  // ── Companies ─────────────────────────────────────────────────────────────────
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
      description: 'Update an existing company. Requires company ID from a prior search.',
      parameters: {
        type: 'object',
        properties: {
          id:       { type: 'string', description: 'Company ID' },
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

  // ── Deals ─────────────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'create_deal',
      description: 'Create a new deal/opportunity.',
      parameters: {
        type: 'object',
        properties: {
          name:        { type: 'string', description: 'Deal name' },
          value:       { type: 'number', description: 'Deal value (numeric)' },
          currency:    { type: 'string', description: 'Currency code e.g. USD' },
          stage:       { type: 'string', description: 'Pipeline stage' },
          closeDate:   { type: 'string', description: 'Expected close date (YYYY-MM-DD)' },
          contactId:   { type: 'string' },
          companyId:   { type: 'string' },
          probability: { type: 'number', description: '0–100' },
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
      description: 'Update an existing deal — change stage, value, close date, etc.',
      parameters: {
        type: 'object',
        properties: {
          id:          { type: 'string', description: 'Deal ID' },
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

  // ── Activities ────────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'log_activity',
      description: 'Log a call, meeting, email, or note against a contact or deal.',
      parameters: {
        type: 'object',
        properties: {
          type:       { type: 'string', enum: ['call', 'email', 'meeting', 'note', 'sms'] },
          title:      { type: 'string', description: 'Subject / title' },
          body:       { type: 'string', description: 'Notes or body' },
          contactId:  { type: 'string' },
          dealId:     { type: 'string' },
          companyId:  { type: 'string' },
          occurredAt: { type: 'string', description: 'ISO datetime' },
        },
        required: ['type', 'title'],
      },
    },
  },

  // ── Tasks ─────────────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Create a follow-up task or reminder.',
      parameters: {
        type: 'object',
        properties: {
          title:      { type: 'string', description: 'What needs to be done' },
          dueDate:    { type: 'string', description: 'Due date/time (ISO)' },
          notes:      { type: 'string' },
          contactId:  { type: 'string' },
          dealId:     { type: 'string' },
          assignedTo: { type: 'string' },
        },
        required: ['title'],
      },
    },
  },

  // ── Pipeline ──────────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'get_pipeline_stages',
      description: 'Get the list of available pipeline stages.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are an intelligent CRM assistant. Your job is to help the user understand and update their CRM.

## Core rules
1. Always search before creating — if the user mentions a person or company by name, search first to get their ID.
2. You can call multiple tools in sequence within one turn.
3. After all lookups, write a clear, friendly summary. For status questions, present the data in a readable format (not just raw IDs).
4. If a search returns multiple matches, list them and ask the user to confirm before updating.
5. Today's date: ${new Date().toISOString().split('T')[0]}. Calculate exact dates for "end of month", "next Friday", etc.
6. When the search tool returns results, always report what you found — NEVER say "not found" when results were returned.
7. For listing the pipeline / active deals, call search_deals with an empty string "".

## Write operations — IMPORTANT
Before calling any write tool (create_contact, update_contact, create_company, update_company, create_deal, update_deal, log_activity, create_task):
- Do any needed searches FIRST to gather IDs and confirm you have the right record.
- Then call the write tool. The system will intercept it and show the user a confirmation preview before actually executing it.
- Describe what you're about to do in future/conditional tense: "I'll update...", "I'll create...", "I'll log..."
- After the preview, let the user know they can confirm or cancel.

## Status check questions
When the user asks "where are we with X?", "what's the status of X?", "catch me up on X":
- Use get_lead_overview first — it returns contacts, opportunities, AND recent activity history in one call.
- Summarize: who the contact is, what deals are active (name, value, status), and the last 3–5 activities.

## Close CRM specifics
- The core entity in Close is the **Lead** (= a company/account). Contacts live inside Leads.
- Deals are called **Opportunities** (statuses: Active, Won, Lost).
- get_lead_overview searches both contacts and leads, so it handles "Chaim Handler" OR "Acme Corp" equally well.
- When creating a deal, you need the lead_id (company). Search the company first.
- For logging activities, use the lead_id (from the company) as the companyId.
`;
