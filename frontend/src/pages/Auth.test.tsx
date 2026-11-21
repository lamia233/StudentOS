import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { Login, Register } from './Auth';
import { mockApi, renderApp } from '../test/utils';

const user = { id: 'u1', name: 'Test Student', email: 't@uni.edu', theme: 'light', onboarded: false, isDemo: false };
const Routed = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/app" element={<p>Dashboard page</p>} />
    <Route path="/onboarding" element={<p>Onboarding page</p>} />
  </Routes>
);

describe('authentication pages', () => {
  it('logs in and navigates to the dashboard', async () => {
    const calls = mockApi((url) => (url.endsWith('/auth/login') ? { body: { user: { ...user, onboarded: true }, token: 'x' } } : undefined));
    renderApp(<Routed />, '/login');
    await userEvent.type(await screen.findByLabelText('Email'), 't@uni.edu');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(calls.find((c) => c.url.endsWith('/auth/login'))?.body).toEqual({ email: 't@uni.edu', password: 'password123' });
  });

  it('shows the server error for wrong credentials', async () => {
    mockApi((url) => (url.endsWith('/auth/login') ? { status: 401, body: { error: 'Invalid email or password' } } : undefined));
    renderApp(<Routed />, '/login');
    await userEvent.type(await screen.findByLabelText('Email'), 't@uni.edu');
    await userEvent.type(screen.getByLabelText('Password'), 'nope-nope');
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });

  it('validates password length before registering, then sends new users to onboarding', async () => {
    const calls = mockApi((url) => (url.endsWith('/auth/register') ? { status: 201, body: { user, token: 'x' } } : undefined));
    renderApp(<Routed />, '/register');
    await userEvent.type(await screen.findByLabelText('Full name'), 'Test Student');
    await userEvent.type(screen.getByLabelText('Email'), 't@uni.edu');
    await userEvent.type(screen.getByLabelText(/^Password/), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('at least 8 characters');
    expect(calls.some((c) => c.url.endsWith('/auth/register'))).toBe(false);

    await userEvent.type(screen.getByLabelText(/^Password/), '-long-enough');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Onboarding page')).toBeInTheDocument();
  });

  it('signs in with the demo account', async () => {
    mockApi((url) => (url.endsWith('/auth/demo') ? { body: { user: { ...user, isDemo: true, onboarded: true }, token: 'x' } } : undefined));
    renderApp(<Routed />, '/login');
    await userEvent.click(await screen.findByRole('button', { name: /demo account/i }));
    await waitFor(() => expect(screen.getByText('Dashboard page')).toBeInTheDocument());
  });
});
