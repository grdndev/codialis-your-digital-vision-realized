// Render /admin headless with the JWT cookie injected, then dump the blog section.
const TOKEN = process.argv[2];
const BASE = 'http://localhost:9222';

async function rpcConn(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((res) => {
    const myId = ++id; pending.set(myId, res);
    ws.send(JSON.stringify({ id: myId, method, params }));
  });
  return { send, ws };
}

const targets = await (await fetch(BASE + '/json')).json();
let page = targets.find((t) => t.type === 'page');
const { send } = await rpcConn(page.webSocketDebuggerUrl);

await send('Network.enable');
await send('Page.enable');
await send('Runtime.enable');
await send('Network.setCookie', {
  name: 'codialis_token', value: TOKEN,
  domain: 'localhost', path: '/', httpOnly: true,
});
await send('Page.navigate', { url: 'http://localhost:3001/admin' });
await new Promise((r) => setTimeout(r, 9000));

const { result } = await send('Runtime.evaluate', {
  expression: `(() => {
    const bodyLen = document.body.innerHTML.length;
    const txt = document.body.innerText;
    const hasLogin = /Connexion|Se connecter|mot de passe/i.test(txt);
    const blogTabBtns = [...document.querySelectorAll('*')].filter(e=>/^Blog$/.test((e.textContent||'').trim())).length;
    const testArticle = txt.includes('Article de test local');
    const jsErr = window.__err || null;
    return JSON.stringify({ bodyLen, hasLogin, testArticle, snippet: txt.slice(0,400) });
  })()`,
  returnByValue: true,
});
console.log(result.value);
process.exit(0);
