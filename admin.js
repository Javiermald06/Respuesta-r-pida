// APLICACIÓN: ALERTA ALBARRACINA - PORTAL DE ADMINISTRACIÓN
// Lógica de gestión y vigilancia en tiempo real

// 1. ESTADO GLOBAL DEL ADMINISTRADOR
let adminState = {
  incidents: [],
  registeredUsers: [],
  emergencies: [],
  currentView: 'inicio',
  activeIncidentForDetail: null,
};

// Instancias de Mapas Leaflet
let adminMapInstance = null;
let adminMapMarkers = [];
let detailMiniMapInstance = null;
let detailMiniMapMarker = null;

// Objeto de audio del modal
let adminAudioObject = null;
let isAdminAudioPlaying = false;

// Estado de edición de emergencia
let editingEmergencyIdx = null;

// Semilla de usuarios registrados por defecto

const TIPO_CONFIG = {
  robo: { label: "Robo / Asalto", color: "#c8102e", bg: "#fff0f2", emoji: "🏃" },
  accidente: { label: "Accidente", color: "#e07b00", bg: "#fff7ed", emoji: "💥" },
  sospechosos: { label: "Sospechosos", color: "#7c3aed", bg: "#f5f3ff", emoji: "👥" },
  violencia: { label: "Violencia", color: "#dc2626", bg: "#fef2f2", emoji: "🚨" },
  alcohol: { label: "Alteración alcohol", color: "#d97706", bg: "#fffbeb", emoji: "🍾" },
  abandono: { label: "Obj. abandonado", color: "#0369a1", bg: "#f0f9ff", emoji: "📦" },
  otro: { label: "Otro", color: "#64748b", bg: "#f8fafc", emoji: "❓" },
};

// 2. BOOTSTRAP DE LA PÁGINA
window.addEventListener('DOMContentLoaded', () => {
  initAdminAuth();
  lucide.createIcons();
});

function initAdminAuth() {
  const isLogged = localStorage.getItem('admin_logged') === 'true' || localStorage.getItem('admin_logged') !== null;
  if (isLogged) {
    document.getElementById('admin-auth').classList.add('hidden');
    document.getElementById('admin-panel').classList.remove('hidden');
    initAdminPanel();
  } else {
    document.getElementById('admin-auth').classList.remove('hidden');
    document.getElementById('admin-panel').classList.add('hidden');
  }
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const user = document.getElementById('admin-user').value.trim();
  const pass = document.getElementById('admin-pass').value;
  const errBox = document.getElementById('admin-login-error');

  errBox.classList.add('hidden');

  try {
    const res = await fetch('api/admin_login.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass })
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('admin_logged', JSON.stringify(data.data));
      document.getElementById('admin-auth').classList.add('hidden');
      document.getElementById('admin-panel').classList.remove('hidden');
      initAdminPanel();
    } else {
      errBox.textContent = data.message || "Usuario o contraseña incorrectos.";
      errBox.classList.remove('hidden');
    }
  } catch(e) {
    errBox.textContent = "Error de conexión con el servidor.";
    errBox.classList.remove('hidden');
  }
}

function handleAdminLogout() {
  localStorage.removeItem('admin_logged');
  if (adminMapInstance) {
    adminMapInstance.remove();
    adminMapInstance = null;
  }
  initAdminAuth();
}

// Inicializar y sincronizar base de datos localStorage
async function initAdminPanel() {
  await loadAdminState();
  startRealTimeUpdates();
  
  // Establecer fecha actual en topbar
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  document.getElementById('topbar-date').textContent = now.toLocaleDateString('es-ES', options);

  // Cargar estadísticas
  calculateStats();

  
  

  // Mostrar vista por defecto
  setAdminView('inicio');
}

async function loadAdminState() {
  try {
    // 1. Cargar Usuarios
    let res = await fetch('api/usuarios.php');
    let json = await res.json();
    if (json.success) adminState.registeredUsers = json.data;

    // 2. Cargar Incidencias
    res = await fetch('api/incidentes.php?admin=true');
    json = await res.json();
    if (json.success) {
      adminState.incidents = json.data.map(i => ({
        id: i.id,
        tipo: i.tipo,
        descripcion: i.descripcion,
        imagen: i.foto_base64,
        audio: i.audio_base64,
        lat: parseFloat(i.latitud),
        lng: parseFloat(i.longitud),
        direccion: i.direccion || "Ubicación reportada",
        estado: i.estado,
        autor: i.autor_nombre,
        usuario_dni: i.usuario_dni,
        fecha: i.fecha_reporte
      }));
    }

    // 3. Cargar Emergencias
    res = await fetch('api/emergencias.php');
    json = await res.json();
    if (json.success) adminState.emergencies = json.data;
    
  } catch(e) {
    console.error("Error al cargar estado del admin (API):", e);
  }
}


