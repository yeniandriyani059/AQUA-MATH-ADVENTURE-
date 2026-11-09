// Audit only: generated Workbox SW + synthetic versioned HTML on loopback.
// No real app script is executed, no Supabase credentials/DB requests.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const dist = path.resolve('dist');
  const original = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
  let version = 'A';
  const html = v => `<!doctype html><html><body><p id="version">${v}</p><script>window.auditVersion=${JSON.stringify(v)};if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{scope:'/'}));</script></body></html>`;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    res.setHeader('Cache-Control','no-cache');
    if (url.pathname === '/sw.js') {
      res.setHeader('Content-Type','application/javascript');
      const sw = version === 'A' ? original : original.replace(/url:"index.html",revision:"[^"]+"/, 'url:"index.html",revision:"audit-generation-B"');
      if (version === 'B') assert.notEqual(sw,original);
      return res.end(sw);
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.setHeader('Content-Type','text/html'); return res.end(html(version));
    }
    const target = path.resolve(dist, '.'+url.pathname);
    if (!target.startsWith(dist+path.sep) || !fs.existsSync(target)) { res.statusCode=404;return res.end(); }
    res.setHeader('Content-Type',target.endsWith('.js')?'application/javascript':target.endsWith('.css')?'text/css':'application/octet-stream');
    fs.createReadStream(target).pipe(res);
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    const context=await browser.newContext({serviceWorkers:'allow'});
    await context.route('**/*', route => new URL(route.request().url()).origin===base?route.continue():route.abort());
    const page=await context.newPage();
    await page.goto(base,{waitUntil:'load'});
    await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
    await page.evaluate(()=>localStorage.setItem('aqua_math_offline_attempts_queue_v1','synthetic-held-queue'));
    await context.setOffline(true);await page.reload({waitUntil:'load'});
    assert.equal(await page.evaluate(()=>window.auditVersion),'A');
    await context.setOffline(false);version='B';
    await page.evaluate(async()=>{
      const registration=await navigator.serviceWorker.ready;
      await Promise.race([
        new Promise((resolve,reject)=>{navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true});registration.update().catch(reject);}),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error('Local SW update timeout')),10000)),
      ]);
    });
    assert.equal(await page.evaluate(()=>window.auditVersion),'A');
    assert.equal(await page.evaluate(()=>localStorage.getItem('aqua_math_offline_attempts_queue_v1')),'synthetic-held-queue');
    await page.reload({waitUntil:'load'});
    assert.equal(await page.evaluate(()=>window.auditVersion),'B');
    await context.setOffline(true);await page.reload({waitUntil:'load'});
    assert.equal(await page.evaluate(()=>window.auditVersion),'B');
    assert.equal(await page.evaluate(()=>localStorage.getItem('aqua_math_offline_attempts_queue_v1')),'synthetic-held-queue');
    console.log('PASS SW lifecycle: cached A runs offline; update activates B without reloading running A; next navigation/offline gets B; local queue preserved.');
    console.log('LIMIT: synthetic HTML/current generated SW and explicit registration.update probe; not a production-origin or actual old-app/iOS upgrade test.');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
