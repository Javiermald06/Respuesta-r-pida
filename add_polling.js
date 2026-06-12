const fs = require('fs');

// --- ADMIN.JS ---
let adminJs = fs.readFileSync('admin.js', 'utf8');

// Change initAdminPanel to async
adminJs = adminJs.replace(/function initAdminPanel\(\) \{[\s\S]*?loadAdminState\(\);/m, "async function initAdminPanel() {\n  await loadAdminState();\n  startRealTimeUpdates();");

const pollingAdminCode = `
let realTimeInterval = null;
let lastIncidentsHash = "";

async function startRealTimeUpdates() {
  // Inicializar el hash actual
  lastIncidentsHash = adminState.incidents.map(i => \`\${i.id}-\${i.estado}\`).join('|');
  
  if (realTimeInterval) clearInterval(realTimeInterval);
  realTimeInterval = setInterval(async () => {
    try {
      const res = await fetch('api/incidentes.php');
      const json = await res.json();
      if (json.success) {
        const currentHash = json.data.map(i => \`\${i.id}-\${i.estado}\`).join('|');
        if (lastIncidentsHash && lastIncidentsHash !== currentHash) {
          const newIncidents = json.data.filter(apiInc => !adminState.incidents.find(localInc => localInc.id == apiInc.id));
          
          if (newIncidents.length > 0) {
            playAlertSound();
            showAdminToast(\`🚨 ¡Nuevos incidentes reportados! (\${newIncidents.length})\`);
          }

          await loadAdminState();
          calculateStats();
          if (adminState.currentView === 'inicio') updateLiveFeed();
          if (adminState.currentView === 'historial') renderHistorial();
          updateMapMarkers();
        }
        lastIncidentsHash = currentHash;
      }
    } catch(e) {}
  }, 5000); // 5 segundos
}

function playAlertSound() {
  // Sonido genérico de campana de alerta
  const audio = new Audio('https://cdn.freesound.org/previews/337/337049_3232293-lq.mp3');
  audio.play().catch(() => {});
}
`;

adminJs = adminJs + "\n" + pollingAdminCode;
fs.writeFileSync('admin.js', adminJs);


// --- APP.JS ---
let appJs = fs.readFileSync('app.js', 'utf8');

// Insert after initAppState
const pollingAppCode = `
let appPollingInterval = null;
let lastAppHash = "";

function startAppPolling() {
  if (appPollingInterval) clearInterval(appPollingInterval);
  appPollingInterval = setInterval(async () => {
    try {
      const res = await fetch('api/incidentes.php');
      const json = await res.json();
      if (json.success) {
        const currentHash = json.data.map(i => \`\${i.id}-\${i.estado}\`).join('|');
        if (lastAppHash && lastAppHash !== currentHash) {
          await initAppState(); // Recarga estado completo
          updateMapMarkers();
          updateLegend();
          renderHistory();
        }
        lastAppHash = currentHash;
      }
    } catch(e) {}
  }, 10000); // 10 segundos
}
`;

appJs = appJs.replace(/window\.addEventListener\('DOMContentLoaded', \(\) => \{[\s\S]*?\}\);/m, 
`window.addEventListener('DOMContentLoaded', async () => {
  await initAppState();
  initAuthUI();
  lucide.createIcons();
  
  // Set initial hash
  lastAppHash = appState.incidents.map(i => \`\${i.id}-\${i.estado}\`).join('|');
  startAppPolling();
});`);

appJs = appJs + "\n" + pollingAppCode;
fs.writeFileSync('app.js', appJs);

console.log('Realtime polling injected.');
