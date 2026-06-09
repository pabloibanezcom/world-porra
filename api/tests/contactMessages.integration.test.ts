import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearDatabase, requestJson, startIntegrationServer, stopIntegrationServer } from './helpers/integration';

beforeAll(async () => {
  await startIntegrationServer();
});

beforeEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await stopIntegrationServer();
});

async function registerPlayer(email: string, name = 'Player') {
  const response = await requestJson<{ token: string; user: { id: string; email: string; isMaster: boolean } }>(
    '/auth/register',
    { body: { email, name, password: 'valid-password' } }
  );
  expect(response.status).toBe(201);
  return response.body;
}

describe('contact message routes', () => {
  it('allows users to contact master and only master users to manage messages', async () => {
    const master = await registerPlayer('master@worldporra.test', 'Master');
    const member = await registerPlayer('member@worldporra.test', 'Member');

    const invalid = await requestJson('/contact-messages', {
      token: member.token,
      body: { subject: '', message: 'Help me' },
    });
    expect(invalid.status).toBe(400);

    const created = await requestJson<any>('/contact-messages', {
      token: member.token,
      body: { subject: 'I need help', message: 'Can you check my league?' },
    });
    expect(created.status).toBe(201);
    expect(created.body.message).toMatchObject({
      subject: 'I need help',
      message: 'Can you check my league?',
      status: 'new',
      user: {
        id: member.user.id,
        email: 'member@worldporra.test',
        name: 'Member',
      },
    });

    const forbidden = await requestJson('/contact-messages/admin', { token: member.token });
    expect(forbidden.status).toBe(403);

    const list = await requestJson<any>('/contact-messages/admin', { token: master.token });
    expect(list.status).toBe(200);
    expect(list.body.messages).toHaveLength(1);
    expect(list.body.messages[0]).toMatchObject({
      id: created.body.message.id,
      subject: 'I need help',
      status: 'new',
    });

    const updated = await requestJson<any>(`/contact-messages/admin/${created.body.message.id}`, {
      method: 'PATCH',
      token: master.token,
      body: { status: 'resolved' },
    });
    expect(updated.status).toBe(200);
    expect(updated.body.message).toMatchObject({
      id: created.body.message.id,
      status: 'resolved',
    });

    const masterReply = await requestJson<any>(`/contact-messages/${created.body.message.id}/replies`, {
      token: master.token,
      body: { message: 'I can help with that.' },
    });
    expect(masterReply.status).toBe(201);
    expect(masterReply.body.message).toMatchObject({
      id: created.body.message.id,
      status: 'read',
      replies: [
        {
          message: 'I can help with that.',
          sender: {
            id: master.user.id,
            email: 'master@worldporra.test',
          },
        },
      ],
    });

    const memberThreads = await requestJson<any>('/contact-messages', { token: member.token });
    expect(memberThreads.status).toBe(200);
    expect(memberThreads.body.messages).toHaveLength(1);
    expect(memberThreads.body.messages[0].replies[0]).toMatchObject({
      message: 'I can help with that.',
      sender: {
        id: master.user.id,
      },
    });

    const memberReply = await requestJson<any>(`/contact-messages/${created.body.message.id}/replies`, {
      token: member.token,
      body: { message: 'Thank you!' },
    });
    expect(memberReply.status).toBe(201);
    expect(memberReply.body.message.status).toBe('new');
    expect(memberReply.body.message.replies).toHaveLength(2);
    expect(memberReply.body.message.replies[1]).toMatchObject({
      message: 'Thank you!',
      sender: {
        id: member.user.id,
      },
    });

    const other = await registerPlayer('other@worldporra.test', 'Other');
    const forbiddenReply = await requestJson(`/contact-messages/${created.body.message.id}/replies`, {
      token: other.token,
      body: { message: 'Sneaky' },
    });
    expect(forbiddenReply.status).toBe(403);

    const newOnly = await requestJson<any>('/contact-messages/admin?status=new', { token: master.token });
    expect(newOnly.status).toBe(200);
    expect(newOnly.body.messages).toHaveLength(1);
  });

  it('returns 404 when master updates a missing contact message', async () => {
    const master = await registerPlayer('master@worldporra.test', 'Master');

    const response = await requestJson('/contact-messages/admin/665000000000000000000000', {
      method: 'PATCH',
      token: master.token,
      body: { status: 'read' },
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Contact message not found' });
  });
});
