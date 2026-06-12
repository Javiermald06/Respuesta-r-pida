const fs = require('fs');

let js = fs.readFileSync('admin.js', 'utf8');

// Remove DEFAULT_USERS
js = js.replace(/const DEFAULT_USERS = \[[\s\S]*?\];\n/, '');

// Replace initDatabase to load from PHP API
const newInit = `async function initDatabase() {
  try {
    // Fetch users
    let res = await fetch('api/usuarios.php');
    let json = await res.json();
    if(json.success) adminState.registeredUsers = json.data;

    // Fetch incidents
    res = await fetch('api/incidentes.php');
    json = await res.json();
    if(json.success) {
      adminState.incidents = json.data.map(i => ({
        id: i.id,
        tipo: i.tipo,
        descripcion: i.descripcion,
        imagen: i.foto_base64,
        audio: i.audio_base64,
        lat: parseFloat(i.latitud),
        lng: parseFloat(i.longitud),
        direccion: "Ubicación",
        estado: i.estado,
        autor: i.autor_nombre,
        fecha: i.fecha_reporte
      }));
    }

    // Fetch emergencies
    res = await fetch('api/emergencias.php');
    json = await res.json();
    if(json.success) adminState.emergencies = json.data;
  } catch(e) {
    console.error("Error cargando base de datos PHP", e);
  }
}`;

js = js.replace(/function initDatabase\(\) \{[\s\S]*?\}\n\s*function calculateStats/, newInit + '\n\nfunction calculateStats');

// Now, replace saveUser (which registers a user from admin panel)
const newSaveUser = `async function saveUser(e) {
  e.preventDefault();
  const dni = document.getElementById('new-user-dni').value.trim();
  const nombre = document.getElementById('new-user-nombre').value.trim();
  const telefono = document.getElementById('new-user-telefono').value.trim();
  const password = document.getElementById('new-user-password').value;

  if (dni.length !== 8) return alert('El DNI debe tener 8 dígitos');
  if (!nombre || !password) return alert('Nombre y contraseña son obligatorios');

  try {
    const res = await fetch('api/usuarios.php?action=register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni, nombre, telefono, password })
    });
    const data = await res.json();
    if (data.success) {
      alert('Usuario registrado exitosamente');
      document.getElementById('form-add-user').reset();
      await initDatabase();
      renderUsersTable();
      calculateStats();
    } else {
      alert(data.message);
    }
  } catch(e) {
    alert("Error de red");
  }
}`;
js = js.replace(/function saveUser\(e\) \{[\s\S]*?\}\n\s*function toggleUserStatus/, newSaveUser + '\n\nfunction toggleUserStatus');

fs.writeFileSync('admin.js', js);
console.log('admin.js refactored partially');
