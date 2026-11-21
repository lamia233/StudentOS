import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bot, Send, Sparkles, User as UserIcon } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { cn } from '../lib/format';
import type { AssistantReply } from '../lib/types';
import { Button, Card, Input, PageHeader } from '../components/ui';

interface Msg { role: 'user' | 'assistant'; text: string; source?: string; suggestions?: string[]; error?: boolean }

const STARTERS = ['What should I prioritize today?', 'What deadlines are coming up this week?', 'How am I doing on my exams?', 'Which course needs attention?', 'How is my internship goal going?', 'How productive was I this week?'];

/** Renders the assistant's lightweight markdown: **bold**, numbered and bulleted lists. */
function RichText({ text }: { text: string }) {
  const bold = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p));
  const lines = text.split('\n');
  const out: JSX.Element[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    out.push(<Tag key={out.length} className={cn('my-1.5 space-y-1 pl-5', list.ordered ? 'list-decimal' : 'list-disc')}>{list.items.map((it, i) => <li key={i}>{bold(it)}</li>)}</Tag>);
    list = null;
  };
  for (const line of lines) {
    const m = line.match(/^\s*(\d+\.|[-•*])\s+(.*)$/);
    if (m) {
      const ordered = /\d/.test(m[1]);
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push(m[2]);
    } else {
      flush();
      if (line.trim()) out.push(<p key={out.length} className="my-1">{bold(line)}</p>);
    }
  }
  flush();
  return <>{out}</>;
}

export default function Assistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [messages, busy]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setBusy(true);
    try {
      const r = await api.post<AssistantReply>('/assistant', { message: q });
      setMessages((m) => [...m, { role: 'assistant', text: r.answer, source: r.source, suggestions: r.suggestions }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', text: errorMessage(e), error: true }]);
    } finally {
      setBusy(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    ask(input);
  };
  const last = [...messages].reverse().find((m) => m.role === 'assistant');

  return (
    <div className="flex h-[calc(100dvh-10rem)] flex-col lg:h-[calc(100dvh-8rem)]">
      <PageHeader title="Assistant" icon={<Bot className="h-5 w-5" />} description="Answers come from your real StudentOS data — tasks, deadlines, exams, study sessions and goals." />
      <Card className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6" aria-live="polite" aria-busy={busy}>
          {messages.length === 0 ? (
            <div className="mx-auto flex max-w-xl flex-col items-center py-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"><Sparkles className="h-7 w-7" /></span>
              <h2 className="mt-4 text-lg font-semibold">Ask about your semester</h2>
              <p className="mt-1 text-sm text-slate-500">I read your dashboard, planner and analytics to answer — no guesswork.</p>
              <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
                {STARTERS.map((s) => (
                  <button key={s} type="button" onClick={() => ask(s)} className="rounded-xl border border-slate-200 px-4 py-3 text-left text-sm hover:border-brand-400 hover:bg-brand-50/50 dark:border-slate-700 dark:hover:bg-brand-500/5">{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-4">
              {messages.map((m, i) => (
                <li key={i} className={cn('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', m.role === 'user' ? 'bg-slate-200 dark:bg-slate-700' : 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300')} aria-hidden>
                    {m.role === 'user' ? <UserIcon className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </span>
                  <div className={cn('max-w-[85%] rounded-2xl px-4 py-2.5 text-sm', m.role === 'user' ? 'rounded-tr-sm bg-brand-600 text-white' : m.error ? 'rounded-tl-sm bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : 'rounded-tl-sm bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100')}>
                    <span className="sr-only">{m.role === 'user' ? 'You said:' : 'Assistant said:'}</span>
                    {m.role === 'user' ? m.text : <RichText text={m.text} />}
                    {m.source && <p className="mt-2 text-[10px] uppercase tracking-wide text-slate-400">{m.source === 'llm' ? 'AI-generated from your data' : 'Computed from your StudentOS data'}</p>}
                  </div>
                </li>
              ))}
              {busy && (
                <li className="flex gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/20"><Bot className="h-4 w-4" /></span>
                  <div className="flex items-center gap-1 rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-800" aria-label="Assistant is thinking">
                    {[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d * 120}ms` }} />)}
                  </div>
                </li>
              )}
            </ul>
          )}
          <div ref={endRef} />
        </div>
        <div className="border-t border-slate-100 p-3 dark:border-slate-800">
          {last?.suggestions && last.suggestions.length > 0 && !busy && (
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              {last.suggestions.map((s) => <button key={s} type="button" onClick={() => ask(s)} className="shrink-0 rounded-full border border-slate-200 px-3 py-1 text-xs hover:border-brand-400 dark:border-slate-700">{s}</button>)}
            </div>
          )}
          <form onSubmit={submit} className="flex gap-2">
            <Input aria-label="Ask the assistant" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything about your tasks, deadlines, exams or goals…" maxLength={1000} />
            <Button type="submit" disabled={!input.trim()} loading={busy} aria-label="Send" icon={<Send className="h-4 w-4" />}><span className="hidden sm:inline">Send</span></Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
