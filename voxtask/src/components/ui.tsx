import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface SectionProps {
  title: string;
  subtitle?: string;
  count?: number;
  tone?: 'default' | 'danger';
  children: ReactNode;
}

export function Section({ title, subtitle, count, tone = 'default', children }: SectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2
          className={`text-sm font-semibold uppercase tracking-wide ${
            tone === 'danger' ? 'text-red-300' : 'text-zinc-300'
          }`}
        >
          {title}
        </h2>
        {count !== undefined && <span className="text-xs text-zinc-500">{count}</span>}
        {subtitle && <span className="text-xs text-zinc-500">· {subtitle}</span>}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

interface EmptyProps {
  icon: LucideIcon;
  title: string;
  text: string;
}

export function EmptyState({ icon: Icon, title, text }: EmptyProps) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-ink-600 px-6 py-10 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-ink-800 text-emerald-400">
        <Icon size={20} />
      </div>
      <p className="text-sm font-medium text-zinc-200">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-zinc-500">{text}</p>
    </div>
  );
}

export function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-50">{value}</p>
    </div>
  );
}
