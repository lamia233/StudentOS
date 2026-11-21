import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Notion from './Notion';
import { mockApi, renderApp } from '../test/utils';

const status = { connected: true, mode: 'demo', status: 'connected', targetId: null, targetType: null, targetTitle: 'StudentOS Hub (demo)', workspaceName: 'Demo Notion Workspace (simulated)', lastSyncedAt: null, lastError: null, tokenSource: null, liveAvailable: false, defaultTargetConfigured: false, linked: {}, logs: [] };

describe('Notion page', () => {
  it('labels demo mode as simulated and shows the simulated sync result', async () => {
    const calls = mockApi((url) => {
      if (url.endsWith('/notion/status')) return { body: status };
      if (url.endsWith('/notion/sync')) return { body: { mode: 'demo', simulated: true, results: [{ type: 'tasks', created: 12, updated: 0 }], status } };
      return undefined;
    });
    renderApp(<Notion />);
    expect(await screen.findByText('Demo mode — simulated sync')).toBeInTheDocument();
    expect(screen.getByText(/No data is sent to Notion in demo mode/)).toBeInTheDocument();
    expect(screen.queryByText(/Live — connected/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Run demo sync' }));
    expect(await screen.findByText(/Simulated export result \(nothing was sent to Notion\)/)).toBeInTheDocument();
    expect(screen.getByText('12 new · 0 updated')).toBeInTheDocument();
    expect(calls.find((c) => c.url.endsWith('/notion/sync'))?.body).toEqual({ types: ['tasks', 'assignments', 'studyPlans', 'notes', 'goals'] });
  });

  it('never renders a stored token back into the page', async () => {
    mockApi((url) => (url.endsWith('/notion/status') ? { body: { ...status, mode: 'live', liveAvailable: true, tokenSource: 'env', workspaceName: 'My Workspace' } } : undefined));
    renderApp(<Notion />);
    expect(await screen.findByText(/Live — connected to My Workspace/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Integration token')).not.toBeInTheDocument();
  });
});