// 3. CAMBIAR DE PESTAÑA (NAVIGATION)
function setAdminView(viewName) {
  adminState.currentView = viewName;
  
  // Título header
  const titles = {
    inicio: "Panel de control",
    mapa: "Mapa de Vigilancia ",
    historial: "Historial de Reportes",
    usuarios: "Control de Ciudadanos",
    emergencias: "Gestión de Contactos de Emergencia"
  };
  document.getElementById('panel-title').textContent = titles[viewName] || "Administración";

  // Cambiar links de sidebar
  const views = ['inicio', 'mapa', 'historial', 'usuarios', 'emergencias'];
  views.forEach(v => {
    const btn = document.getElementById(`menu-${v}`);
    const section = document.getElementById(`panel-${v}`);

    if (v === viewName) {
      btn.className = "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left text-sm font-semibold transition-all bg-white/10 text-white shadow-sm";
      section.classList.remove('hidden');
    } else {
      btn.className = "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-left text-sm font-semibold transition-all text-white/70 hover:bg-white/5 hover:text-white";
      section.classList.add('hidden');
    }
  });

  // Acciones específicas por pestaña
  if (viewName === 'inicio') {
    calculateStats();
  } else if (viewName === 'mapa') {
    setTimeout(initAdminMap, 100);
  } else if (viewName === 'historial') {
    renderHistorial();
  } else if (viewName === 'usuarios') {
    renderAdminUsers();
  } else if (viewName === 'emergencias') {
    renderAdminEmergencies();
  }
}


// 4. LÓGICA DE ESTADÍSTICAS Y GRÁFICOS (DASHBOARD)
function calculateStats() {
  loadAdminState();

  const total = adminState.incidents.length;
  const active = adminState.incidents.filter(i => i.estado === 'activo').length;
  const attended = adminState.incidents.filter(i => i.estado === 'atendido').length;
  const users = adminState.registeredUsers.length;

  document.getElementById('stat-active').textContent = active;
  document.getElementById('stat-attended').textContent = attended;
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-users').textContent = users;

  // Cargar tabla de alertas urgentes recientes (máx 5 incidentes activos)
  renderRecentAlertsTable();

  // Cargar gráfico de barras
  renderStatsChart(active);
}

