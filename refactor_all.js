const fs = require('fs');

// --- REFACTOR ADMIN.JS ---
let adminJs = fs.readFileSync('admin.js', 'utf8');

// Replace changeIncidentState
const newChangeIncidentState = `async function changeIncidentState(id, newState) {
  try {
    const res = await fetch('api/incidentes.php', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estado: newState })
    });
    const data = await res.json();
    if(data.success) {
      await initDatabase();
      renderIncidentsTable();
      updateDashboardStats();
      updateMapMarkers();
      updateLiveFeed();
    } else {
      alert(data.message);
    }
  } catch(e) { console.error(e); }
}`;
adminJs = adminJs.replace(/function changeIncidentState\(id, newState\) \{[\s\S]*?\}\n\s*function deleteIncident/, newChangeIncidentState + '\n\nfunction deleteIncident');

// Replace deleteIncident
const newDeleteIncident = `async function deleteIncident(id) {
  if (!confirm('¿Estás seguro de eliminar este reporte permanentemente?')) return;
  try {
    const res = await fetch(\`api/incidentes.php?id=\${id}\`, { method: 'DELETE' });
    const data = await res.json();
    if(data.success) {
      await initDatabase();
      renderIncidentsTable();
      updateDashboardStats();
      updateMapMarkers();
      updateLiveFeed();
    } else {
      alert(data.message);
    }
  } catch(e) { console.error(e); }
}`;
adminJs = adminJs.replace(/function deleteIncident\(id\) \{[\s\S]*?\}\n\s*function renderUsersTable/, newDeleteIncident + '\n\nfunction renderUsersTable');

// Replace toggleUserStatus
const newToggleUserStatus = `async function toggleUserStatus(dni) {
  const user = adminState.registeredUsers.find(u => u.dni === dni);
  if (!user) return;
  const newStatus = user.estado === 'activo' ? 'bloqueado' : 'activo';
  try {
    const res = await fetch('api/usuarios.php', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni, estado: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      await initDatabase();
      renderUsersTable();
      calculateStats();
    } else {
      alert(data.message);
    }
  } catch(e) { console.error(e); }
}`;
adminJs = adminJs.replace(/function toggleUserStatus\(dni\) \{[\s\S]*?\}\n\s*function deleteUser/, newToggleUserStatus + '\n\nfunction deleteUser');

// Replace deleteUser
const newDeleteUser = `async function deleteUser(dni) {
  if (!confirm('¿Eliminar ciudadano? Esto no se puede deshacer.')) return;
  try {
    const res = await fetch(\`api/usuarios.php?dni=\${dni}\`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      await initDatabase();
      renderUsersTable();
      calculateStats();
    } else {
      alert(data.message);
    }
  } catch(e) { console.error(e); }
}`;
adminJs = adminJs.replace(/function deleteUser\(dni\) \{[\s\S]*?\}\n\s*function renderEmergencyTable/, newDeleteUser + '\n\nfunction renderEmergencyTable');

// Replace saveEmergencyContact
const newSaveEmergencyContact = `async function saveEmergencyContact(e) {
  e.preventDefault();
  const cat = document.getElementById('new-em-categoria').value;
  const nombre = document.getElementById('new-em-nombre').value.trim();
  const telefono = document.getElementById('new-em-telefono').value.trim();
  const desc = document.getElementById('new-em-desc').value.trim();

  if (!nombre || !telefono) return alert('Nombre y teléfono obligatorios');

  const payload = { categoria: cat, nombre, telefono, descripcion: desc };

  try {
    let res;
    if (editingEmergencyIdx !== null) {
      payload.id = editingEmergencyIdx;
      res = await fetch('api/emergencias.php', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('api/emergencias.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    const data = await res.json();
    if(data.success) {
      document.getElementById('form-add-emergency').reset();
      editingEmergencyIdx = null;
      document.getElementById('em-form-title').textContent = "Agregar Nuevo Contacto";
      document.getElementById('em-submit-btn').textContent = "Guardar Contacto";
      await initDatabase();
      renderEmergencyTable();
    } else {
      alert(data.message);
    }
  } catch(e) { console.error(e); }
}`;
adminJs = adminJs.replace(/function saveEmergencyContact\(e\) \{[\s\S]*?\}\n\s*function editEmergencyContact/, newSaveEmergencyContact + '\n\nfunction editEmergencyContact');

// Replace editEmergencyContact (needs to pass ID instead of index)
const newEditEmergencyContact = `function editEmergencyContact(id) {
  const contact = adminState.emergencies.find(c => String(c.id) === String(id));
  if (!contact) return;
  document.getElementById('new-em-categoria').value = contact.categoria;
  document.getElementById('new-em-nombre').value = contact.nombre;
  document.getElementById('new-em-telefono').value = contact.telefono;
  document.getElementById('new-em-desc').value = contact.descripcion;

  editingEmergencyIdx = id; // Store DB ID
  document.getElementById('em-form-title').textContent = "Editar Contacto";
  document.getElementById('em-submit-btn').textContent = "Actualizar Contacto";
}`;
adminJs = adminJs.replace(/function editEmergencyContact\(idx\) \{[\s\S]*?\}\n\s*function deleteEmergencyContact/, newEditEmergencyContact + '\n\nfunction deleteEmergencyContact');

