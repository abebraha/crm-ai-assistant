'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Database, ArrowLeft, CheckCircle, XCircle, Loader2,
  Eye, EyeOff, ExternalLink, Trash2, User, LogOut, Link
} from 'lucide-react';
import clsx from 'clsx';

// ─── CRM metadata ────────────────────────────────────────────────────────────

interface CRMMeta {
  key:         string;
  label:       string;
  color:       string;
  dotColor:    string;
  supportsOAuth: boolean;
  oauthNote?:  string;
  fields:      FieldDef[];
  docsUrl:     string;
}

interface FieldDef {
  key:         string;
  label:       string;
  placeholder: string;
  type?:       'password' | 'text' | 'url';
  hint?:       string;
}

const CRMS: CRMMeta[] = [
  {
    key: 'hubspot', label: 'HubSpot', color: 'bg-orange-50 border-orange-200',
    dotColor: 'bg-orange-500', supportsOAuth: true,
    oauthNote: 'Requires HUBSPOT_CLIENT_ID + HUBSPOT_CLIENT_SECRET in server env',
    docsUrl: 'https://developers.hubspot.com/docs/api/private-apps',
    fields: [{ key: 'apiKey', label: 'Private App Token', placeholder: 'pat-na1-...', type: 'password',
      hint: 'Settings → Integrations → Private Apps → Create app → copy Access Token' }],
  },
  {
    key: 'salesforce', label: 'Salesforce', color: 'bg-blue-50 border-blue-200',
    dotColor: 'bg-blue-600', supportsOAuth: true,
    oauthNote: 'Requires SALESFORCE_CLIENT_ID + SALESFORCE_CLIENT_SECRET in server env',
    docsUrl: 'https://help.salesforce.com/s/articleView?id=sf.user_security_token.htm',
    fields: [
      { key: 'username',  label: 'Username',       placeholder: 'you@yourorg.com',             type: 'text' },
      { key: 'password',  label: 'Password',        placeholder: 'Your Salesforce password',    type: 'password' },
      { key: 'securityToken', label: 'Security Token', placeholder: 'Token from reset email',  type: 'password',
        hint: 'Settings → My Personal Information → Reset My Security Token' },
      { key: 'loginUrl',  label: 'Login URL',       placeholder: 'https://login.salesforce.com', type: 'url',
        hint: 'Use https://test.salesforce.com for sandboxes' },
    ],
  },
  {
    key: 'pipedrive', label: 'Pipedrive', color: 'bg-green-50 border-green-200',
    dotColor: 'bg-green-600', supportsOAuth: true,
    oauthNote: 'Requires PIPEDRIVE_CLIENT_ID + PIPEDRIVE_CLIENT_SECRET in server env',
    docsUrl: 'https://pipedrive.readme.io/docs/core-api-concepts-authentication',
    fields: [{ key: 'apiKey', label: 'API Token', placeholder: '...', type: 'password',
      hint: 'Profile picture → Personal preferences → API' }],
  },
  {
    key: 'zoho', label: 'Zoho CRM', color: 'bg-red-50 border-red-200',
    dotColor: 'bg-red-500', supportsOAuth: true,
    oauthNote: 'Requires ZOHO_CLIENT_ID + ZOHO_CLIENT_SECRET in server env',
    docsUrl: 'https://www.zoho.com/crm/developer/docs/api/v3/',
    fields: [{ key: 'apiKey', label: 'Access Token', placeholder: 'Paste your access token', type: 'password',
      hint: 'api-console.zoho.com → Self Client → Generate Token (ZohoCRM.modules.ALL)' }],
  },
  {
    key: 'close', label: 'Close CRM', color: 'bg-indigo-50 border-indigo-200',
    dotColor: 'bg-indigo-600', supportsOAuth: false,
    docsUrl: 'https://developer.close.com/',
    fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'api_...', type: 'password',
      hint: 'Settings → Your API Keys → Generate' }],
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

