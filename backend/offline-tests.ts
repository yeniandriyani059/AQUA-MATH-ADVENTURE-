// Preload for local tests. No test may contact a remote service, even accidentally.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    return new Response(JSON.stringify({ message: 'External network disabled in local tests' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }
  return originalFetch(input, init);
};
