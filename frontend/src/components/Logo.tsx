import { cn } from '../lib/format';

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-sm font-extrabold text-white shadow-sm" aria-hidden>
        S
      </span>
      {withText && (
        <span className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
          Student<span className="text-brand-600 dark:text-brand-400">OS</span>
        </span>
      )}
    </span>
  );
}
