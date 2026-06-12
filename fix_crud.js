const fs = require('fs');

let adminJs = fs.readFileSync('admin.js', 'utf8');

// 1. handleAdminUserRegSubmit
const newHandleUserReg = `async function handleAdminUserRegSubmit(event) {
  event.preventDefault();
  const nombre = document.getElementById('reg-name').value.trim();
  const dni = document.getElementById('reg-dni').value.trim();
  const telefono = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-pass').value;
  const errorBox = document.getElementById('reg-error');

  errorBox.classList.add('hidden');
  if (dni.length !== 8) {
    errorBox.textContent = "El DNI debe tener 8 dígitos.";
    errorBox.classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch('api/usuarios.php?action=register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dni, nombre, telefono, password })
    });
    const json = await res.json();
    if (json.success) {
      document.getElementById('reg-name').value = "";
      document.getElementById('reg-dni').value = "";
      document.getElementById('reg-phone').value = "";
      document.getElementById('reg-pass').value = "";
      await loadAdminState();
      calculateStats();
      renderAdminUsers();
      showAdminToast("✅ Ciudadano registrado exitosamente");
    } else {
      errorBox.textContent = json.message || "Error al registrar.";
      errorBox.classList.remove('hidden');
    }
  } catch(e) {
    errorBox.textContent = "Error de conexión.";
    errorBox.classList.remove('hidden');
  }
}`;

adminJs = adminJs.replace(/function handleAdminUserRegSubmit[\s\S]*?showAdminToast\("✅ Ciudadano registrado exitosamente"\);\n\}/m, newHandleUserReg);


// 2. toggleAdminUserBlock
const newToggleBlock = `async function toggleAdminUserBlock(dni) {
  await loadAdminState();
  const user = adminState.registeredUsers.find(u => u.dni === dni);
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
}`;

adminJs = adminJs.replace(/function toggleAdminUserBlock[\s\S]*?\}\n\}/m, newToggleBlock);


// 3. deleteAdminUser
const newDeleteUser = `async function deleteAdminUser(dni) {
  if (!confirm("¿Está seguro de eliminar a este ciudadano de los registros?")) return;
  try {
    const res = await fetch('api/usuarios.php?dni=' + dni, { method: 'DELETE' });
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
}`;

adminJs = adminJs.replace(/function deleteAdminUser[\s\S]*?\}\n\}/m, newDeleteUser);


// 4. handleAdminEmergencySubmit
const newHandleEmer = `async function handleAdminEmergencySubmit(event) {
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
}`;

adminJs = adminJs.replace(/function handleAdminEmergencySubmit[\s\S]*?renderAdminEmergencies\(\);\n\}/m, newHandleEmer);


// 5. deleteAdminEmergency
const newDeleteEmer = `async function deleteAdminEmergency(idx) {
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
}`;

adminJs = adminJs.replace(/function deleteAdminEmergency[\s\S]*?showAdminToast\("🗑️ Contacto eliminado"\);\n\}/m, newDeleteEmer);

fs.writeFileSync('admin.js', adminJs);
console.log('CRUD API bindings fully injected.');
