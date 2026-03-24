import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getAuth } from '@/lib/auth';
import { getUserCredentials, applyCredentialsToEnv } from '@/lib/credentials';
import { getCRMAdapter } from '@/lib/crm';
import { CRMType, ActionResult, CRMAdapter, PendingAction, SearchResult, CRMResult } from '@/lib/crm/types';
import { CRM_TOOLS, SYSTEM_PROMPT } from '@/lib/tools';

// ─── Write tools that require user confirmation ───────────────────────────────

const WRITE_TOOLS = new Set([
  'create_contact', 'update_contact',
  'create_company', 'update_company',
  'create_deal',    'update_deal',
  'log_activity',   'create_task',
]);

// ─── Human-readable description of a pending write ───────────────────────────

function describePending(tool: string, args: Record<string, unknown>): string {
  const a = args as Record<string, string | number | undefined>;
  switch (tool) {
    case 'create_contact': {
      const name = [a.firstName, a.lastName].filter(Boolean).join(' ') || 'new contact';
      return `Create contact: ${name}${a.email ? ` <${a.email}>` : ''}${a.company ? ` at ${a.company}` : ''}`;
    }
    case 'update_contact': {
      const { id, ...rest } = a;
      const fields = Object.entries(rest).map(([k, v]) => `${k} → ${v}`).join(', ');
      return `Update contact (${id}): ${fields}`;
    }
    case 'create_company': {
      return `Create company: ${a.name}${a.domain ? ` (${a.domain})` : ''}`;
    }
    case 'update_company': {
      const { id, ...rest } = a;
      const fields = Object.entries(rest).map(([k, v]) => `${k} → ${v}`).join(', ');
      return `Update company (${id}): ${fields}`;
    }
    case 'create_deal': {
      return `Create deal: "${a.name}"${a.value ? ` — $${a.value}` : ''}${a.stage ? ` [${a.stage}]` : ''}`;
    }
    case 'update_deal': {
      const { id, ...rest } = a;
      const fields = Object.entries(rest).map(([k, v]) => `${k} → ${v}`).join(', ');
      return `Update deal (${id}): ${fields}`;
    }
    case 'log_activity': {
      return `Log ${a.type}: "${a.title}"${a.body ? ` — ${String(a.body).slice(0, 60)}` : ''}`;
    }
    case 'create_task': {
      return `Create task: "${a.title}"${a.dueDate ? ` (due ${a.dueDate})` : ''}`;
    }
    default:
      return `${tool}: ${JSON.stringify(args).slice(0, 120)}`;
  }
}

// ─── Execute a single already-confirmed tool call ─────────────────────────────

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  adapter: CRMAdapter,
): Promise<{ result: unknown; label: string; status: 'success' | 'error' | 'info' }> {
  try {
    let result: unknown;
    let label = '';

    switch (toolName) {
      /* ── Lookups ── */
      case 'get_lead_overview': {
        if (!adapter.getLeadOverview) {
          result = { error: 'Lead overview not supported for this CRM. Use search_contacts and search_deals instead.' };
          label  = 'Lead overview not available';
          break;
        }
        const r = await adapter.getLeadOverview(args.query as string);
        result = r;
        const leadName = (r.lead as Record<string, unknown>)?.name ?? args.query;
        label  = r.found ? `Got overview for "${leadName}"` : `No record found for "${args.query}"`;
        break;
      }
      case 'list_activities': {
        if (!adapter.listActivities) {
          result = { error: 'Activity listing not available for this CRM.' };
          label  = 'Activities not available';
          break;
        }
        const r = await adapter.listActivities(args.lead_id as string);
        result = r;
        label  = `Found ${r.length} recent activities`;
        break;
      }
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
        const tag = (args.query as string) ? `"${args.query}"` : 'all active';
        result = r; label = `Found ${r.length} deal(s) — ${tag}`;
        break;
      }
      case 'get_pipeline_stages': {
        const r = await adapter.getPipelineStages();
        result = r; label = `Pipeline stages: ${r.map((s) => s.name).join(', ')}`;
        break;
      }

      /* ── Writes ── */
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
      default:
        result = { error: `Unknown tool: ${toolName}` };
        label  = `Unknown tool: ${toolName}`;
    }

    const isRead = !WRITE_TOOLS.has(toolName);
    const res = result as SearchResult[] | CRMResult;
    let status: 'success' | 'error' | 'info' = isRead ? 'info' : 'success';
    if (!isRead && 'success' in (res as CRMResult) && !(res as CRMResult).success) {
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
    const body = await req.json() as {
      message?:       string;
      crm:            CRMType;
      history:        { role: 'user' | 'assistant'; content: string }[];
      // Confirmation flow
      isConfirmation?: boolean;
      pendingActions?: PendingAction[];
    };

    const { crm, history = [], isConfirmation, pendingActions: pendingToExecute } = body;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured on the server' }, { status: 500 });
    }

    // ── Auth ──────────────────────────────────────────────────────────────────
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'You must be signed in' }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;
    const creds  = await getUserCredentials(userId, crm);
    if (!creds) {
      return NextResponse.json({
        error: `No ${crm} credentials found. Go to Settings to connect your ${crm} account.`,
        needsSetup: true,
      }, { status: 400 });
    }
    applyCredentialsToEnv(crm, creds);
    const adapter = getCRMAdapter(crm);

    // ── Confirmation path: execute already-approved pending actions ────────────
    if (isConfirmation && pendingToExecute && pendingToExecute.length > 0) {
      const actions: ActionResult[] = [];
      for (const pending of pendingToExecute) {
        const { label, status } = await executeTool(pending.tool, pending.args, adapter);
        actions.push({ label, status });
      }
      const successCount = actions.filter((a) => a.status === 'success').length;
      const reply = successCount === actions.length
        ? `Done! ${successCount} change${successCount > 1 ? 's' : ''} applied successfully.`
        : `Applied ${successCount} of ${actions.length} changes. Check the action list for any errors.`;
      return NextResponse.json({ reply, actions });
    }

    // ── Normal AI chat path ───────────────────────────────────────────────────
    const { message } = body;
    if (!message) return NextResponse.json({ error: 'No message provided' }, { status: 400 });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const pendingActions: PendingAction[] = [];
    const infoActions:    ActionResult[]  = [];

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
        const toolName = toolCall.function.name;
        const args     = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;

        // ── Intercept write tools → preview, don't execute ───────────────────
        if (WRITE_TOOLS.has(toolName)) {
          const description = describePending(toolName, args);
          pendingActions.push({ tool: toolName, args, description });

          // Return a mock preview result so the AI can write a natural summary
          toolResults.push({
            role:         'tool',
            tool_call_id: toolCall.id,
            content:      JSON.stringify({
              preview: true,
              message: `Queued for confirmation: ${description}`,
            }),
          });
        } else {
          // ── Execute read/lookup tools immediately ────────────────────────────
          const { result, label, status } = await executeTool(toolName, args, adapter);
          infoActions.push({ label, status });
          toolResults.push({
            role:         'tool',
            tool_call_id: toolCall.id,
            content:      JSON.stringify(result),
          });
        }
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

    // Combine info actions + pending action preview chips
    const actions: ActionResult[] = [
      ...infoActions,
      ...pendingActions.map((p) => ({ label: `⏳ ${p.description}`, status: 'info' as const })),
    ];

    return NextResponse.json({
      reply,
      actions,
      ...(pendingActions.length > 0 ? { pendingActions } : {}),
    });

  } catch (err: unknown) {
    console.error('[/api/chat]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}
