const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const WAHA_URL = 'https://waha.mojib.online';
const API_KEY = 'my-secret-key';

async function check() {
  const sessionName = 'dentist_ilyas_7099';
  console.log("Checking /me for session", sessionName);
  try {
    const res = await fetch(`${WAHA_URL}/api/sessions/${sessionName}/me`, {
      headers: { 'X-Api-Key': API_KEY }
    });
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Data:", data);
  } catch(e) {
    console.error(e);
  }
}
check();
