// APLICACIÓN: ALERTA ALBARRACINA
// Lógica central del sistema de reporte de incidencias

// 1. CONFIGURACIONES GENERALES Y SEMILLAS
const TIPO_CONFIG = {
  robo: { label: "Robo / Asalto", color: "#c8102e", bg: "#fff0f2", emoji: "🏃" },
  accidente: { label: "Accidente", color: "#e07b00", bg: "#fff7ed", emoji: "💥" },
  sospechosos: { label: "Sospechosos", color: "#7c3aed", bg: "#f5f3ff", emoji: "👥" },
  violencia: { label: "Violencia", color: "#dc2626", bg: "#fef2f2", emoji: "🚨" },
  alcohol: { label: "Alteración alcohol", color: "#d97706", bg: "#fffbeb", emoji: "🍾" },
  abandono: { label: "Obj. abandonado", color: "#0369a1", bg: "#f0f9ff", emoji: "📦" },
  otro: { label: "Otro", color: "#64748b", bg: "#f8fafc", emoji: "❓" },
};

const TIPOS_INCIDENTE = [
  { id: "robo", label: "Robo / Asalto", icon: "shield-alert", color: "#c8102e" },
  { id: "accidente", label: "Accidente", icon: "car", color: "#e07b00" },
  { id: "sospechosos", label: "Sospechosos", icon: "users", color: "#7c3aed" },
  { id: "violencia", label: "Violencia", icon: "alert-triangle", color: "#dc2626" },
  { id: "alcohol", label: "Alteración alcohol", icon: "zap", color: "#d97706" },
  { id: "abandono", label: "Obj. abandonado", icon: "package", color: "#0369a1" },
  { id: "otro", label: "Otro", icon: "alert-triangle", color: "#64748b" },
];

const EMERGENCIAS = [
  {
    categoria: "Seguridad",
    color: "#0d2b5e",
    bg: "#e8edf5",
    servicios: [
      { nombre: "PNP - Emergencias", numero: "105", descripcion: "Policía Nacional del Perú", icon: "shield" },
      { nombre: "Serenazgo MDCGAL", numero: "052-244444", descripcion: "Seguridad ciudadana distrital", icon: "users" },
      { nombre: "Comisaría Albarracín", numero: "052-287000", descripcion: "Comisaría del distrito", icon: "shield" },
    ],
  },
  {
    categoria: "Salud",
    color: "#dc2626",
    bg: "#fef2f2",
    servicios: [
      { nombre: "SAMU", numero: "106", descripcion: "Servicio de atención médica urgente", icon: "heart" },
      { nombre: "Hospital Hipólito Unanue", numero: "052-241241", descripcion: "Hospital regional de Tacna", icon: "heart" },
      { nombre: "Centro de Salud Albarracín", numero: "052-289100", descripcion: "Atención médica primaria", icon: "heart" },
    ],
  },
  {
    categoria: "Bomberos",
    color: "#e07b00",
    bg: "#fff7ed",
    servicios: [
      { nombre: "Bomberos Voluntarios", numero: "116", descripcion: "Compañía de Bomberos Tacna", icon: "flame" },
      { nombre: "Defensa Civil", numero: "115", descripcion: "Instituto Nacional de Defensa Civil", icon: "alert-circle" },
    ],
  },
  {
    categoria: "Otros",
    color: "#0369a1",
    bg: "#f0f9ff",
    servicios: [
      { nombre: "Cruz Roja", numero: "052-252551", descripcion: "Cruz Roja Peruana - Tacna", icon: "heart" },
      { nombre: "Municipalidad Tacna", numero: "052-427474", descripcion: "Municipalidad Provincial de Tacna", icon: "truck" },
      { nombre: "Línea 100", numero: "100", descripcion: "Violencia familiar y sexual", icon: "alert-circle" },
    ],
  },
];

