const data = {
  usuario_dni: "72345678",
  tipo: "Robo",
  descripcion: "Test large payload",
  latitud: -18.0,
  longitud: -70.0,
  direccion: "Zona X",
  foto_base64: "data:image/jpeg;base64," + "A".repeat(1024 * 1024 * 2), // 2MB string
  audio_base64: ""
};

fetch('http://127.0.0.1:8000/api/incidentes.php', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
.then(r => r.text())
.then(t => console.log(t))
.catch(e => console.error(e));
