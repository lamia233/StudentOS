import request from 'supertest';
import { createApp } from '../src/app.js';

export const app = createApp();

let counter = 0;
export async function registerUser(name = 'Test Student') {
  const email = `student${Date.now()}${counter++}@uni.edu`;
  const res = await request(app).post('/api/auth/register').send({ name, email, password: 'password123' });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const token: string = res.body.token;
  const auth = { Authorization: `Bearer ${token}` };
  return { email, token, auth, user: res.body.user };
}

export const api = () => request(app);
