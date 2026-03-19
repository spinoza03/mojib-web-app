const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
async function check() {
  const res = await fetch('https://waha.mojib.online/swagger-json');
  const swagger = await res.json();
  const paths = Object.keys(swagger.paths).filter(p => p.includes('download') || p.includes('media') || p.includes('file'));
  console.log("Media paths in WAHA:", paths);
}
check();
