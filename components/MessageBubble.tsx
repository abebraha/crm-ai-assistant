'use client';

import { CheckCircle, XCircle, Info, Mic, AlertTriangle } from 'lucide-react';
import { Message, PendingAction } from '@/lib/crm/types';
import clsx from 'clsx';

interface Props {
  message:   Message;
  onConfirm?: (pending: PendingAction[]) => void;
  onCancel?:  () => void;
  showConfirm?: boolean;  // false once the user has confirmed/cancelled
}

export default function MessageBubble({ message, onConfirm, onCancel, showConfirm = true }: Props) {
  const isUser = message.role === 'user';
  const hasPending = showConfirm && message.pendingActions && message.pendingActions.length > 0;

  return (
    <div className={clsx('flex gap-3 max-w-3xl', isUser ? 'ml-auto flex-row-reverse' : 'mr-auto')}>
      {/* Avatar */}
      <div
        className={clsx(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm',
          isUser ? 'bg-brand-500 text-white' : 'bg-white border border-slate-200 text-slate-500',
        )}
      >
        {isUser ? 'You' : 'AI'}
      </div>

      {/* Bubble + extras */}
      <div className="flex flex-col gap-1.5 max-w-xl">
        {/* Voice badge */}
        {message.isVoice && (
          <div className={clsx('flex items-center gap-1 text-xs text-slate-400', isUser ? 'justify-end' : 'justify-start')}>
            <Mic className="w-3 h-3" />
            <span>Voice note</span>
          </div>
        )}

        {/* Main bubble */}
        <div
          className={clsx(
            'px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm',
            isUser
              ? 'bg-brand-500 text-white rounded-tr-sm'
              : 'bg-white text-slate-800 border border-slate-100 rounded-tl-sm',
          )}
        >
          {message.content}
        </div>

        {/* CRM action chips (reads / completed writes) */}
        {message.actions && message.actions.filter((a) => !a.label.startsWith('⏳')).length > 0 && (
          <div className="flex flex-col gap-1 mt-0.5">
            {message.actions
              .filter((a) => !a.label.startsWith('⏳'))
              .map((action, i) => (
                <ActionChip key={i} action={action} />
              ))}
          </div>
        )}

        {/* ── Pending-write confirmation card ── */}
        {hasPending && (
          <div className="mt-1 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-amber-700">
                {message.pendingActions!.length === 1 ? 'Confirm this change:' : `Confirm ${message.pendingActions!.length} changes:`}
              </span>
            </div>

            <ul className="flex flex-col gap-1.5 mb-3">
              {message.pendingActions!.map((action, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-amber-900">
                  <span className="text-amber-400 mt-px font-bold">→</span>
                  <span>{action.description}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onConfirm?.(message.pendingActions!)}
                className="px-3.5 py-1.5 bg-brand-500 text-white text-xs font-semibold rounded-lg hover:bg-brand-600 active:scale-95 transition-all shadow-sm"
              >
                Confirm & Apply
              </button>
              <button
                onClick={onCancel}
                className="px-3.5 py-1.5 bg-white text-slate-600 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Timestamp */}
        <span className={clsx('text-xs text-slate-400', isUser ? 'text-right' : 'text-left')}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

function ActionChip({ action }: { action: { label: string; status: 'success' | 'error' | 'info' } }) {
  const icons = {
    success: <CheckCircle className="w-3.5 h-3.5 text-green-500" />,
    error:   <XCircle    className="w-3.5 h-3.5 text-red-400"   />,
    info:    <Info       className="w-3.5 h-3.5 text-blue-400"  />,
  };
  const styles = {
    success: 'bg-green-50 border-green-200 text-green-700',
    error:   'bg-red-50 border-red-200 text-red-600',
    info:    'bg-blue-50 border-blue-200 text-blue-700',
  };

  return (
    <div className={clsx('flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs w-fit', styles[action.status])}>
      {icons[action.status]}
      {action.label}
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex gap-3 max-w-3xl mr-auto">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm bg-white border border-slate-200 text-slate-500">
        AI
      </div>
      <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-1">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}
