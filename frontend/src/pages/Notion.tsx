import { useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, CloudDownload, CloudUpload, FlaskConical, Link2, Plug, Unplug } from 'lucide-react';
import { useApiMutation, useApiQuery } from '../hooks/queries';
import { api } from '../lib/api';
import { cn, formatDateTime } from '../lib/format';
import type { NotionStatus } from '../lib/types';
import { Badge, Button, Card, CardHeader, ErrorState, Field, Input, PageHeader, PageLoader } from '../components/ui';

const TYPES = [
  { key: 'tasks', label: 'Tasks' },
  { key: 'assignments', label: 'Assignments' },
  { key: 'studyPlans', label: 'Study plan (next 7 days)' },
  { key: 'notes', label: 'Notes' },
  { key: 'goals', label: 'Career goals' },
] as const;

interface SyncResult { mode: string; simulated: boolean; results: { type: string; created: number; updated: number }[] }

export default function Notion() {
  const { data: s, isLoading, error, refetch } = useApiQuery<NotionStatus>(['notion'], '/notion/status');
  const [types, setTypes] = useState<string[]>(TYPES.map((t) => t.key));
  const [token, setToken] = useState('');
  const [targetId, setTargetId] = useState('');
  const [last, setLast] = useState<SyncResult | null>(null);
  const inv = { invalidate: [['notion'], ['tasks'], ['notes']] };
  const connect = useApiMutation((body: Record<string, unknown>) => api.post('/notion/connect', body), { ...inv, success: 'Notion connection updated', onSuccess: () => setToken('') });
  const disconnect = useApiMutation(() => api.post('/notion/disconnect'), { ...inv, success: 'Disconnected from Notion' });
  const sync = useApiMutation((t: string[]) => api.post<SyncResult>('/notion/sync', { types: t }), {
    ...inv,
    success: (r) => (r.simulated ? 'Demo sync complete — simulated, nothing sent to Notion' : 'Exported to Notion'),
    onSuccess: setLast,
  });
  const imp = useApiMutation((kind: 'tasks' | 'notes') => api.post<{ simulated: boolean; created: number; updated: number }>('/notion/import', { kind }), {
    ...inv,
    success: (r) => `${r.simulated ? 'Demo import (simulated)' : 'Imported'}: ${r.created} new, ${r.updated} updated`,
  });

  if (isLoading) return <PageLoader />;
  if (error || !s) return <ErrorState message={error?.message ?? 'No data'} onRetry={() => refetch()} />;
  const demo = s.mode === 'demo';

  return (
    <div>
      <PageHeader title="Notion" icon={<BookOpen className="h-5 w-5" />} description="Export your StudentOS workspace to Notion databases, or import tasks and notes back." />

      <div className={cn('mb-6 flex items-start gap-3 rounded-2xl border p-4', !s.connected ? 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900' : demo ? 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/5' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/5')} role="status">
        {!s.connected ? <Plug className="mt-0.5 h-5 w-5 text-slate-500" /> : demo ? <FlaskConical className="mt-0.5 h-5 w-5 text-amber-600" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />}
        <div className="text-sm">
          <p className="font-semibold">{!s.connected ? 'Not connected' : demo ? 'Demo mode — simulated sync' : `Live — connected to ${s.workspaceName ?? 'Notion'}`}</p>
          <p className="mt-0.5 text-slate-600 dark:text-slate-400">
            {!s.connected
              ? 'Connect a Notion integration for live sync, or use demo mode to see how it works.'
              : demo
                ? 'No data is sent to Notion in demo mode. StudentOS shows exactly what would be exported so you can try the flow safely.'
                : `Exports go to “${s.targetTitle}”. Your token is stored encrypted on the server and never sent to the browser.`}
          </p>
          {s.lastError && <p className="mt-1 flex items-center gap-1 text-rose-600"><AlertTriangle className="h-4 w-4" />{s.lastError}</p>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Export to Notion" subtitle={s.connected ? `Target: ${s.targetTitle ?? '—'}` : 'Connect first'} icon={<CloudUpload className="h-4 w-4" />} action={demo ? <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Demo</Badge> : s.mode === 'live' ? <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Live</Badge> : null} />
            <div className="p-5">
              <fieldset>
                <legend className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">What to export</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TYPES.map((t) => (
                    <label key={t.key} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm dark:border-slate-700">
                      <span className="flex items-center gap-2">
                        <input type="checkbox" className="h-4 w-4 rounded accent-brand-600" checked={types.includes(t.key)} onChange={(e) => setTypes(e.target.checked ? [...types, t.key] : types.filter((x) => x !== t.key))} />
                        {t.label}
                      </span>
                      {s.linked[t.key] ? <span className="text-xs text-slate-500">{s.linked[t.key]} linked</span> : null}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => sync.mutate(types)} loading={sync.isPending} disabled={!s.connected || types.length === 0} icon={<CloudUpload className="h-4 w-4" />}>{demo ? 'Run demo sync' : 'Sync to Notion'}</Button>
                <Button variant="secondary" onClick={() => imp.mutate('tasks')} loading={imp.isPending && imp.variables === 'tasks'} disabled={!s.connected} icon={<CloudDownload className="h-4 w-4" />}>Import tasks</Button>
                <Button variant="secondary" onClick={() => imp.mutate('notes')} loading={imp.isPending && imp.variables === 'notes'} disabled={!s.connected} icon={<CloudDownload className="h-4 w-4" />}>Import notes</Button>
              </div>
              {last && (
                <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/60" role="status">
                  <p className="font-medium">{last.simulated ? 'Simulated export result (nothing was sent to Notion)' : 'Export result'}</p>
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                    {last.results.map((r) => <li key={r.type} className="flex justify-between"><span className="capitalize">{TYPES.find((t) => t.key === r.type)?.label ?? r.type}</span><span className="text-slate-500">{r.created} new · {r.updated} updated</span></li>)}
                  </ul>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Sync history" subtitle={s.lastSyncedAt ? `Last sync ${formatDateTime(s.lastSyncedAt)}` : 'No syncs yet'} />
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {s.logs.length === 0 && <li className="p-5 text-sm text-slate-500">Run a sync to see history here.</li>}
              {s.logs.map((l) => (
                <li key={l.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                  {l.direction === 'export' ? <CloudUpload className="mt-0.5 h-4 w-4 text-slate-400" /> : <CloudDownload className="mt-0.5 h-4 w-4 text-slate-400" />}
                  <div className="min-w-0 flex-1"><p className="font-medium capitalize">{l.direction} · {l.itemType}</p><p className="text-xs text-slate-500">{l.message}</p></div>
                  <div className="text-right"><Badge className={l.mode === 'demo' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700'}>{l.mode}</Badge><p className="mt-1 text-xs text-slate-400">{formatDateTime(l.createdAt)}</p></div>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader title="Connection" icon={<Link2 className="h-4 w-4" />} />
          <div className="space-y-4 p-5">
            <div className="space-y-2">
              <p className="text-sm font-medium">Live Notion</p>
              {s.liveAvailable ? (
                <p className="text-xs text-slate-500">A server-side integration token is configured{s.defaultTargetConfigured ? ' with a default parent page.' : '.'}</p>
              ) : (
                <p className="text-xs text-slate-500">Paste an internal integration token and a parent page ID shared with the integration. It is encrypted and kept on the server only.</p>
              )}
              {!s.liveAvailable && (
                <Field label="Integration token">{(id) => <Input id={id} type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ntn_…" />}</Field>
              )}
              {!s.defaultTargetConfigured && (
                <Field label="Parent page ID or URL">{(id) => <Input id={id} value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="https://notion.so/…" />}</Field>
              )}
              <Button className="w-full" onClick={() => connect.mutate({ mode: 'live', token: token || undefined, targetId: targetId || undefined })} loading={connect.isPending && connect.variables?.mode === 'live'} disabled={!s.liveAvailable && !token} icon={<Plug className="h-4 w-4" />}>Connect live</Button>
            </div>
            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <p className="text-sm font-medium">Demo mode</p>
              <p className="mb-2 text-xs text-slate-500">Try export/import without a Notion account. Clearly labelled as simulated.</p>
              <Button variant="secondary" className="w-full" onClick={() => connect.mutate({ mode: 'demo' })} loading={connect.isPending && connect.variables?.mode === 'demo'} disabled={demo} icon={<FlaskConical className="h-4 w-4" />}>{demo ? 'Demo mode active' : 'Use demo mode'}</Button>
            </div>
            {s.connected && <Button variant="ghost" className="w-full text-rose-600" onClick={() => disconnect.mutate()} loading={disconnect.isPending} icon={<Unplug className="h-4 w-4" />}>Disconnect</Button>}
          </div>
        </Card>
      </div>
    </div>
  );
}
