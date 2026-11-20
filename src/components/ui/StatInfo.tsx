import React, { useState } from 'react';
import { HelpCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

interface StatGlossaryHintProps {
  term: string;
  explanation: string;
}

export const StatGlossaryHint: React.FC<StatGlossaryHintProps> = ({
  term,
  explanation,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex items-center gap-1">
      <span>{term}</span>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        aria-label={`Explicación de ${term}`}
        className="text-slate-500 hover:text-blue-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-40 left-0 top-full mt-1.5 w-64 p-2.5 text-xs leading-relaxed font-normal text-slate-100 bg-slate-950 border border-slate-700 rounded-lg shadow-xl pointer-events-none"
        >
          {explanation}
        </span>
      )}
    </span>
  );
};

interface KpiCardProps {
  label: string;
  value: string;
  subtext?: string;
  hint?: string;
  tone?: 'neutral' | 'positive' | 'warning' | 'danger';
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  subtext,
  hint,
  tone = 'neutral',
}) => {
  const valueColor =
    tone === 'positive'
      ? 'text-blue-400'
      : tone === 'warning'
        ? 'text-amber-400'
        : tone === 'danger'
          ? 'text-rose-400'
          : 'text-white';

  return (
    <div className="bg-[#0C121E] border border-slate-800 rounded-lg p-4 flex flex-col justify-between gap-1.5">
      <div className="text-xs font-medium text-slate-400 flex items-center justify-between gap-2">
        {hint ? <StatGlossaryHint term={label} explanation={hint} /> : <span>{label}</span>}
      </div>
      <div className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${valueColor}`}>
        {value}
      </div>
      {subtext && <div className="text-xs text-slate-400 truncate">{subtext}</div>}
    </div>
  );
};

interface NoticeBannerProps {
  variant: 'info' | 'warning' | 'success';
  title: string;
  children: React.ReactNode;
}

export const NoticeBanner: React.FC<NoticeBannerProps> = ({
  variant,
  title,
  children,
}) => {
  const styles =
    variant === 'warning'
      ? 'bg-amber-950/35 border-amber-800/60 text-amber-100'
      : variant === 'success'
        ? 'bg-blue-950/40 border-blue-800/70 text-blue-100'
        : 'bg-[#0C121E] border-slate-700 text-slate-200';

  const Icon =
    variant === 'warning'
      ? AlertTriangle
      : variant === 'success'
        ? CheckCircle2
        : Info;

  const iconColor =
    variant === 'warning'
      ? 'text-amber-400'
      : variant === 'success'
        ? 'text-blue-400'
        : 'text-blue-400';

  return (
    <div className={`border rounded-lg p-4 flex items-start gap-3 ${styles}`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />
      <div className="text-xs leading-relaxed space-y-1">
        <div className="font-semibold text-white">{title}</div>
        <div className="text-slate-300">{children}</div>
      </div>
    </div>
  );
};
