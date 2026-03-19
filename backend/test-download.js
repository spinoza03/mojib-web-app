const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const WAHA_URL = 'https://waha.mojib.online';
const API_KEY = 'my-secret-key';

async function testDownload() {
  const sessionName = 'ilyas_nadi_3542';
  const messageId = encodeURIComponent('false_212608301414@c.us_3A3DDE98EA6B191B223D');
  
  const endpointsToTry = [
    `${WAHA_URL}/api/${sessionName}/messages/${messageId}/download`,
    `${WAHA_URL}/api/sessions/${sessionName}/messages/${messageId}/download`,
    `${WAHA_URL}/api/files?session=${sessionName}&messageId=${messageId}`,
    `${WAHA_URL}/api/${sessionName}/files/${messageId}`
  ];

  for (const url of endpointsToTry) {
    console.log("Trying:", url);
    const res = await fetch(url, { headers: { 'X-Api-Key': API_KEY }});
    console.log("Status:", res.status, res.headers.get('content-type'));
    if (res.ok) {
       console.log("SUCCESS on", url);
       return;
    }
  }
}
testDownload();
