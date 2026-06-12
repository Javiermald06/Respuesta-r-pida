const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');

// 1. Remove DEFAULT_INCIDENTS
appJs = appJs.replace(/const DEFAULT_INCIDENTS = \[[\s\S]*?\];\n/, '');

// 2. Remove EMERGENCY_DATA
appJs = appJs.replace(/const EMERGENCY_DATA = \[[\s\S]*?\];\n/, '');

// 3. Update initAppState
const newInitAppState = `async function initAppState() {
  const savedUser = localStorage.getItem('alerta_user');
  if (savedUser) {
    appState.currentUser = JSON.parse(savedUser);
  }

  try {
    const res = await fetch('api/incidentes.php');
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
        direccion: "Ubicación reportada",
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
}`;

appJs = appJs.replace(/function initAppState\(\) \{[\s\S]*?\n\}\n/, newInitAppState + '\n');

// 4. Update submitReport saving logic
const newSubmitReport = `
  const newIncident = {
    usuario_dni: appState.currentUser ? appState.currentUser.dni : "00000000",
    tipo: reportFormData.tipo,
    descripcion: desc,
    latitud: reportFormData.lat,
    longitud: reportFormData.lng,
    foto_base64: reportFormData.imagen || "",
    audio_base64: reportFormData.audioUrl || ""
  };

  try {
    const res = await fetch('api/incidentes.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newIncident)
    });
    const data = await res.json();
    if (data.success) {
      // Reload incidents
      await initAppState();
      updateMapMarkers();
      updateLegend();
      renderHistory();
      closeReportModal();
      showToast("✅ Reporte enviado exitosamente");
      if (mapInstance) {
        mapInstance.setView([reportFormData.lat, reportFormData.lng], 16);
      }
    } else {
      errorBox.textContent = data.message || "Error al guardar el reporte.";
      errorBox.classList.remove('hidden');
    }
  } catch(e) {
      errorBox.textContent = "Error de conexión con el servidor.";
      errorBox.classList.remove('hidden');
  }
`;

appJs = appJs.replace(/const newIncident = \{[\s\S]*?\}\n\s*if \(mapInstance\)/, newSubmitReport + '\n  if (mapInstance)');
// We also need to add async to submitReport:
appJs = appJs.replace(/function submitReport\(\) \{/, 'async function submitReport() {');
// Actually, looking at grep, the function might be attached to an event listener. Let's make sure.

// 5. Update auth logic
const newAuthSubmit = `async function handleAuthSubmit(event) {
  event.preventDefault();
  const dni = document.getElementById('auth-dni').value.trim();
  const password = document.getElementById('auth-password').value;
  const errorBox = document.getElementById('auth-error');

  errorBox.classList.add('hidden');

  if (dni.length !== 8) {
    errorBox.textContent = "El DNI debe tener 8 dígitos";
    errorBox.classList.remove('hidden');
    return;
  }

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
    }
  } else {
    // Registro
    const nombre = document.getElementById('auth-name').value.trim();
    const telefono = document.getElementById('auth-phone').value.trim();
    const confirm = document.getElementById('auth-confirm-password').value;

    if (!nombre) {
      errorBox.textContent = "El nombre es obligatorio";
      errorBox.classList.remove('hidden');
      return;
    }
    if (password !== confirm) {
      errorBox.textContent = "Las contraseñas no coinciden";
      errorBox.classList.remove('hidden');
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
        errorBox.textContent = data.message;
        errorBox.classList.remove('hidden');
      }
    } catch(e) {
      errorBox.textContent = "Error de conexión al registrar.";
      errorBox.classList.remove('hidden');
    }
  }
}`;

appJs = appJs.replace(/function handleAuthSubmit\(event\) \{[\s\S]*?\n\}\n/, newAuthSubmit + '\n');


fs.writeFileSync('app.js', appJs);
console.log('app.js refactored partially');
