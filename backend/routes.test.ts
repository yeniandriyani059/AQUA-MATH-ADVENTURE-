import test from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createBackendApp } from '../server';

test('all API paths fail safely as JSON before authentication and never touch Supabase', async () => {
  let connections = 0;
  const app = createBackendApp(async () => { connections++; throw new Error('Live access forbidden'); }, []);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const cases: [string,string,number][] = [
    ['GET','/api/admin/verify',401], ['GET','/api/admin/students',401],
    ['POST','/api/admin/login',400], ['POST','/api/admin/register',403],
    ['POST','/api/admin/provision-students',401], ['POST','/api/admin/students',401],
    ['POST','/api/admin/reset-student-password',401],
    ['PUT','/api/admin/students/synthetic',401], ['DELETE','/api/admin/students/synthetic',401],
    ['POST','/api/student/verify-access',400], ['POST','/api/student/select-identity',401],
    ['POST','/api/student/login',400], ['POST','/api/student/save-attempt',401],
    ['GET','/api/does-not-exist',404], ['GET','/api/student/login',404],
  ];
  try {
    for (const [method,path,status] of cases) {
      const response = await fetch(base + path, { method, ...(method === 'GET' ? {} : { headers: { 'Content-Type': 'application/json' }, body: '{}' }) });
      assert.equal(response.status, status, `${method} ${path}`);
      assert.match(response.headers.get('content-type') || '', /application\/json/);
      assert.equal((await response.json()).ok, false);
    }
    const malformed = await fetch(base + '/api/student/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{malformed' });
    assert.equal(malformed.status, 400); assert.equal((await malformed.json()).ok, false);
    assert.equal(connections, 0);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