function renderRecentAlertsTable() {
  const tbody = document.getElementById('recent-alerts-table');
  tbody.innerHTML = "";

  const activeIncidents = adminState.incidents.filter(i => i.estado === 'activo').slice(0, 5);

  if (activeIncidents.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-6 text-center text-[#64748b] font-medium">
          No hay incidencias activas en el distrito
        </td>
      </tr>`;
    return;
  }

  activeIncidents.forEach(inc => {
    const cfg = TIPO_CONFIG[inc.tipo] || TIPO_CONFIG.otro;
    const tr = document.createElement('tr');
    tr.className = "hover:bg-black/[0.01]";
    
    tr.innerHTML = `
      <td class="py-2.5 font-bold text-[#64748b]">#${inc.id.slice(-4)}</td>
      <td class="py-2.5">
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold" style="background: ${cfg.bg}; color: ${cfg.color}">
          ${cfg.emoji} ${cfg.label}
        </span>
      </td>
      <td class="py-2.5 max-w-[200px] truncate text-slate-700">${inc.descripcion || "Sin descripción"}</td>
      <td class="py-2.5 text-[#64748b]">${formatLocalTime(inc.fecha)}</td>
      <td class="py-2.5 text-right">
        <button onclick="openAdminDetailModal('${inc.id}')" class="px-2.5 py-1 rounded bg-[#0d2b5e] hover:bg-[#1e4db7] text-white text-[10px] font-bold shadow-sm transition-colors">
          Ver Ficha
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderStatsChart(activeCount) {
  const container = document.getElementById('chart-bars-container');
  container.innerHTML = "";

  if (activeCount === 0) {
    container.innerHTML = `
      <div class="py-10 text-center text-[#64748b] text-xs font-semibold flex flex-col items-center gap-1.5">
        <i data-lucide="info" class="w-6 h-6 text-[#94a3b8]"></i>
        Sin incidencias activas para graficar
      </div>`;
    lucide.createIcons();
    return;
  }

  // Contar activos por tipo
  const counts = {};
  const activeIncidents = adminState.incidents.filter(i => i.estado === 'activo');
  activeIncidents.forEach(i => {
    counts[i.tipo] = (counts[i.tipo] || 0) + 1;
  });

  // Renderizar gráfico
  Object.keys(counts).forEach(tipo => {
    const count = counts[tipo];
    const pct = (count / activeCount) * 100;
    const cfg = TIPO_CONFIG[tipo] || TIPO_CONFIG.otro;

    const row = document.createElement('div');
    row.className = "space-y-1";
    row.innerHTML = `
      <div class="flex items-center justify-between text-xs font-bold">
        <span style="color: ${cfg.color}">${cfg.emoji} ${cfg.label}</span>
        <span class="text-[#0d1b2e]">${count} (${Math.round(pct)}%)</span>
      </div>
      <div class="w-full bg-[#f0f4f8] rounded-full overflow-hidden" style="height: 8px;">
        <div class="h-full rounded-full transition-all duration-500" style="width: ${pct}%; background-color: ${cfg.color};"></div>
      </div>
    `;
    container.appendChild(row);
  });
}


// 5. MAPA DE VIGILANCIA EN VIVO
function initAdminMap() {
  if (adminMapInstance) {
    adminMapInstance.invalidateSize();
    updateAdminMapMarkers();
    return;
  }

  // Crear mapa
  adminMapInstance = L.map('admin-map', {
    zoomControl: true,
    attributionControl: false
  }).setView([-18.0146, -70.2536], 15);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(adminMapInstance);

  updateAdminMapMarkers();
}

function updateAdminMapMarkers() {
  if (!adminMapInstance) return;

  // Limpiar marcadores anteriores
  adminMapMarkers.forEach(m => adminMapInstance.removeLayer(m));
  adminMapMarkers = [];

  const activeIncidents = adminState.incidents.filter(i => i.estado === 'activo');
  
  // Actualizar contador del sidebar feed
  document.getElementById('map-sidebar-count').textContent = activeIncidents.length;

  // Llenar feed lateral del mapa
  const feed = document.getElementById('map-alerts-feed');
  feed.innerHTML = "";

  if (activeIncidents.length === 0) {
    feed.innerHTML = `
      <div class="text-center py-12 text-[#64748b] text-xs font-semibold flex flex-col items-center gap-1.5">
        <i data-lucide="check-circle" class="w-8 h-8 text-green-400"></i>
        Distrito en paz. Sin alertas activas.
      </div>`;
    lucide.createIcons();
    return;
  }

  activeIncidents.forEach(inc => {
    const cfg = TIPO_CONFIG[inc.tipo] || TIPO_CONFIG.otro;
    
    // Crear marcador en el mapa
    // createColoredIcon está definida globalmente en styles.css o app.js compartidos, pero la redefiniremos en admin.js para evitar conflictos
    const customPin = L.divIcon({
      html: `
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.35));">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 26 16 26S32 26.5 32 16C32 7.163 24.837 0 16 0z" fill="${cfg.color}"/>
          <circle cx="16" cy="16" r="10" fill="white"/>
          <text x="16" y="20" font-size="12" text-anchor="middle" dominant-baseline="middle" style="font-family: Arial, sans-serif;">${cfg.emoji}</text>
        </svg>`,
      iconSize: [32, 42],
      iconAnchor: [16, 42],
      popupAnchor: [0, -42],
      className: "",
    });

    const marker = L.marker([inc.lat, inc.lng], { icon: customPin }).addTo(adminMapInstance);
    
    let popupImg = "";
    if (inc.imagen) {
      popupImg = `<img src="${inc.imagen}" alt="Evidencia" style="width:100%; height:80px; object-fit:cover; border-radius:8px; margin-bottom:6px;" />`;
    }

    marker.bindPopup(`
      <div style="min-width: 180px; font-family: var(--font-sans);">
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background: ${cfg.bg}; color: ${cfg.color}; margin-bottom:6px; display:inline-block;">
          ${cfg.emoji} ${cfg.label}
        </span>
        ${popupImg}
        ${inc.descripcion ? `<p style="font-size:11px; margin:4px 0; color:#374151; font-weight:600;">${inc.descripcion}</p>` : ""}
        <p style="font-size:10px; color:#6b7280; margin:4px 0 0 0;">📍 ${inc.direccion}</p>
        <p style="font-size:10px; color:#6b7280; margin:2px 0 0 0;">🕐 ${formatLocalTime(inc.fecha)}</p>
        <button onclick="openAdminDetailModal('${inc.id}')" style="width:100%; margin-top:8px; height:24px; border-radius:6px; background:#0d2b5e; color:white; border:none; font-size:10px; font-weight:bold; cursor:pointer;">Ver Detalles</button>
      </div>
    `);

    adminMapMarkers.push(marker);

    // Crear ítem de la barra lateral feed
    const card = document.createElement('div');
    card.className = "bg-white p-3.5 rounded-xl border border-black/10 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors flex gap-2.5 items-start";
    card.onclick = () => {
      adminMapInstance.setView([inc.lat, inc.lng], 17);
      marker.openPopup();
    };

    let itemThumb = `<div class="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style="background: ${cfg.bg}">${cfg.emoji}</div>`;
    if (inc.imagen) {
      itemThumb = `<img src="${inc.imagen}" alt="" class="w-10 h-10 rounded-lg object-cover flex-shrink-0" />`;
    }

    card.innerHTML = `
      ${itemThumb}
      <div class="min-w-0 flex-1">
        <div class="flex items-center justify-between gap-1">
          <span class="text-[10px] font-bold truncate" style="color: ${cfg.color}">${cfg.label}</span>
          <span class="text-[9px] text-[#64748b] font-bold">${formatLocalTime(inc.fecha).split(", ")[1] || ""}</span>
        </div>
        <p class="text-[11px] text-slate-700 truncate font-semibold mt-1">${inc.descripcion || "Sin descripción"}</p>
        <p class="text-[9px] text-[#94a3b8] truncate mt-0.5 font-bold uppercase">📍 ${inc.direccion}</p>
      </div>
    `;
    feed.appendChild(card);
  });
  lucide.createIcons();
}


// 6. HISTORIAL DE INCIDENCIAS (TABLA)
function renderHistorial() {
  loadAdminState();
  const tbody = document.getElementById('historial-table-body');
  tbody.innerHTML = "";

  const filterType = document.getElementById('filter-type').value;
  const filterStatus = document.getElementById('filter-status').value;
  const searchVal = document.getElementById('search-report').value.trim().toLowerCase();

  // Filtrar
  const filtered = adminState.incidents.filter(inc => {
    // Categoría
    if (filterType !== 'all' && inc.tipo !== filterType) return false;
    // Estado
    if (filterStatus !== 'all' && inc.estado !== filterStatus) return false;
    // Búsqueda
    if (searchVal) {
      const descMatch = (inc.descripcion || "").toLowerCase().includes(searchVal);
      const autorMatch = (inc.autor || "").toLowerCase().includes(searchVal);
      const dniMatch = (inc.usuario_dni || "").includes(searchVal);
      const addrMatch = (inc.direccion || "").toLowerCase().includes(searchVal);
      if (!descMatch && !autorMatch && !dniMatch && !addrMatch) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="py-10 text-center text-[#64748b] font-medium">
          No se encontraron reportes con los filtros seleccionados
        </td>
      </tr>`;
    return;
  }

  filtered.forEach(inc => {
    const cfg = TIPO_CONFIG[inc.tipo] || TIPO_CONFIG.otro;
    const tr = document.createElement('tr');
    tr.className = "hover:bg-black/[0.01]";

    const statusBadge = inc.estado === 'activo'
      ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fff0f2] text-[#c8102e]">EN PROCESO</span>`
      : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f0fff4] text-[#16a34a]">ATENDIDO</span>`;

    const attendBtn = inc.estado === 'activo'
      ? `<button onclick="markAdminIncidentAttended('${inc.id}')" class="px-2 py-1 rounded bg-[#16a34a] hover:bg-[#15803d] text-white text-[10px] font-bold transition-all shadow-sm" title="Marcar como Atendido">Atender</button>`
      : `<button disabled class="px-2 py-1 rounded bg-[#e2e8f0] text-[#94a3b8] text-[10px] font-bold cursor-not-allowed">Atendido</button>`;

    tr.innerHTML = `
      <td class="py-3.5 px-4 font-bold text-[#64748b]">#${inc.id.slice(-4)}</td>
      <td class="py-3.5 px-4">
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold" style="background: ${cfg.bg}; color: ${cfg.color}">
          ${cfg.emoji} ${cfg.label}
        </span>
      </td>
      <td class="py-3.5 px-4 max-w-[150px] truncate text-slate-700 font-medium">${inc.descripcion || "Sin descripción"}</td>
      <td class="py-3.5 px-4 max-w-[130px] truncate text-[#64748b] font-medium">📍 ${inc.direccion}</td>
      <td class="py-3.5 px-4 text-[#64748b]">${formatLocalTime(inc.fecha)}</td>
      <td class="py-3.5 px-4 text-[#64748b] truncate max-w-[120px]" title="${inc.autor}">${inc.autor}</td>
      <td class="py-3.5 px-4">${statusBadge}</td>
      <td class="py-3.5 px-4 flex gap-1.5 justify-center">
        <button onclick="openAdminDetailModal('${inc.id}')" class="px-2 py-1 rounded bg-[#0d2b5e] hover:bg-[#1e4db7] text-white text-[10px] font-bold transition-all shadow-sm">Detalles</button>
        ${attendBtn}
        <button onclick="deleteAdminIncident('${inc.id}')" class="px-2 py-1 rounded bg-[#c8102e] hover:bg-red-700 text-white text-[10px] font-bold transition-all shadow-sm">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function applyHistorialFilters() {
  renderHistorial();
}

function resetHistorialFilters() {
  document.getElementById('filter-type').value = 'all';
  document.getElementById('filter-status').value = 'all';
  document.getElementById('search-report').value = '';
  renderHistorial();
}

async function changeAdminIncidentState(id, newState) {
  try {
    const res = await fetch('api/incidentes.php?admin=true', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, estado: newState })
    });
    const data = await res.json();
    if(data.success) {
      await loadAdminState();
      calculateStats();
      renderHistorial();
      updateMapMarkers();
      updateLiveFeed();
      showAdminToast("✅ Incidencia actualizada");
    } else {
      alert(data.message);
    }
  } catch(e) { console.error(e); }
}

async function deleteAdminIncident(id) {
  if (!confirm("¿Está seguro de eliminar de forma permanente este reporte?")) return;
  try {
    const res = await fetch(`api/incidentes.php?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if(data.success) {
      await loadAdminState();
      calculateStats();
      renderHistorial();
      updateMapMarkers();
      updateLiveFeed();
      showAdminToast("🗑️ Reporte eliminado de la base de datos");
    } else {
      alert(data.message);
    }
  } catch(e) { console.error(e); }
}

// Función auxiliar para sincronizar el estado del reporte del ciudadano (Eliminada, se hace en el servidor)


// 7. CONTROL DE CIUDADANOS (USUARIOS)
function renderAdminUsers() {
  loadAdminState();
  const tbody = document.getElementById('admin-users-table-body');
  tbody.innerHTML = "";

  const searchVal = document.getElementById('search-user').value.trim().toLowerCase();

  const filtered = adminState.registeredUsers.filter(u => {
    if (searchVal) {
      const nameMatch = u.nombre.toLowerCase().includes(searchVal);
      const dniMatch = u.dni.includes(searchVal);
      if (!nameMatch && !dniMatch) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-[#64748b] font-medium">
          No se encontraron ciudadanos registrados
        </td>
      </tr>`;
    return;
  }

  filtered.forEach(u => {
    const isBlocked = u.estado === 'bloqueado';
    const statusBadge = isBlocked
      ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fff0f2] text-[#c8102e]">BLOQUEADO</span>`
      : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f0fff4] text-[#16a34a]">ACTIVO</span>`;

    const blockBtnText = isBlocked ? "Desbloquear" : "Bloquear";
    const blockBtnClass = isBlocked
      ? "px-2 py-1 rounded bg-[#16a34a] hover:bg-[#15803d] text-white text-[10px] font-bold transition-all shadow-sm"
      : "px-2 py-1 rounded bg-[#e07b00] hover:bg-orange-700 text-white text-[10px] font-bold transition-all shadow-sm";

    trHtml = `
      <td class="py-3 px-2 text-[#0d2b5e] font-bold">${u.dni}</td>
      <td class="py-3 px-2 text-slate-700 font-bold">${u.nombre}</td>
      <td class="py-3 px-2 text-[#64748b]">${u.telefono}</td>
      <td class="py-3 px-2">${statusBadge}</td>
      <td class="py-3 px-2 flex gap-1.5 justify-center">
        <button onclick="toggleAdminUserBlock('${u.dni}')" class="${blockBtnClass}">${blockBtnText}</button>
        <button onclick="deleteAdminUser('${u.dni}')" class="px-2 py-1 rounded bg-[#c8102e] hover:bg-red-700 text-white text-[10px] font-bold transition-all shadow-sm">Eliminar</button>
      </td>
    `;
    const tr = document.createElement('tr');
    tr.className = "hover:bg-black/[0.01]";
    tr.innerHTML = trHtml;
    tbody.appendChild(tr);
  });
}

function handleAdminRegisterUser(event) {
  event.preventDefault();
  const errorBox = document.getElementById('reg-error');
  errorBox.classList.add('hidden');

  const nombre = document.getElementById('reg-name').value.trim();
  const dni = document.getElementById('reg-dni').value.trim();
  const telefono = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-pass').value;

  if (!nombre) {
    errorBox.textContent = "Ingrese nombre completo.";
    errorBox.classList.remove('hidden');
    return;
  }

  if (dni.length !== 8 || !/^\d+$/.test(dni)) {
    errorBox.textContent = "El DNI debe tener exactamente 8 dígitos.";
    errorBox.classList.remove('hidden');
    return;
  }

  if (telefono.length !== 9 || !/^\d+$/.test(telefono)) {
    errorBox.textContent = "El teléfono debe tener exactamente 9 dígitos.";
    errorBox.classList.remove('hidden');
    return;
  }

  if (password.length < 6) {
    errorBox.textContent = "La contraseña debe tener al menos 6 caracteres.";
    errorBox.classList.remove('hidden');
    return;
  }

  // Validar si el DNI ya existe
  loadAdminState();
  if (adminState.registeredUsers.some(u => u.dni === dni)) {
    errorBox.textContent = "Este DNI ya se encuentra registrado.";
    errorBox.classList.remove('hidden');
    return;
  }

  // Agregar usuario
  const newUser = { nombre, dni, telefono, estado: "activo", password };
  adminState.registeredUsers.push(newUser);
  

  // Limpiar campos
  document.getElementById('reg-name').value = "";
  document.getElementById('reg-dni').value = "";
  document.getElementById('reg-phone').value = "";
  document.getElementById('reg-pass').value = "";

  calculateStats();
  renderAdminUsers();
  showAdminToast("✅ Ciudadano registrado exitosamente");
}

async function toggleAdminUserBlock(dni) {
  await loadAdminState();
  const user = adminState.registeredUsers.find(u => String(u.dni) === String(dni));
  if (user) {
    const newEstado = user.estado === 'bloqueado' ? 'activo' : 'bloqueado';
    try {
      const res = await fetch('api/usuarios.php', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni: dni, estado: newEstado })
      });
      const json = await res.json();
      if (json.success) {
        await loadAdminState();
        renderAdminUsers();
        showAdminToast(newEstado === 'bloqueado' ? "🚫 Cuenta bloqueada" : "🔓 Cuenta activada");
      } else {
        alert(json.message || "Error al actualizar estado");
      }
    } catch(e) { alert("Error de conexión"); }
  }
}

async function deleteAdminUser(dni) {
  if (!confirm("¿Está seguro de eliminar a este ciudadano de los registros?")) return;
  try {
    const res = await fetch('api/usuarios.php?dni=' + String(dni), { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      await loadAdminState();
      calculateStats();
      renderAdminUsers();
      showAdminToast("🗑️ Ciudadano eliminado del padrón");
    } else {
      alert(json.message || "Error al eliminar");
    }
  } catch(e) { alert("Error de conexión"); }
}


// 8. CRUD CONTACTOS DE EMERGENCIA
function renderAdminEmergencies() {
  loadAdminState();
  const tbody = document.getElementById('admin-emergencies-table-body');
  tbody.innerHTML = "";

  if (adminState.emergencies.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-[#64748b] font-medium">
          No hay contactos en el directorio
        </td>
      </tr>`;
    return;
  }

  adminState.emergencies.forEach((em, index) => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-black/[0.01]";
    
    tr.innerHTML = `
      <td class="py-3 px-2 text-[#64748b] font-bold text-[10px] uppercase">${em.categoria}</td>
      <td class="py-3 px-2 text-[#0d2b5e] font-bold">${em.nombre}</td>
      <td class="py-3 px-2 text-[#c8102e] font-bold">${em.telefono}</td>
      <td class="py-3 px-2 text-slate-700 max-w-[180px] truncate font-medium">${em.descripcion || "-"}</td>
      <td class="py-3 px-2 flex gap-1.5 justify-center">
        <button onclick="editAdminEmergency(${index})" class="px-2 py-1 rounded bg-[#0d2b5e] hover:bg-[#1e4db7] text-white text-[10px] font-bold transition-all shadow-sm">Editar</button>
        <button onclick="deleteAdminEmergency(${index})" class="px-2 py-1 rounded bg-[#c8102e] hover:bg-red-700 text-white text-[10px] font-bold transition-all shadow-sm">Eliminar</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function handleAdminEmergencySubmit(event) {
  event.preventDefault();
  
  const categoria = document.getElementById('em-category').value;
  const nombre = document.getElementById('em-name').value.trim();
  const telefono = document.getElementById('em-number').value.trim();
  const descripcion = document.getElementById('em-desc').value.trim();

  try {
    let method = 'POST';
    let bodyData = { categoria, nombre, telefono, descripcion };
    
    if (editingEmergencyIdx !== null) {
      method = 'PUT';
      // Buscar ID real usando el index temporal
      const emToEdit = adminState.emergencies[editingEmergencyIdx];
      bodyData.id = emToEdit.id;
    }
    
    const res = await fetch('api/emergencias.php', {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });
    const json = await res.json();
    
    if (json.success) {
      showAdminToast(editingEmergencyIdx !== null ? "✏️ Contacto editado con éxito" : "✅ Nuevo contacto agregado");
      clearEmergencyForm();
      await loadAdminState();
      renderAdminEmergencies();
    } else {
      alert(json.message || "Error al guardar");
    }
  } catch(e) { alert("Error de conexión"); }
}

function editAdminEmergency(idx) {
  loadAdminState();
  const em = adminState.emergencies[idx];
  if (em) {
    editingEmergencyIdx = idx;
    
    document.getElementById('edit-emergency-idx').value = idx;
    document.getElementById('em-category').value = em.categoria;
    document.getElementById('em-name').value = em.nombre;
    document.getElementById('em-number').value = em.telefono;
    document.getElementById('em-desc').value = em.descripcion;

    document.getElementById('emergency-form-title').innerHTML = `<i data-lucide="edit-3" class="w-4.5 h-4.5 text-[#0d2b5e]"></i> Editar Contacto`;
    document.getElementById('emergency-cancel-btn').classList.remove('hidden');
    lucide.createIcons();
  }
}

async function deleteAdminEmergency(idx) {
  if (!confirm("¿Desea borrar este contacto de emergencia?")) return;
  const emToDelete = adminState.emergencies[idx];
  try {
    const res = await fetch('api/emergencias.php?id=' + emToDelete.id, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      await loadAdminState();
      renderAdminEmergencies();
      showAdminToast("🗑️ Contacto eliminado");
    } else {
      alert(json.message || "Error al eliminar");
    }
  } catch(e) { alert("Error de conexión"); }
}

function clearEmergencyForm() {
  editingEmergencyIdx = null;
  document.getElementById('edit-emergency-idx').value = "";
  document.getElementById('em-category').value = "Seguridad";
  document.getElementById('em-name').value = "";
  document.getElementById('em-number').value = "";
  document.getElementById('em-desc').value = "";

  document.getElementById('emergency-form-title').innerHTML = `<i data-lucide="phone-forwarded" class="w-4.5 h-4.5 text-[#0d2b5e]"></i> Agregar Contacto`;
  document.getElementById('emergency-cancel-btn').classList.add('hidden');
  lucide.createIcons();
}


// 9. MODAL DETALLE DE INCIDENCIA
function openAdminDetailModal(id) {
  loadAdminState();
  const inc = adminState.incidents.find(i => i.id === id);
  if (!inc) return;

  adminState.activeIncidentForDetail = inc;
  const cfg = TIPO_CONFIG[inc.tipo] || TIPO_CONFIG.otro;

  // Llenar textos
  document.getElementById('det-report-id').textContent = `REPORTE ID: #${inc.id}`;
  document.getElementById('det-time').textContent = inc.hora;
  document.getElementById('det-address').textContent = inc.direccion;
  document.getElementById('det-author').textContent = inc.autor;
  document.getElementById('det-description').textContent = inc.descripcion || "Sin descripción adicional provista.";

  // Tipo Badge
  const typeBadge = document.getElementById('det-type-badge');
  typeBadge.textContent = `${cfg.emoji} ${cfg.label}`;
  typeBadge.style.background = cfg.bg;
  typeBadge.style.color = cfg.color;

  // Estado Badge
  const statusBadge = document.getElementById('det-status-badge');
  if (inc.estado === 'activo') {
    statusBadge.textContent = "EN PROCESO";
    statusBadge.className = "text-xs font-bold px-3 py-1 rounded-full bg-[#fff0f2] text-[#c8102e]";
  } else {
    statusBadge.textContent = "ATENDIDO";
    statusBadge.className = "text-xs font-bold px-3 py-1 rounded-full bg-[#f0fff4] text-[#16a34a]";
  }

  // Foto
  const imgEl = document.getElementById('det-image');
  const imgPlaceholder = document.getElementById('det-image-placeholder');
  if (inc.imagen) {
    imgEl.src = inc.imagen;
    imgEl.classList.remove('hidden');
    imgPlaceholder.classList.add('hidden');
  } else {
    imgEl.classList.add('hidden');
    imgPlaceholder.classList.remove('hidden');
  }

  // Reproductor de Audio
  const audioContainer = document.getElementById('det-audio-player-container');
  const playIcon = document.getElementById('det-audio-play-icon');
  
  if (adminAudioObject) {
    adminAudioObject.pause();
    adminAudioObject = null;
  }
  isAdminAudioPlaying = false;
  playIcon.setAttribute('data-lucide', 'play');

  if (inc.audio) {
    audioContainer.classList.remove('hidden');
  } else {
    audioContainer.classList.add('hidden');
  }

  // Acciones en footer
  const btnAttend = document.getElementById('det-btn-attend');
  const btnDelete = document.getElementById('det-btn-delete');

  if (inc.estado === 'activo') {
    btnAttend.classList.remove('hidden');
    btnAttend.onclick = () => {
      markAdminIncidentAttended(inc.id);
      closeAdminDetailModal();
    };
  } else {
    btnAttend.classList.add('hidden');
  }

  btnDelete.onclick = () => {
    deleteAdminIncident(inc.id);
    closeAdminDetailModal();
  };

  // Mostrar Modal
  document.getElementById('modal-detalle-reporte').classList.remove('hidden');

  // Inicializar mini-mapa en la coordenada de la incidencia
  setTimeout(() => {
    initDetailMiniMap(inc.lat, inc.lng, cfg.color, cfg.emoji);
  }, 200);

  lucide.createIcons();
}

function closeAdminDetailModal() {
  document.getElementById('modal-detalle-reporte').classList.add('hidden');
  
  // Parar audio si está en reproducción
  if (adminAudioObject) {
    adminAudioObject.pause();
    adminAudioObject = null;
  }
  isAdminAudioPlaying = false;

  // Destruir mapa anterior para evitar fugas de memoria
  if (detailMiniMapInstance) {
    detailMiniMapInstance.remove();
    detailMiniMapInstance = null;
    detailMiniMapMarker = null;
  }

  adminState.activeIncidentForDetail = null;
}

function initDetailMiniMap(lat, lng, color, emoji) {
  if (detailMiniMapInstance) {
    detailMiniMapInstance.remove();
  }

  detailMiniMapInstance = L.map('det-mini-map', {
    zoomControl: false,
    attributionControl: false,
    scrollWheelZoom: false,
    dragging: false,
    touchZoom: false
  }).setView([lat, lng], 16);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(detailMiniMapInstance);

  const customPin = L.divIcon({
    html: `
      <svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 32 42">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 26 16 26S32 26.5 32 16C32 7.163 24.837 0 16 0z" fill="${color}"/>
        <circle cx="16" cy="16" r="10" fill="white"/>
        <text x="16" y="20" font-size="12" text-anchor="middle" dominant-baseline="middle" style="font-family: Arial, sans-serif;">${emoji}</text>
      </svg>`,
    iconSize: [30, 40],
    iconAnchor: [15, 40],
    className: "",
  });

  detailMiniMapMarker = L.marker([lat, lng], { icon: customPin }).addTo(detailMiniMapInstance);
}

function toggleAdminAudioPlayback() {
  const inc = adminState.activeIncidentForDetail;
  if (!inc || !inc.audio) return;

  const playIcon = document.getElementById('det-audio-play-icon');

  if (isAdminAudioPlaying && adminAudioObject) {
    adminAudioObject.pause();
    isAdminAudioPlaying = false;
    playIcon.setAttribute('data-lucide', 'play');
  } else {
    adminAudioObject = new Audio(inc.audio);
    adminAudioObject.onended = () => {
      isAdminAudioPlaying = false;
      playIcon.setAttribute('data-lucide', 'play');
      lucide.createIcons();
    };
    adminAudioObject.play().catch(e => console.error("Error reproduciendo audio:", e));
    isAdminAudioPlaying = true;
    playIcon.setAttribute('data-lucide', 'pause');
  }
  lucide.createIcons();
}


// 10. TOAST INTERNO DEL ADMINISTRADOR
let adminToastTimeout = null;

function showAdminToast(message) {
  // Crear toast si no existe
  let toast = document.getElementById('admin-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'admin-toast';
    toast.className = "fixed bottom-6 right-6 z-[9999] px-4.5 py-3 rounded-2xl bg-[#0d2b5e] text-white shadow-2xl flex items-center gap-2.5 font-bold text-xs border border-white/10 transition-all transform duration-300 translate-y-12 opacity-0";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.remove('translate-y-12', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  if (adminToastTimeout) {
    clearTimeout(adminToastTimeout);
  }

  adminToastTimeout = setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-12', 'opacity-0');
    adminToastTimeout = null;
  }, 3500);
}

let lastIncidentsHash = '';
let realTimeInterval = null;

// Helper para formatear fechas de la BD a hora local (Tacna)
function formatLocalTime(dbDateStr) {
  if (!dbDateStr) return "";
  const d = new Date(dbDateStr.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return dbDateStr;
  return d.toLocaleString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

async function startRealTimeUpdates() {
  // Inicializar el hash actual
  lastIncidentsHash = adminState.incidents.map(i => `${i.id}-${i.estado}`).join('|');
  
  if (realTimeInterval) clearInterval(realTimeInterval);
  realTimeInterval = setInterval(async () => {
    try {
      const res = await fetch('api/incidentes.php?admin=true');
      const json = await res.json();
      if (json.success) {
        const currentHash = json.data.map(i => `${i.id}-${i.estado}`).join('|');
        if (lastIncidentsHash && lastIncidentsHash !== currentHash) {
          const newIncidents = json.data.filter(apiInc => !adminState.incidents.find(localInc => localInc.id == apiInc.id));
          
          if (newIncidents.length > 0) {
            playAlertSound();
            showAdminToast(`🚨 ¡Nuevos incidentes reportados! (${newIncidents.length})`);
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
  }, 10000); // 10 segundos
}

function playAlertSound() {
  // Sonido genérico de campana de alerta
  const audio = new Audio('https://cdn.freesound.org/previews/337/337049_3232293-lq.mp3');
  audio.play().catch(() => {});
}