// Also update renderEmergencyTable to use ID
adminJs = adminJs.replace(/editEmergencyContact\(\${idx}\)/g, "editEmergencyContact(${contact.id})");
adminJs = adminJs.replace(/deleteEmergencyContact\(\${idx}\)/g, "deleteEmergencyContact(${contact.id})");

// Replace deleteEmergencyContact
const newDeleteEmergencyContact = `async function deleteEmergencyContact(id) {
  if (!confirm('¿Eliminar contacto de emergencia?')) return;
  try {
    const res = await fetch(\`api/emergencias.php?id=\${id}\`, { method: 'DELETE' });
    const data = await res.json();
    if(data.success) {
      await initDatabase();
      renderEmergencyTable();
    }
  } catch(e) { console.error(e); }
}`;
adminJs = adminJs.replace(/function deleteEmergencyContact\(idx\) \{[\s\S]*?\}\n\s*\/\/ === EVENTOS/, newDeleteEmergencyContact + '\n\n// === EVENTOS');

// Replace localStorage listeners and clean up
adminJs = adminJs.replace(/window\.addEventListener\('storage'[\s\S]*?\}\);/g, '');
adminJs = adminJs.replace(/\/\/ Escuchar cambios de localStorage en tiempo real desde otras pestañas \(app ciudadano\)/g, '');
// Clean any leftover localStorage sets in adminJs
adminJs = adminJs.replace(/localStorage\.setItem\('alerta_incidents'[\s\S]*?;/g, '');
adminJs = adminJs.replace(/localStorage\.setItem\('alerta_my_incidents'[\s\S]*?;/g, '');
adminJs = adminJs.replace(/localStorage\.setItem\('alerta_registered_users'[\s\S]*?;/g, '');
adminJs = adminJs.replace(/localStorage\.setItem\('alerta_emergencias'[\s\S]*?;/g, '');

fs.writeFileSync('admin.js', adminJs);
console.log('admin.js fully refactored to fetch');


// --- REFACTOR APP.JS ---
let appJs = fs.readFileSync('app.js', 'utf8');

// Replace loadEmergencies
const newLoadEmergencies = `async function loadEmergencies() {
  const container = document.getElementById('emergencies-list');
  container.innerHTML = '<p class="text-center text-gray-500 py-4">Cargando emergencias...</p>';
  try {
    const res = await fetch('api/emergencias.php');
    const json = await res.json();
    if(json.success) {
      const dbEmergencies = json.data;
      
      // Agrupar por categoría
      const grouped = {};
      dbEmergencies.forEach(em => {
        if (!grouped[em.categoria]) grouped[em.categoria] = [];
        grouped[em.categoria].push(em);
      });

      container.innerHTML = '';
      
      for (const [cat, items] of Object.entries(grouped)) {
        let icon = "heart";
        let color = "#0369a1";
        let bg = "#f0f9ff";
        
        if (cat.toLowerCase() === 'policia' || cat.toLowerCase() === 'policía') {
          icon = "shield"; color = "#1e3a8a"; bg = "#eff6ff";
        } else if (cat.toLowerCase() === 'salud') {
          icon = "heart"; color = "#dc2626"; bg = "#fef2f2";
        } else if (cat.toLowerCase() === 'bomberos') {
          icon = "flame"; color = "#e07b00"; bg = "#fff7ed";
        }
        
        const catCard = document.createElement('div');
        catCard.className = \`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4\`;
        
        let headerHtml = \`
          <div class="p-3 border-b border-gray-100 flex items-center gap-3" style="background-color: \${bg}">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-white" style="background-color: \${color}">
              <i data-lucide="\${icon}" class="w-4 h-4"></i>
            </div>
            <h3 class="font-bold text-gray-800">\${cat}</h3>
          </div>
          <div class="divide-y divide-gray-50">\`;
          
        items.forEach(srv => {
          headerHtml += \`
            <div class="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div>
                <h4 class="font-bold text-gray-800 text-sm mb-1">\${srv.nombre}</h4>
                <p class="text-xs text-gray-500">\${srv.descripcion}</p>
              </div>
              <a href="tel:\${srv.telefono}" class="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white shadow-sm active:scale-95 transition-transform" style="background-color: \${color}">
                <i data-lucide="phone" class="w-4 h-4"></i>
              </a>
            </div>
          \`;
        });
        
        headerHtml += \`</div>\`;
        catCard.innerHTML = headerHtml;
        container.appendChild(catCard);
      }
      lucide.createIcons();
    }
  } catch(e) {
    container.innerHTML = '<p class="text-center text-red-500 py-4">Error cargando emergencias</p>';
  }
}`;
appJs = appJs.replace(/function loadEmergencies\(\) \{[\s\S]*?\}\n\s*function showToast/, newLoadEmergencies + '\n\nfunction showToast');

// Remove extra localstorage set items from submitReport (lines 993-995) if they still exist.
appJs = appJs.replace(/\/\/ Persistir en localStorage\n\s*localStorage\.setItem\('alerta_incidents'[\s\S]*?;/g, '');
appJs = appJs.replace(/localStorage\.setItem\('alerta_my_incidents'[\s\S]*?;/g, '');

fs.writeFileSync('app.js', appJs);
console.log('app.js fully refactored to fetch');