// Helper para formatear fechas de la BD a hora local (Tacna)
function formatLocalTime(dbDateStr) {
  if (!dbDateStr) return "";
  // Asumimos que dbDateStr viene en UTC o horario de servidor. Lo pasamos a objeto Date
  // Ajustando para que el navegador lo entienda (reemplazar espacio por T y forzar UTC)
  const d = new Date(dbDateStr.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return dbDateStr;
  
  // Formatear en horario local del dispositivo
  return d.toLocaleString('es-PE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}


// 2. ESTADO GLOBAL DE LA APLICACIÓN
let appState = {
  currentUser: null,
  incidents: [],
  myIncidents: [],
  currentTab: 'mapa',
  drawerTab: 'activos',
  userPos: [-18.013, -70.252], // Coordenadas por defecto (Tacna/Gregorio Albarracín)
  authMode: 'login',
};

// variables del mapa Leaflet
let mapInstance = null;
let userMarkerInstance = null;
let mapMarkers = [];

// variables del formulario de reporte
let reportFormData = {
  tipo: "",
  descripcion: "",
  imagen: null, // base64 string
  audioBlob: null,
  audioUrl: null,
  audioSecs: 0,
  lat: null,
  lng: null,
  direccion: ""
};

// variables del grabador de voz
let mediaRecorder = null;
let recording = false;
let audioChunks = [];
let audioTimerInterval = null;
let audioPlaybackObject = null;
let isAudioPlaying = false;
const MAX_AUDIO_SECS = 30;

// 3. EVENTO AL CARGAR EL DOM
window.addEventListener('DOMContentLoaded', async () => {
  initAuthUI();
  lucide.createIcons();
  await initAppState();
  
  // Set initial hash
  lastAppHash = appState.incidents.map(i => `${i.id}-${i.estado}`).join('|');
  startAppPolling();
});

// Inicializar el estado de la app leyendo localStorage
async function initAppState() {
  const savedUser = localStorage.getItem('alerta_user');
  if (savedUser) {
    appState.currentUser = JSON.parse(savedUser);
  }

  try {
    const citizenParam = appState.currentUser ? '?citizen_dni=' + appState.currentUser.dni : '';
    const res = await fetch('api/incidentes.php' + citizenParam);
    const json = await res.json();
    if(json.success) {
      // Map DB fields to appState format
      appState.incidents = json.data.map(i => ({
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
        fecha: i.fecha_reporte,
        usuario_dni: i.usuario_dni
      }));
      
      if(appState.currentUser) {
        appState.myIncidents = appState.incidents.filter(i => i.usuario_dni === appState.currentUser.dni);
      } else {
        appState.myIncidents = [];
      }
    }
  } catch(e) { console.error(e); }

  navigator.geolocation?.getCurrentPosition(
    (position) => {
      appState.userPos = [position.coords.latitude, position.coords.longitude];
      if (mapInstance) {
        mapInstance.setView(appState.userPos, 15);
        if (userMarkerInstance) {
          userMarkerInstance.setLatLng(appState.userPos);
        }
      }
    },
    (error) => {
      console.log("GPS no disponible, usando coordenadas por defecto.", error);
    }
  );
}

// 4. SISTEMA DE AUTENTICACIÓN
function initAuthUI() {
  if (appState.currentUser) {
    document.getElementById('screen-auth').classList.add('hidden');
    document.getElementById('screen-app').classList.remove('hidden');
    onLoginSuccess();
  } else {
    document.getElementById('screen-auth').classList.remove('hidden');
    document.getElementById('screen-app').classList.add('hidden');
    setAuthMode('login');
  }
}

function setAuthMode(mode) {
  appState.authMode = mode;
  const loginBtn = document.getElementById('tab-login-btn');
  const registerBtn = document.getElementById('tab-register-btn');
  const registerFields = document.getElementById('register-fields');
  const confirmField = document.getElementById('confirm-password-field');
  const errorBox = document.getElementById('auth-error');
  const submitBtn = document.getElementById('auth-submit-btn');

  errorBox.classList.add('hidden');
  
  if (mode === 'login') {
    loginBtn.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg bg-[#0d2b5e] text-white transition-all shadow-sm";
    registerBtn.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg text-[#64748b] transition-all";
    registerFields.classList.add('hidden');
    confirmField.classList.add('hidden');
    submitBtn.textContent = "Ingresar";
    
    // Quitar requeridos
    document.getElementById('nombre').required = false;
    document.getElementById('telefono').required = false;
    document.getElementById('confirmPassword').required = false;
  } else {
    registerBtn.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg bg-[#0d2b5e] text-white transition-all shadow-sm";
    loginBtn.className = "flex-1 py-2.5 text-sm font-semibold rounded-lg text-[#64748b] transition-all";
    registerFields.classList.remove('hidden');
    confirmField.classList.remove('hidden');
    submitBtn.textContent = "Crear cuenta";
    
    // Poner requeridos
    document.getElementById('nombre').required = true;
    document.getElementById('telefono').required = true;
    document.getElementById('confirmPassword').required = true;
  }
  lucide.createIcons();
}

function togglePasswordVisibility(id) {
  const input = document.getElementById(id);
  const icon = document.getElementById(id + '-eye-icon');
  
  if (input.type === 'password') {
    input.type = 'text';
    icon.setAttribute('data-lucide', 'eye-off');
  } else {
    input.type = 'password';
    icon.setAttribute('data-lucide', 'eye');
  }
  lucide.createIcons();
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const dni = document.getElementById('dni').value.trim();
  const password = document.getElementById('password').value;
  const errorBox = document.getElementById('auth-error');

  errorBox.classList.add('hidden');

  if (dni.length !== 8) {
    errorBox.textContent = "El DNI debe tener 8 dígitos";
    errorBox.classList.remove('hidden');
    return;
  }

  const submitBtn = document.getElementById('auth-submit-btn');
  const originalBtnText = submitBtn.textContent;
  submitBtn.textContent = "Cargando...";
  submitBtn.disabled = true;
  submitBtn.classList.add('opacity-75', 'cursor-not-allowed');

  if (appState.authMode === 'login') {
    try {
      const res = await fetch('api/usuarios.php?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni, password })
      });
      const data = await res.json();
      if (data.success) {
        appState.currentUser = data.data;
        localStorage.setItem('alerta_user', JSON.stringify(appState.currentUser));
        await initAppState(); // reload data
        document.getElementById('screen-auth').classList.add('hidden');
        document.getElementById('screen-app').classList.remove('hidden');
        onLoginSuccess();
      } else {
        errorBox.textContent = data.message;
        errorBox.classList.remove('hidden');
      }
    } catch(e) {
        errorBox.textContent = "Error de conexión al iniciar sesión.";
        errorBox.classList.remove('hidden');
    } finally {
        resetBtn();
    }
  } else {
    // Registro
    const nombre = document.getElementById('nombre').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const confirm = document.getElementById('confirmPassword').value;
    if (!nombre) {
      errorBox.textContent = "El nombre es obligatorio";
      errorBox.classList.remove('hidden');
      resetBtn();
      return;
    }
    if (password !== confirm) {
      errorBox.textContent = "Las contraseñas no coinciden";
      errorBox.classList.remove('hidden');
      resetBtn();
      return;
    }
    try {
      const res = await fetch('api/usuarios.php?action=register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni, nombre, telefono, password })
      });
      const data = await res.json();
      if (data.success) {
        showToast("✅ Registro exitoso. Ahora puedes iniciar sesión.");
        setAuthMode('login');
      } else {
        errorBox.textContent = data.message || "Error al registrarse";
        errorBox.classList.remove('hidden');
      }
    } catch(e) {
      errorBox.textContent = "Error de conexión al registrar.";
      errorBox.classList.remove('hidden');
    } finally {
      resetBtn();
    }
  }

  function resetBtn() {
    if (appState.authMode === 'login') {
      submitBtn.textContent = "Ingresar";
    } else {
      submitBtn.textContent = "Crear cuenta";
    }
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
  }
}

function onLoginSuccess() {
  // Saludo en topbar
  const firstName = appState.currentUser.nombre.split(" ")[0];
  document.getElementById('top-bar-user-greeting').textContent = `Hola, ${firstName}`;

  // Cargar datos en Ajustes
  document.getElementById('settings-user-name').textContent = appState.currentUser.nombre;
  document.getElementById('settings-user-dni').textContent = `DNI: ${appState.currentUser.dni}`;
  document.getElementById('settings-user-phone').textContent = appState.currentUser.telefono;

  // Cargar historial y emergencias
  renderHistory();
  renderEmergencies();

  // Inicializar mapa si es la pestaña seleccionada
  if (appState.currentTab === 'mapa') {
    setTimeout(initMap, 200);
  }
}

function handleLogout() {
  localStorage.removeItem('alerta_user');
  appState.currentUser = null;
  appState.myIncidents = [];
  
  // Reset view to Map tab
  appState.currentTab = 'mapa';
  switchTab('mapa');

  initAuthUI();
}

// Prompt para simulación de cambio de contraseña
function handlePasswordChangePrompt() {
  const currentPass = prompt("Ingrese su contraseña actual:");
  if (currentPass === null) return;
  if (currentPass.length < 6) {
    alert("Contraseña inválida.");
    return;
  }
  const newPass = prompt("Ingrese su nueva contraseña (mínimo 6 caracteres):");
  if (newPass === null) return;
  if (newPass.length < 6) {
    alert("La nueva contraseña debe tener al menos 6 caracteres.");
    return;
  }
  alert("Contraseña actualizada con éxito.");
}


// 5. SISTEMA DE NAVEGACIÓN (TABS)
function switchTab(tabId) {
  if (appState.currentTab === tabId && tabId !== 'mapa') return;
  appState.currentTab = tabId;

  // Actualizar visibilidad de vistas
  const views = ['mapa', 'historial', 'emergencias', 'ajustes'];
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (v === tabId) {
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  });

  // Mantener la barra superior visible en toda la aplicación
  const topBar = document.getElementById('app-top-bar');
  topBar.classList.remove('hidden');

  if (tabId === 'mapa') {
    // Inicializar o invalidar mapa para recalcular tamaño
    if (!mapInstance) {
      setTimeout(initMap, 100);
    } else {
      setTimeout(() => {
        mapInstance.invalidateSize();
      }, 100);
    }
  }

  // Actualizar botones de navegación inferior
  const btns = ['mapa', 'historial', 'emergencias', 'ajustes'];
  btns.forEach(b => {
    const btn = document.getElementById(`nav-${b}`);
    if (b === tabId) {
      if (b === 'emergencias') {
        btn.className = "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 rounded-xl transition-all bg-[#fff0f2] text-[#c8102e]";
      } else {
        btn.className = "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 rounded-xl transition-all bg-[#e8edf5] text-[#0d2b5e]";
      }
    } else {
      btn.className = "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 rounded-xl transition-all text-[#64748b]";
    }
  });

  // Renderizar vistas específicas al entrar
  if (tabId === 'historial') {
    renderHistory();
  }
}


// 6. LÓGICA DE MAPA (LEAFLET)
function initMap() {
  if (mapInstance) return;

  // Crear mapa
  mapInstance = L.map('map', {
    zoomControl: false,
    attributionControl: false
  }).setView(appState.userPos, 15);

  // Agregar capa base de OpenStreetMap
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(mapInstance);

  // Crear marcador del usuario
  const userIcon = L.divIcon({
    html: `<div style="width:18px;height:18px;background:#1e4db7;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    className: ""
  });

  userMarkerInstance = L.marker(appState.userPos, { icon: userIcon })
    .addTo(mapInstance)
    .bindPopup('Tu ubicación actual');

  // Cargar marcadores de incidencias
  updateMapMarkers();
  updateLegend();
}

// Crear marcador pin con color y emoji representativo
function createColoredIcon(color, emoji) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42" style="filter: drop-shadow(0px 2px 4px rgba(0,0,0,0.3));">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 26 16 26S32 26.5 32 16C32 7.163 24.837 0 16 0z" fill="${color}"/>
      <circle cx="16" cy="16" r="10" fill="white"/>
      <text x="16" y="20" font-size="12" text-anchor="middle" dominant-baseline="middle" style="font-family: Arial, sans-serif;">${emoji}</text>
    </svg>`;
  return L.divIcon({
    html: svg,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -42],
    className: "",
  });
}

function updateMapMarkers() {
  if (!mapInstance) return;

  // Remover marcadores anteriores
  mapMarkers.forEach(m => mapInstance.removeLayer(m));
  mapMarkers = [];

  // Agregar nuevos marcadores (solo activos)
  appState.incidents.forEach(inc => {
    if (inc.estado === 'atendido') return;

    const cfg = TIPO_CONFIG[inc.tipo] || TIPO_CONFIG.otro;
    const pinIcon = createColoredIcon(cfg.color, cfg.emoji);

    const marker = L.marker([inc.lat, inc.lng], { icon: pinIcon })
      .addTo(mapInstance);

    // Contenido del Popup
    let imgHtml = "";
    if (inc.imagen) {
      imgHtml = `<img src="${inc.imagen}" alt="Evidencia" style="width: 100%; height: 85px; object-fit: cover; border-radius: 8px; margin-bottom: 6px;" />`;
    }

    let audioHtml = "";
    if (inc.audio) {
      audioHtml = `
        <div style="display:flex; align-items:center; gap:6px; background:#f0fff4; border:1px solid #bbf7d0; border-radius:6px; padding:3px 6px; margin: 6px 0;">
          <span style="font-size:10px; color:#15803d; font-weight:bold;">🎙️ Nota de voz adjunta</span>
        </div>`;
    }

    const popupContent = `
      <div style="min-width: 190px; font-family: var(--font-sans);">
        <div class="flex items-center gap-1.5 mb-2">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background: ${cfg.bg}; color: ${cfg.color}">
            ${cfg.label}
          </span>
        </div>
        ${imgHtml}
        ${inc.descripcion ? `<p style="font-size: 11px; margin: 4px 0; color: #374151; font-weight: 500; line-height: 1.3;">${inc.descripcion}</p>` : ""}
        ${audioHtml}
        <p style="font-size: 10px; color: #6b7280; margin: 4px 0 0 0;">📍 ${inc.direccion}</p>
        <p style="font-size: 10px; color: #6b7280; margin: 2px 0 0 0;">🕐 ${formatLocalTime(inc.fecha)}</p>
      </div>`;

    marker.bindPopup(popupContent);
    mapMarkers.push(marker);
  });
}

function updateLegend() {
  const legendCard = document.getElementById('map-legend');
  const itemsContainer = document.getElementById('legend-items');
  itemsContainer.innerHTML = "";

  const activeIncidents = appState.incidents.filter(i => i.estado === 'activo');
  if (activeIncidents.length === 0) {
    legendCard.classList.add('hidden');
    return;
  }

  legendCard.classList.remove('hidden');

  // Contar por tipo
  const counts = {};
  activeIncidents.forEach(inc => {
    counts[inc.tipo] = (counts[inc.tipo] || 0) + 1;
  });

  // Renderizar tipos activos
  Object.keys(counts).forEach(tipo => {
    const cfg = TIPO_CONFIG[tipo] || TIPO_CONFIG.otro;
    const item = document.createElement('div');
    item.className = "flex items-center gap-1.5 justify-between";
    item.innerHTML = `
      <div class="flex items-center gap-1.5 min-w-0">
        <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background: ${cfg.color}"></div>
        <span class="text-[10px] text-[#374151] font-semibold truncate">${cfg.label}</span>
      </div>
      <span class="text-[10px] font-bold" style="color: ${cfg.color}">${counts[tipo]}</span>
    `;
    itemsContainer.appendChild(item);
  });
}


// 7. DRAWER DE INCIDENCIAS
function openDrawer() {
  document.getElementById('drawer-incidencias').classList.remove('hidden');
  setDrawerTab('activos');
}

function closeDrawer() {
  document.getElementById('drawer-incidencias').classList.add('hidden');
}

function setDrawerTab(tabId) {
  appState.drawerTab = tabId;
  
  // Actualizar botones de pestañas
  const activeIncidents = appState.incidents.filter(i => i.estado === 'activo');
  const attendedIncidents = appState.incidents.filter(i => i.estado === 'atendido');
  
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const monthlyIncidents = appState.incidents.filter(i => new Date(i.fecha) >= oneMonthAgo);

  const tabs = [
    { id: 'activos', label: `Activas (${activeIncidents.length})` },
    { id: 'atendidos', label: `Atendidas (${attendedIncidents.length})` },
    { id: 'historial', label: `Último mes (${monthlyIncidents.length})` }
  ];

  tabs.forEach(t => {
    const btn = document.getElementById(`drawer-tab-${t.id}`);
    btn.textContent = t.label;
    if (t.id === tabId) {
      btn.className = "flex-1 py-2 rounded-xl text-xs font-semibold bg-[#0d2b5e] text-white transition-all shadow-sm";
    } else {
      btn.className = "flex-1 py-2 rounded-xl text-xs font-semibold bg-[#e8edf5] text-[#64748b] transition-all";
    }
  });

  renderDrawerIncidents(tabId, activeIncidents, attendedIncidents, monthlyIncidents);
}

function renderDrawerIncidents(tabId, activeList, attendedList, monthlyList) {
  const container = document.getElementById('drawer-incidents-list');
  container.innerHTML = "";

  let listToRender = [];
  if (tabId === 'activos') listToRender = activeList;
  else if (tabId === 'atendidos') listToRender = attendedList;
  else listToRender = monthlyList;

  if (listToRender.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center py-10">
        <i data-lucide="check-circle" class="w-10 h-10 mb-2 text-green-300"></i>
        <p class="text-sm font-semibold text-[#64748b]">Sin incidencias</p>
      </div>`;
    lucide.createIcons();
    return;
  }

  listToRender.forEach(inc => {
    const cfg = TIPO_CONFIG[inc.tipo] || TIPO_CONFIG.otro;
    const div = document.createElement('div');
    div.className = "flex gap-3 bg-white rounded-2xl p-3 border border-black/10 shadow-sm active:bg-[#f0f4f8] transition-colors cursor-pointer";
    
    // Al hacer click, cerrar drawer y centrar mapa en el marcador
    div.onclick = () => {
      closeDrawer();
      if (mapInstance) {
        mapInstance.setView([inc.lat, inc.lng], 17);
        // Buscar y abrir popup de la incidencia
        mapMarkers.forEach(m => {
          if (m.getLatLng().lat === inc.lat && m.getLatLng().lng === inc.lng) {
            m.openPopup();
          }
        });
      }
    };

    let mediaElement = `<div class="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 text-xl" style="background: ${cfg.bg}">${cfg.emoji}</div>`;
    if (inc.imagen) {
      mediaElement = `<img src="${inc.imagen}" alt="Thumbnail" class="w-14 h-14 rounded-xl object-cover flex-shrink-0" />`;
    }

    const statusBadge = inc.estado === 'activo'
      ? `<span class="text-[10px] font-bold text-[#c8102e]">● ACTIVO</span>`
      : `<span class="text-[10px] font-bold text-[#16a34a]">✓ Atendido</span>`;

    div.innerHTML = `
      ${mediaElement}
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-1">
          <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style="background: ${cfg.bg}; color: ${cfg.color}">
            ${cfg.label}
          </span>
          ${statusBadge}
        </div>
        <div class="flex items-center gap-1 mt-1 text-[#64748b]">
          <i data-lucide="map-pin" class="w-3 h-3 flex-shrink-0"></i>
          <p class="text-xs truncate font-medium">${inc.direccion}</p>
        </div>
        <div class="flex items-center gap-1 mt-0.5 text-[#64748b]">
          <i data-lucide="clock" class="w-3 h-3 flex-shrink-0"></i>
          <p class="text-xs font-medium">${formatLocalTime(inc.fecha)}</p>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
  lucide.createIcons();
}


// 8. MODAL DE REPORTE: FORMULARIO
function openReportModal() {
  document.getElementById('modal-reporte').classList.remove('hidden');
  
  // Limpiar campos formulario
  reportFormData = {
    tipo: "",
    descripcion: "",
    imagen: null,
    audioBlob: null,
    audioUrl: null,
    audioSecs: 0,
    lat: null,
    lng: null,
    direccion: ""
  };

  document.getElementById('report-description').value = "";
  document.getElementById('report-error').classList.add('hidden');
  removeImageSelected();
  deleteAudioRecorded();
  
  renderReportTypeGrid();
  fetchGPSLocation();
}

function closeReportModal() {
  // Parar grabación de audio si está en progreso
  if (recording) {
    stopAudioRecording();
  }
  // Parar reproducción
  if (isAudioPlaying && audioPlaybackObject) {
    audioPlaybackObject.pause();
    isAudioPlaying = false;
  }
  document.getElementById('modal-reporte').classList.add('hidden');
}

function renderReportTypeGrid() {
  const grid = document.getElementById('report-type-grid');
  grid.innerHTML = "";

  TIPOS_INCIDENTE.forEach(t => {
    const btn = document.createElement('button');
    btn.type = "button";
    btn.onclick = () => selectIncidentType(t.id);
    btn.id = `report-type-btn-${t.id}`;
    btn.className = "flex items-center gap-2 px-3 py-2.5 rounded-xl text-left border-2 border-black/10 bg-white text-[#0d1b2e] transition-all hover:bg-black/[0.02] focus:outline-none";
    btn.innerHTML = `
      <i data-lucide="${t.icon}" class="w-4 h-4 flex-shrink-0 text-[#64748b]"></i>
      <span class="text-xs font-semibold leading-tight">${t.label}</span>
    `;
    grid.appendChild(btn);
  });
  lucide.createIcons();
}

function selectIncidentType(typeId) {
  reportFormData.tipo = typeId;
  
  TIPOS_INCIDENTE.forEach(t => {
    const btn = document.getElementById(`report-type-btn-${t.id}`);
    const icon = btn.querySelector('i');
    if (t.id === typeId) {
      btn.style.borderColor = t.color;
      btn.style.backgroundColor = t.color + "12"; // 7% opacity
      btn.style.color = t.color;
      if (icon) icon.style.color = t.color;
    } else {
      btn.style.borderColor = "rgba(0, 0, 0, 0.1)";
      btn.style.backgroundColor = "white";
      btn.style.color = "#0d1b2e";
      if (icon) icon.style.color = "#64748b";
    }
  });
}

function triggerImageCapture() {
  document.getElementById('report-image-input').click();
}

function handleImageSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      // Compress image to max 800px width/height
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 800;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      // Convert to compressed base64 (JPEG 70% quality)
      reportFormData.imagen = canvas.toDataURL('image/jpeg', 0.7);
      
      // UI Preview
      document.getElementById('report-image-empty').classList.add('hidden');
      document.getElementById('report-image-preview').src = reportFormData.imagen;
      document.getElementById('report-image-preview-container').classList.remove('hidden');
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

function removeImageSelected() {
  reportFormData.imagen = null;
  document.getElementById('report-image-input').value = "";
  document.getElementById('report-image-empty').classList.remove('hidden');
  document.getElementById('report-image-preview').src = "";
  document.getElementById('report-image-preview-container').classList.add('hidden');
}

// 9. LÓGICA DE GRABACIÓN DE AUDIO (VOICE NOTE)
async function startAudioRecording() {
  if (recording) return;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      reportFormData.audioBlob = blob;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        reportFormData.audioUrl = e.target.result; // base64
        
        // Mostrar UI de grabado
        document.getElementById('audio-state-recording').classList.add('hidden');
        document.getElementById('audio-state-recorded').classList.remove('hidden');
        document.getElementById('audio-duration-info').textContent = `${reportFormData.audioSecs} segundos`;
      };
      reader.readAsDataURL(blob);

      // Apagar pistas del micrófono
      stream.getTracks().forEach(track => track.stop());
    };

    mediaRecorder.start();
    recording = true;
    reportFormData.audioSecs = 0;

    // Cambiar a UI de grabando
    document.getElementById('audio-state-idle').classList.add('hidden');
    document.getElementById('audio-state-recording').classList.remove('hidden');
    updateAudioTimerUI();

    audioTimerInterval = setInterval(() => {
      reportFormData.audioSecs++;
      if (reportFormData.audioSecs >= MAX_AUDIO_SECS) {
        stopAudioRecording();
      } else {
        updateAudioTimerUI();
      }
    }, 1000);

  } catch (err) {
    console.error("Error al acceder al micrófono:", err);
    alert("No se pudo acceder al micrófono para la nota de voz. Verifique sus permisos.");
  }
}

function stopAudioRecording() {
  if (!recording || !mediaRecorder) return;
  
  mediaRecorder.stop();
  recording = false;
  clearInterval(audioTimerInterval);
}

function updateAudioTimerUI() {
  const left = MAX_AUDIO_SECS - reportFormData.audioSecs;
  document.getElementById('audio-timer').textContent = `${left}s restantes`;
  
  const pct = (reportFormData.audioSecs / MAX_AUDIO_SECS) * 100;
  document.getElementById('audio-progress-bar').style.width = `${pct}%`;
  
  if (left <= 10) {
    document.getElementById('audio-timer').style.color = '#c8102e';
    document.getElementById('audio-progress-bar').style.backgroundColor = '#c8102e';
  } else {
    document.getElementById('audio-timer').style.color = '#0d1b2e';
    document.getElementById('audio-progress-bar').style.backgroundColor = '#0d2b5e';
  }
}

function deleteAudioRecorded() {
  reportFormData.audioBlob = null;
  reportFormData.audioUrl = null;
  reportFormData.audioSecs = 0;
  
  if (audioPlaybackObject) {
    audioPlaybackObject.pause();
    audioPlaybackObject = null;
  }
  isAudioPlaying = false;
  
  document.getElementById('audio-state-recorded').classList.add('hidden');
  document.getElementById('audio-state-recording').classList.add('hidden');
  document.getElementById('audio-state-idle').classList.remove('hidden');
}

function toggleAudioPlayback() {
  if (!reportFormData.audioUrl) return;

  const playIcon = document.getElementById('audio-play-icon');

  if (isAudioPlaying && audioPlaybackObject) {
    audioPlaybackObject.pause();
    isAudioPlaying = false;
    playIcon.setAttribute('data-lucide', 'play');
  } else {
    audioPlaybackObject = new Audio(reportFormData.audioUrl);
    audioPlaybackObject.onended = () => {
      isAudioPlaying = false;
      playIcon.setAttribute('data-lucide', 'play');
      lucide.createIcons();
    };
    audioPlaybackObject.play();
    isAudioPlaying = true;
    playIcon.setAttribute('data-lucide', 'pause');
  }
  lucide.createIcons();
}

// 10. GEOLOCALIZACIÓN AUTOMÁTICA EN MODAL
function fetchGPSLocation() {
  const statusBox = document.getElementById('gps-status-box');
  const loader = document.getElementById('gps-loader');
  const successIcon = document.getElementById('gps-success-icon');
  const title = document.getElementById('gps-status-title');
  const coordsLabel = document.getElementById('gps-status-coords');

  loader.classList.remove('hidden');
  successIcon.classList.add('hidden');
  title.textContent = "Obteniendo GPS...";
  title.style.color = "#64748b";
  coordsLabel.textContent = "Esperando coordenadas precisas";
  statusBox.style.backgroundColor = "#e8edf5";
  statusBox.style.borderColor = "rgba(0,0,0,0.1)";

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        reportFormData.lat = lat;
        reportFormData.lng = lng;
        
        try {
          title.textContent = "Buscando dirección...";
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          reportFormData.direccion = data.address.road || data.display_name.split(',')[0] || `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
        } catch(e) {
          reportFormData.direccion = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
        }

        loader.classList.add('hidden');
        successIcon.classList.remove('hidden');
        title.textContent = "Ubicación capturada automáticamente";
        title.style.color = "#15803d";
        coordsLabel.textContent = reportFormData.direccion;
        statusBox.style.backgroundColor = "#f0fff4";
        statusBox.style.borderColor = "#86efac";
      },
      (err) => {
        console.warn("Fallo GPS obligatorio:", err);
        reportFormData.lat = null;
        reportFormData.lng = null;
        reportFormData.direccion = "";

        loader.classList.add('hidden');
        successIcon.classList.add('hidden');
        title.textContent = "⚠️ GPS Desactivado / Sin Permisos";
        title.style.color = "#c8102e";
        coordsLabel.textContent = "Por favor, activa el GPS y da permisos. Toca aquí para reintentar.";
        statusBox.style.backgroundColor = "#fff0f2";
        statusBox.style.borderColor = "#fcd0d7";
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  } else {
    reportFormData.lat = null;
    reportFormData.lng = null;
    reportFormData.direccion = "";

    loader.classList.add('hidden');
    successIcon.classList.add('hidden');
    title.textContent = "⚠️ GPS No Soportado";
    title.style.color = "#c8102e";
    coordsLabel.textContent = "Tu navegador no soporta geolocalización. El reporte requiere GPS.";
    statusBox.style.backgroundColor = "#fff0f2";
    statusBox.style.borderColor = "#fcd0d7";
  }
}

// 11. ENVIAR REPORTE
async function submitReportForm() {
  const errorBox = document.getElementById('report-error');
  errorBox.classList.add('hidden');
  
  const submitBtn = document.querySelector('button[onclick="submitReportForm()"]');
  const originalBtnContent = submitBtn.innerHTML;

  if (!reportFormData.tipo) {
    errorBox.textContent = "Selecciona el tipo de incidente.";
    errorBox.classList.remove('hidden');
    return;
  }

  if (!reportFormData.imagen) {
    errorBox.textContent = "La foto de la incidencia es obligatoria.";
    errorBox.classList.remove('hidden');
    return;
  }

  if (!reportFormData.lat || !reportFormData.lng) {
    errorBox.textContent = "Para enviar un reporte es obligatorio activar el GPS de tu dispositivo y conceder permisos de ubicación.";
    errorBox.classList.remove('hidden');
    return;
  }

  const desc = document.getElementById('report-description').value.trim();
  const now = new Date();
  const horaText = `Hoy, ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  const userDniMasked = appState.currentUser ? `${appState.currentUser.dni.slice(0, 4)}****` : "7234****";
  const userNombre = appState.currentUser ? appState.currentUser.nombre : "Ciudadano";

  const payload = {
    usuario_dni: appState.currentUser ? appState.currentUser.dni : "12345678",
    tipo: reportFormData.tipo,
    descripcion: desc,
    latitud: reportFormData.lat,
    longitud: reportFormData.lng,
    direccion: reportFormData.direccion,
    foto_base64: reportFormData.imagen,
    audio_base64: reportFormData.audioUrl || ""
  };

  submitBtn.disabled = true;
  submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
  submitBtn.innerHTML = `<i data-lucide="loader" class="w-5 h-5 animate-spin"></i> Enviando...`;
  lucide.createIcons();

  try {
    const res = await fetch('api/incidentes.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    
    if (data.success) {
      // Recargar datos desde BD
      await initAppState();
      
      // Actualizar UI del mapa, leyenda, drawer e historial
      updateMapMarkers();
      updateLegend();
      renderHistory();

      // Cerrar y mostrar Toast
      closeReportModal();
      showToast("✅ Reporte enviado exitosamente");

      // Centrar mapa
      if (mapInstance) {
        mapInstance.setView([payload.latitud, payload.longitud], 16);
      }
    } else {
      errorBox.textContent = data.message || "Error al enviar el reporte a la base de datos.";
      errorBox.classList.remove('hidden');
    }
  } catch(e) {
    errorBox.textContent = "Error de conexión al servidor.";
    errorBox.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
    submitBtn.innerHTML = originalBtnContent;
  }
}


// 12. HISTORIAL / MIS REPORTES
function renderHistory() {
  const container = document.getElementById('history-list');
  const summaryLabel = document.getElementById('history-user-info');
  container.innerHTML = "";

  const dniText = appState.currentUser ? appState.currentUser.dni : "-";
  const count = appState.myIncidents.length;
  summaryLabel.textContent = `DNI: ${dniText} · ${count} reporte${count !== 1 ? 's' : ''} enviado${count !== 1 ? 's' : ''}`;

  if (count === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-16">
        <div class="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-[#e8edf5]">
          <i data-lucide="clock" class="w-8 h-8 text-[#64748b]"></i>
        </div>
        <p class="font-bold text-center text-[#0d1b2e]">Sin reportes aún</p>
        <p class="text-sm text-center mt-1 text-[#64748b] px-4 font-medium">
          Tus reportes de incidencias aparecerán aquí
        </p>
      </div>`;
    lucide.createIcons();
    return;
  }

  appState.myIncidents.forEach((inc, index) => {
    const cfg = TIPO_CONFIG[inc.tipo] || TIPO_CONFIG.otro;
    const itemNum = count - index;
    const card = document.createElement('div');
    card.className = "bg-white rounded-2xl overflow-hidden shadow-sm border border-black/10";
    
    let mediaHtml = `<div class="w-20 h-20 rounded-xl flex items-center justify-center flex-shrink-0 bg-${cfg.bg}" style="background: ${cfg.bg}">
                      <i data-lucide="${getIconNameForType(inc.tipo)}" class="w-8 h-8" style="color: ${cfg.color}"></i>
                     </div>`;
    if (inc.imagen) {
      mediaHtml = `<img src="${inc.imagen}" alt="Evidencia" class="w-20 h-20 rounded-xl object-cover flex-shrink-0" />`;
    }

    const estadoBadge = inc.estado === 'activo'
      ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fff0f2] text-[#c8102e]">EN PROCESO</span>`
      : `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#f0fff4] text-[#16a34a]">ATENDIDO</span>`;

    card.innerHTML = `
      <div class="px-4 pt-3 pb-2.5 flex items-center justify-between border-b border-black/10">
        <span class="text-xs font-bold text-[#64748b]">
          Reporte #${itemNum}
        </span>
        ${estadoBadge}
      </div>
      <div class="p-4">
        <div class="flex gap-3.5">
          ${mediaHtml}
          <div class="flex-1 min-w-0">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background: ${cfg.bg}; color: ${cfg.color}">
              ${cfg.label}
            </span>
            ${inc.descripcion ? `<p class="text-sm mt-2 font-medium text-[#0d1b2e] leading-snug line-clamp-2">${inc.descripcion}</p>` : ""}
            
            ${inc.audio ? `
              <button onclick="playSavedAudio('${inc.audio}')" class="mt-2.5 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#f0fff4] border border-[#bbf7d0] active:scale-95 transition-all text-left">
                <i data-lucide="play" class="w-3.5 h-3.5 text-[#15803d]"></i>
                <span class="text-[10px] font-bold text-[#15803d]">Reproducir audio</span>
              </button>
            ` : ""}

            <div class="flex items-center gap-1 mt-2.5 text-[#64748b]">
              <i data-lucide="map-pin" class="w-3 h-3 flex-shrink-0"></i>
              <p class="text-xs truncate font-medium">${inc.direccion}</p>
            </div>
            <div class="flex items-center gap-1 mt-1 text-[#64748b]">
              <i data-lucide="clock" class="w-3 h-3 flex-shrink-0"></i>
              <p class="text-xs font-medium">${formatLocalTime(inc.fecha)}</p>
            </div>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
  lucide.createIcons();
}

// Helper para obtener icono lucide según tipo
function getIconNameForType(tipo) {
  const mapping = {
    robo: "shield-alert",
    accidente: "car",
    sospechosos: "users",
    violencia: "alert-triangle",
    alcohol: "zap",
    abandono: "package",
  };
  return mapping[tipo] || "alert-triangle";
}

function playSavedAudio(base64Audio) {
  if (audioPlaybackObject) {
    audioPlaybackObject.pause();
  }
  audioPlaybackObject = new Audio(base64Audio);
  audioPlaybackObject.play().catch(e => console.error("Error al reproducir audio de historial:", e));
}


// 13. DIRECTORIO DE EMERGENCIAS
async function renderEmergencies() {
  const container = document.getElementById('emergencies-container');
  container.innerHTML = "<p class='text-center py-4 text-gray-500'>Cargando emergencias...</p>";

  let list = [];
  try {
    const res = await fetch('api/emergencias.php');
    const json = await res.json();
    if (json.success) list = json.data;
  } catch(e) {
    console.error("Error al cargar emergencias", e);
  }
  container.innerHTML = "";

  // Configuración visual por categoría
  const CAT_THEMES = {
    Seguridad: { color: "#0d2b5e", bg: "#e8edf5", icon: "shield" },
    Salud: { color: "#dc2626", bg: "#fef2f2", icon: "heart" },
    Bomberos: { color: "#e07b00", bg: "#fff7ed", icon: "flame" },
    Otros: { color: "#0369a1", bg: "#f0f9ff", icon: "alert-circle" },
  };

  // Agrupar por categoría
  const grouped = {};
  list.forEach(item => {
    if (!grouped[item.categoria]) {
      grouped[item.categoria] = [];
    }
    grouped[item.categoria].push(item);
  });

  // Renderizar grupos
  Object.keys(grouped).forEach(catName => {
    const theme = CAT_THEMES[catName] || CAT_THEMES.Otros;
    const section = document.createElement('section');
    
    section.innerHTML = `
      <div class="flex items-center gap-2 mb-3">
        <div class="w-3 h-3 rounded-full" style="background: ${theme.color}"></div>
        <h3 class="text-sm font-bold text-[#0d1b2e]">${catName}</h3>
      </div>
      <div class="space-y-2" id="srv-list-${catName}"></div>
    `;
    container.appendChild(section);

    const srvList = document.getElementById(`srv-list-${catName}`);
    
    grouped[catName].forEach(srv => {
      const btn = document.createElement('button');
      btn.onclick = () => window.location.href = `tel:${srv.telefono.replace(/[^0-9+]/g, "")}`;
      btn.className = "w-full bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3.5 text-left active:scale-[0.98] transition-transform shadow-sm border border-black/10";
      
      const iconName = srv.icon || theme.icon;

      btn.innerHTML = `
        <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background: ${theme.bg}">
          <i data-lucide="${iconName}" class="w-5 h-5" style="color: ${theme.color}"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold truncate text-[#0d1b2e]">${srv.nombre}</p>
          <p class="text-xs truncate text-[#64748b] font-medium mt-0.5">${srv.descripcion || ""}</p>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <span class="text-base font-bold font-display" style="color: ${theme.color}">
            ${srv.telefono}
          </span>
          <i data-lucide="phone" class="w-4 h-4" style="color: ${theme.color}"></i>
        </div>
      `;
      srvList.appendChild(btn);
    });
  });
  lucide.createIcons();
}


// 14. SISTEMA DE TOAST
let toastTimeout = null;

function showToast(message) {
  const container = document.getElementById('toast-container');
  const label = document.getElementById('toast-message');

  label.textContent = message;
  container.classList.remove('hidden');

  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  toastTimeout = setTimeout(() => {
    container.classList.add('hidden');
    toastTimeout = null;
  }, 3500);
}


let appPollingInterval = null;
let lastAppHash = "";

function startAppPolling() {
  if (appPollingInterval) clearInterval(appPollingInterval);
  appPollingInterval = setInterval(async () => {
    try {
      const citizenParam = appState.currentUser ? '?citizen_dni=' + appState.currentUser.dni : '';
      const res = await fetch('api/incidentes.php' + citizenParam);
      const json = await res.json();
      if (json.success) {
        const currentHash = json.data.map(i => `${i.id}-${i.estado}`).join('|');
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
