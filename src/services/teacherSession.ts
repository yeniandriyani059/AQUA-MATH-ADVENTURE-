import { supabase } from './supabaseClient';

export function createTeacherSessionAccess(client: any, request: typeof fetch) {
  async function token(expectedUserId?: string): Promise<string | null> {
    if (!client) return null;
    try {
      let { data, error } = await client.auth.getSession();
      if (error) return null;
      if (!data?.session?.expires_at || data.session.expires_at * 1000 <= Date.now()) {
        const refreshed = await client.auth.refreshSession();
        data = refreshed.data; error = refreshed.error;
      }
      const session = data?.session;
      if (error || !session?.access_token || !session.user?.id || session.user.is_anonymous ||
        !session.expires_at || session.expires_at * 1000 <= Date.now() ||
        (expectedUserId && session.user.id !== expectedUserId)) return null;
      return session.access_token;
    } catch { return null; }
  }
  async function verify(expectedUserId?: string): Promise<{ teacherName?: string } | null> {
    const accessToken = await token(expectedUserId);
    if (!accessToken) return null;
    try {
      const response = await request('/api/admin/verify', { headers: { Authorization: `Bearer ${accessToken}` } });
      const result = await response.json();
      if (!response.ok || result?.ok !== true) return null;
      // Do not accept an authorization result after the active account changed.
      if (await token(expectedUserId) !== accessToken) return null;
      return { teacherName: result.teacherName };
    } catch { return null; }
  }
  return { token, verify };
}
const access = createTeacherSessionAccess(supabase, (...args) => fetch(...args));
export const getTeacherAccessToken = access.token;
export const verifyTeacherSession = access.verify;
