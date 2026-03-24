'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { CRMType } from '@/lib/crm/types';

export const CRM_OPTIONS: { value: CRMType; label: string; color: string }[] = [
  { value: 'hubspot',     label: 'HubSpot',     color: 'bg-orange-500' },
  { value: 'salesforce',  label: 'Salesforce',  color: 'bg-blue-600'   },
  { value: 'pipedrive',   label: 'Pipedrive',   color: 'bg-green-600'  },
  { value: 'zoho',        label: 'Zoho CRM',    color: 'bg-red-500'    },
  { value: 'close',       label: 'Close CRM',   color: 'bg-indigo-600' },
];

interface Props {
  selected: CRMType;
  onChange: (crm: CRMType) => void;
  connectedCrms: CRMType[];
}

export default function CRMSelector({ selected, onChange, connectedCrms }: Props) {
  const [open, setOpen] = useState(false);
  const options = CRM_OPTIONS.filter((o) => connectedCrms.includes(o.value));
  const current = options.find((o) => o.value === selected) ?? options[0];

  if (!current) return null;

  // Single CRM — static badge, no dropdown
  if (options.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm text-sm font-medium text-slate-700">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${current.color}`} />
        {current.label}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${current.color}`} />
        {current.label}
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors ${selected === opt.value ? 'bg-slate-50 font-semibold' : ''}`}
            >
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${opt.color}`} />
              {opt.label}
              {selected === opt.value && (
                <span className="ml-auto text-brand-500 text-xs">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