type ConnectionMap = Record<string, { connected: boolean; authMethod: string }>;

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [connections, setConnections] = useState<ConnectionMap>({});
  const [loadingConns, setLoadingConns] = useState(true);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Handle OAuth redirects back
  useEffect(() => {
    const connected = searchParams.get('connected');
    const err       = searchParams.get('error');
    if (connected) setNotification({ type: 'success', msg: `${connected} connected via OAuth!` });
    if (err)       setNotification({ type: 'error',   msg: decodeURIComponent(err) });
  }, [searchParams]);

  const fetchConnections = useCallback(async () => {
    setLoadingConns(true);
    const res  = await fetch('/api/crm-connections');
    const data = await res.json() as { connections: { crmType: string; connected: boolean; authMethod: string }[] };
    const map: ConnectionMap = {};
    (data.connections ?? []).forEach((c) => { map[c.crmType] = c; });
    setConnections(map);
    setLoadingConns(false);
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated') fetchConnections();
  }, [status, router, fetchConnections]);

  if (status === 'loading') return <LoadingScreen />;

  const notify = (type: 'success' | 'error', msg: string) => {
    setNotification({ type, msg });
    setTimeout(() => setNotification(null), 5000);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => router.push('/')} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-brand-500" />
            <h1 className="font-semibold text-slate-900">Settings</h1>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8 flex flex-col gap-8">

        {/* Notification */}
        {notification && (
          <div className={clsx(
            'flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium',
            notification.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-600'
          )}>
            {notification.type === 'success'
              ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
              : <XCircle    className="w-4 h-4 flex-shrink-0" />}
            {notification.msg}
          </div>
        )}

        {/* Profile section */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Profile</h2>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-white font-bold text-sm">
              {session?.user?.name?.charAt(0).toUpperCase() ?? session?.user?.email?.charAt(0).toUpperCase() ?? <User className="w-4 h-4" />}
            </div>
            <div className="flex-1">
              <div className="font-medium text-slate-900 text-sm">{session?.user?.name ?? 'No name set'}</div>
              <div className="text-xs text-slate-500">{session?.user?.email}</div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </section>

        {/* CRM Connections */}
        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">CRM Integrations</h2>
          <div className="flex flex-col gap-4">
            {CRMS.map((crm) => (
              <CRMCard
                key={crm.key}
                crm={crm}
                connection={connections[crm.key]}
                loading={loadingConns}
                onSaved={() => { fetchConnections(); notify('success', `${crm.label} connected!`); }}
                onDisconnected={() => { fetchConnections(); notify('success', `${crm.label} disconnected.`); }}
                onError={(msg) => notify('error', msg)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── CRM Card ────────────────────────────────────────────────────────────────

function CRMCard({
  crm, connection, loading, onSaved, onDisconnected, onError,
}: {
  crm:            CRMMeta;
  connection?:    { connected: boolean; authMethod: string };
  loading:        boolean;
  onSaved:        () => void;
  onDisconnected: () => void;
  onError:        (msg: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [values,   setValues]   = useState<Record<string, string>>({});
  const [showPw,   setShowPw]   = useState<Record<string, boolean>>({});
  const [saving,   setSaving]   = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const isConnected = !loading && !!connection?.connected;

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = { crmType: crm.key };
      crm.fields.forEach((f) => { if (values[f.key]) body[f.key] = values[f.key]; });

      const res  = await fetch('/api/crm-connections', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setValues({});
      setExpanded(false);
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/crm-connections?crm=${crm.key}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Disconnect failed');
      onDisconnected();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Disconnect failed');
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className={clsx('rounded-2xl border bg-white overflow-hidden transition-all', isConnected ? 'border-green-200' : 'border-slate-200')}>
      {/* Card header */}
      <div className="flex items-center gap-3 p-5">
        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${crm.dotColor}`} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-slate-900">{crm.label}</span>
            {loading ? (
              <span className="text-xs text-slate-400">checking…</span>
            ) : isConnected ? (
              <span className="flex items-center gap-1 text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
                <CheckCircle className="w-3 h-3" /> Connected
                {connection?.authMethod === 'oauth' && ' via OAuth'}
              </span>
            ) : (
              <span className="text-xs text-slate-400">Not connected</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isConnected && (
            <button
              onClick={disconnect} disabled={disconnecting}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Disconnect"
            >
              {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          )}

          {/* OAuth button */}
          {crm.supportsOAuth && (
            <a
              href={`/api/oauth/${crm.key}/connect`}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-700 transition-colors"
            >
              <Link className="w-3.5 h-3.5" />
              {isConnected ? 'Reconnect' : 'Connect'}
            </a>
          )}

          {/* API key toggle */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            {expanded ? 'Cancel' : (isConnected ? 'Update key' : 'API key')}
          </button>
        </div>
      </div>

      {/* API key form */}
      {expanded && (
        <div className={clsx('border-t px-5 pb-5 pt-4 flex flex-col gap-4', crm.color)}>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <ExternalLink className="w-3 h-3" />
            <a href={crm.docsUrl} target="_blank" rel="noreferrer" className="underline hover:text-slate-700">
              How to get your {crm.label} credentials
            </a>
          </p>

          {crm.supportsOAuth && (
            <div className="text-xs text-slate-500 bg-white/60 border border-slate-200 rounded-xl px-3 py-2">
              💡 <strong>One-click connect</strong> is available via the "Connect" button above.
              It requires <code className="font-mono text-xs bg-slate-100 px-1 rounded">{crm.key.toUpperCase()}_CLIENT_ID</code> and{' '}
              <code className="font-mono text-xs bg-slate-100 px-1 rounded">{crm.key.toUpperCase()}_CLIENT_SECRET</code> in your server env.
            </div>
          )}

          {crm.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">{field.label}</label>
              <div className="relative">
                <input
                  type={field.type === 'password' && !showPw[field.key] ? 'password' : 'text'}
                  value={values[field.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2.5 pr-9 text-sm rounded-xl border border-slate-200 bg-white outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all font-mono"
                />
                {field.type === 'password' && (
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => ({ ...s, [field.key]: !s[field.key] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showPw[field.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              {field.hint && <p className="text-xs text-slate-400 mt-1">{field.hint}</p>}
            </div>
          ))}

          <button
            onClick={save} disabled={saving || crm.fields.every((f) => !values[f.key])}
            className="self-start flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Save &amp; connect
          </button>
        </div>
      )}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
    </div>
  );
}