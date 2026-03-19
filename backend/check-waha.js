const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const WAHA_URL = 'https://waha.mojib.online';
const API_KEY = 'my-secret-key';

async function check() {
  try {
    const res = await fetch(`${WAHA_URL}/api/sessions?all=true`, { headers: { 'X-Api-Key': API_KEY } });
    const sessions = await res.json();
    console.log("All Sessions:", sessions.map(s => ({ name: s.name, status: s.status })));
    
    for (const s of sessions) {
      if (s.status === 'WORKING') {
        console.log(`\nConfig for active session ${s.name}:`);
        console.log(JSON.stringify(s.config?.webhooks, null, 2));
      }
    }
  } catch (e) {
    console.error("Fetch error:", e);
  }
}
check();
