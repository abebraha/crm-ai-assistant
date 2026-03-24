import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAuth } from '@/lib/auth';
import { getUserCredentials, applyCredentialsToEnv } from '@/lib/credentials';
import { getCRMAdapter } from '@/lib/crm';
import { CRMType, ActionResult, CRMAdapter, SearchResult, CRMResult } from '@/lib/crm/types';
import { CRM_TOOLS, SYSTEM_PROMPT } from '@/lib/tools';

// ─── Execute a single tool call ───────────────────────────────────────────────

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  adapter: CRMAdapter
): Promise<{ result: unknown; label: string; status: 'success' | 'error' | 'info' }> {
  try {
    let result: unknown;
    let label = '';

    switch (toolName) {
      case 'search_contacts': {
        const r = await adapter.searchContacts(args.query as string);
        result = r; label = `Found ${r.length} contact(s) matching "${args.query}"`;
        break;
      }
      case 'search_companies': {
        const r = await adapter.searchCompanies(args.query as string);
        result = r; label = `Found ${r.length} company/companies matching "${args.query}"`;
        break;
      }
      case 'search_deals': {
        const r = await adapter.searchDeals(args.query as string);
        result = r; label = `Found ${r.length} deal(s) matching "${args.query}"`;
        break;
      }
      case 'create_contact': {
        const r = await adapter.createContact(args as Parameters<CRMAdapter['createContact']>[0]);
        result = r; label = r.success ? `✓ Contact created` : `✗ ${r.message}`;
        break;
      }
      case 'update_contact': {
        const { id, ...data } = args as { id: string } & Record<string, unknown>;
        const r = await adapter.updateContact(id, data as Parameters<CRMAdapter['updateContact']>[1]);
        result = r; label = r.success ? `✓ Contact updated` : `✗ ${r.message}`;
        break;
      }
      case 'create_company': {
        const r = await adapter.createCompany(args as Parameters<CRMAdapter['createCompany']>[0]);
        result = r; label = r.success ? `✓ Company created` : `✗ ${r.message}`;
        break;
      }
      case 'update_company': {
        const { id, ...data } = args as { id: string } & Record<string, unknown>;
        const r = await adapter.updateCompany(id, data as Parameters<CRMAdapter['updateCompany']>[1]);
        result = r; label = r.success ? `✓ Company updated` : `✗ ${r.message}`;
        break;
      }
      case 'create_deal': {
        const r = await adapter.createDeal(args as Parameters<CRMAdapter['createDeal']>[0]);
        result = r; label = r.success ? `✓ Deal created` : `✗ ${r.message}`;
        break;
      }
      case 'update_deal': {
        const { id, ...data } = args as { id: string } & Record<string, unknown>;
        const r = await adapter.updateDeal(id, data as Parameters<CRMAdapter['updateDeal']>[1]);
        result = r; label = r.success ? `✓ Deal updated` : `✗ ${r.message}`;
        break;
      }
      case 'log_activity': {
        const r = await adapter.logActivity(args as unknown as Parameters<CRMAdapter['logActivity']>[0]);
        result = r; label = r.success ? `✓ Activity logged` : `✗ ${r.message}`;
        break;
      }
      case 'create_task': {
        const r = await adapter.createTask(args as unknown as Parameters<CRMAdapter['createTask']>[0]);
        result = r; label = r.success ? `✓ Task created` : `✗ ${r.message}`;
        break;
      }
      case 'get_pipeline_stages': {
        const r = await adapter.getPipelineStages();
        result = r; label = `Pipeline stages: ${r.map((s) => s.name).join(', ')}`;
        break;
      }
      default:
        result = { error: `Unknown tool: ${toolName}` };
        label  = `Unknown tool: ${toolName}`;
    }

    const res = result as SearchResult[] | CRMResult | { id: string; name: string }[];
    let status: 'success' | 'error' | 'info' = 'success';
    if (toolName.startsWith('search_') || toolName === 'get_pipeline_stages') {
      status = 'info';
    } else if ('success' in (res as CRMResult) && !(res as CRMResult).success) {
      status = 'error';
    }

    return { result, label, status };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { result: { error: message }, label: `✗ ${toolName}: ${message}`, status: 'error' };
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { message, crm, history = [] } = await req.json() as {
      message: string;
      crm:     CRMType;
      history: { role: 'user' | 'assistant'; content: string }[];
    };

    if (!message) return NextResponse.json({ error: 'No message provided' }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'OPENAI_API_KEY is not configured on the server' }, { status: 500 });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // ── Load user credentials ────────────────────────────────────────────────
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'You must be signed in to use this feature' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const creds  = await getUserCredentials(userId, crm);

    if (!creds) {
      return NextResponse.json({
        error: `No ${crm} credentials found. Go to Settings to connect your ${crm} account.`,
        needsSetup: true,
      }, { status: 400 });
    }

    // Apply user's credentials to env so the CRM adapters can pick them up
    applyCredentialsToEnv(crm, creds);

    // ── Build adapter + run AI loop ──────────────────────────────────────────
    const adapter = getCRMAdapter(crm);
    const actions: ActionResult[] = [];

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: `${SYSTEM_PROMPT}\n\nActive CRM: ${crm.toUpperCase()}` },
      ...history.map((h) => ({ role: h.role, content: h.content }) as OpenAI.Chat.Completions.ChatCompletionMessageParam),
      { role: 'user', content: message },
    ];

    let response = await openai.chat.completions.create({
      model:       'gpt-4o',
      messages,
      tools:       CRM_TOOLS,
      tool_choice: 'auto',
    });

    while (response.choices[0].finish_reason === 'tool_calls') {
      const assistantMsg = response.choices[0].message;
      messages.push(assistantMsg);

      const toolResults: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];
      for (const toolCall of assistantMsg.tool_calls ?? []) {
        const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        const { result, label, status } = await executeTool(toolCall.function.name, args, adapter);
        actions.push({ label, status });
        toolResults.push({
          role:         'tool',
          tool_call_id: toolCall.id,
          content:      JSON.stringify(result),
        });
      }

      messages.push(...toolResults);

      response = await openai.chat.completions.create({
        model:       'gpt-4o',
        messages,
        tools:       CRM_TOOLS,
        tool_choice: 'auto',
      });
    }

    const reply = response.choices[0].message.content ?? 'Done.';
    return NextResponse.json({ reply, actions });
  } catch (err: unknown) {
    console.error('[/api/chat]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 });
  }
}