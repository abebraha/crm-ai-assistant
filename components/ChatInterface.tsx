'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, RotateCcw, Database, Settings, User, LogOut, ChevronDown } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import MessageBubble, { TypingIndicator } from '@/components/MessageBubble';
import VoiceRecorder from '@/components/VoiceRecorder';
import CRMSelector from '@/components/CRMSelector';
import { Message, CRMType } from '@/lib/crm/types';
import clsx from 'clsx';

const WELCOME: Message = {
  id: 'welcome',
  role: 'assistant',
  content: `👋 Hi! I'm your CRM AI assistant. Tell me anything about a deal, contact, or activity and I'll update your CRM automatically.

Try things like:
• "Just had a call with Sarah at TechCorp. She's interested in the Enterprise plan, budget around 30k."
• "Move the Acme deal to Proposal Sent and set the close date to end of month."
• "Create a follow-up task for John Smith tomorrow at 10am."
• "Update David Lee's email to david@newcompany.com and his title to VP of Sales."

You can also send a voice note using the mic button. 🎙️`,
  timestamp: new Date().toISOString(),
};

export default function ChatInterface() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [messages,  setMessages]  = useState<Message[]>([WELCOME]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [crm,       setCrm]       = useState<CRMType>('hubspot');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [input]);

  // Greet the user by name when they first log in
  useEffect(() => {
    if (session?.user?.name) {
      setMessages([{
        ...WELCOME,
        content: WELCOME.content.replace('👋 Hi!', `👋 Hi ${session.user.name.split(' ')[0]}!`),
      }]);
    }
  }, [session?.user?.name]);

  const sendMessage = useCallback(async (text: string, isVoice = false) => {
    if (!text.trim() || loading) return;
    setInput('');

    const userMsg: Message = {
      id:        crypto.randomUUID(),
      role:      'user',
      content:   text,
      timestamp: new Date().toISOString(),
      isVoice,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text, crm, history: messages.slice(-10) }),
      });
      const data = await res.json() as { reply?: string; actions?: Message['actions']; error?: string; needsSetup?: boolean };

      if (!res.ok) {
        if (data.needsSetup) {
          setMessages((prev) => [
            ...prev,
            {
              id:        crypto.randomUUID(),
              role:      'assistant',
              content:   `⚙️ ${data.error}\n\nHead to **Settings** to connect your CRM.`,
              timestamp: new Date().toISOString(),
              actions:   [{ label: 'Go to Settings', status: 'info' }],
            },
          ]);
          return;
        }
        throw new Error(data.error || 'Request failed');
      }

      setMessages((prev) => [
        ...prev,
        {
          id:        crypto.randomUUID(),
          role:      'assistant',
          content:   data.reply ?? 'Done.',
          timestamp: new Date().toISOString(),
          actions:   data.actions,
        },
      ]);
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          id:        crypto.randomUUID(),
          role:      'assistant',
          content:   `⚠️ ${err instanceof Error ? err.message : 'Something went wrong. Please try again.'}`,
          timestamp: new Date().toISOString(),
          actions:   [{ label: 'Request failed', status: 'error' }],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, crm, messages]);

  const handleVoice = useCallback(async (blob: Blob) => {
    setLoading(true);
    try {
      const form = new FormData();
      form.append('audio', blob, 'voice.webm');
      const res  = await fetch('/api/voice', { method: 'POST', body: form });
      const data = await res.json() as { transcript?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Transcription failed');
      await sendMessage(data.transcript ?? '', true);
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          id:        crypto.randomUUID(),
          role:      'assistant',
          content:   `⚠️ ${err instanceof Error ? err.message : 'Voice transcription failed.'}`,
          timestamp: new Date().toISOString(),
          actions:   [{ label: 'Transcription failed', status: 'error' }],
        },
      ]);
      setLoading(false);
    }
  }, [sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const reset = () => { setMessages([WELCOME]); setInput(''); };

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const userName  = session?.user?.name ?? session?.user?.email ?? 'You';
  const initials  = userName.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center shadow">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-slate-900 text-base leading-tight">CRM AI Assistant</h1>
            <p className="text-xs text-slate-400">Update your CRM by chat or voice</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CRMSelector selected={crm} onChange={setCrm} />

          <button
            onClick={reset}
            title="Clear conversation"
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={() => router.push('/settings')}
            title="Settings"
            className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-brand-500 text-white text-xs font-bold flex items-center justify-center">
                {initials}
              </div>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                <div className="px-3 py-2.5 border-b border-slate-100">
                  <div className="text-xs font-medium text-slate-900 truncate">{session?.user?.name}</div>
                  <div className="text-xs text-slate-400 truncate">{session?.user?.email}</div>
                </div>
                <button
                  onClick={() => { setUserMenuOpen(false); router.push('/settings'); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" /> Settings & CRM connections
                </button>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 messages-scroll flex flex-col gap-5" onClick={() => setUserMenuOpen(false)}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 pb-6 pt-3 bg-white/80 backdrop-blur-sm border-t border-slate-200">
        <div className="flex items-end gap-3 bg-white border border-slate-200 rounded-2xl shadow-sm px-4 py-3 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 transition-all">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Tell me what to update in ${crm === 'hubspot' ? 'HubSpot' : crm === 'salesforce' ? 'Salesforce' : crm === 'pipedrive' ? 'Pipedrive' : crm === 'zoho' ? 'Zoho CRM' : 'Close CRM'}…`}
            rows={1}
            disabled={loading}
            className="flex-1 resize-none outline-none text-sm text-slate-800 placeholder-slate-400 bg-transparent max-h-40 disabled:opacity-50"
          />
          <div className="flex items-center gap-2 flex-shrink-0">
            <VoiceRecorder onRecorded={handleVoice} disabled={loading} />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className={clsx(
                'flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200',
                input.trim() && !loading
                  ? 'bg-brand-500 text-white hover:bg-brand-600 shadow-md shadow-brand-200'
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              )}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 mt-2">
          Press <kbd className="font-mono bg-slate-100 px-1 rounded">Enter</kbd> to send · <kbd className="font-mono bg-slate-100 px-1 rounded">Shift+Enter</kbd> for new line · Mic for voice
        </p>
      </div>
    </div>
  );
}