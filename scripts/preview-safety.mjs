// Used at Vite build time and Function request time. Never log environment values.
const productionHost = 'ddaudswxkxzmpqvoiuss.supabase.co';
export function validatePreviewEnvironment(env) {
  if (env.VERCEL === '1' && !env.VERCEL_ENV) throw new Error('Expose VERCEL_ENV in Vercel system environment variables.');
  if (env.VERCEL_ENV !== 'preview') return;
  const required = ['VITE_SUPABASE_URL', 'SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'TRUSTED_TEACHER_AUTH_IDS'];
  const missing = required.filter(name => !env[name]?.trim());
  if (missing.length) throw new Error(`Missing Preview configuration: ${missing.join(', ')}`);
  const urls = ['VITE_SUPABASE_URL', 'SUPABASE_URL'].map(name => {
    let url;
    try { url = new URL(env[name]); } catch { throw new Error(`Invalid Preview URL: ${name}`); }
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/')
      throw new Error(`Invalid Preview URL: ${name}`);
    if (url.hostname.toLowerCase().replace(/\.$/, '') === productionHost) throw new Error('Preview must not target the production Supabase project.');
    return url;
  });
  if (urls[0].origin !== urls[1].origin) throw new Error('Preview frontend and backend must target the same nonproduction project.');
  const key = env.VITE_SUPABASE_ANON_KEY.trim();
  if (!key.startsWith('sb_publishable_')) {
    let claims;
    try {
      const parts = key.split('.');
      if (parts.length !== 3) throw new Error();
      claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    } catch { throw new Error('Preview requires a public Supabase key, not a privileged credential.'); }
    if (claims.role !== 'anon') throw new Error('Preview requires a public Supabase key, not a privileged credential.');
    const ref = urls[0].hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)?.[1];
    if (ref && claims.ref !== ref) throw new Error('Preview public key does not match its project URL.');
  }
  const ids = env.TRUSTED_TEACHER_AUTH_IDS.split(',').map(id => id.trim());
  if (!ids.length || ids.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)))
    throw new Error('TRUSTED_TEACHER_AUTH_IDS must contain approved nonproduction teacher Auth UUIDs.');
}
