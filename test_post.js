const data = {
  usuario_dni: "72345678",
  tipo: "Robo",
  descripcion: "Test",
  latitud: -18.0,
  longitud: -70.0,
  direccion: "Zona X",
  foto_base64: "",
  audio_base64: ""
};

fetch('http://127.0.0.1:8000/api/incidentes.php', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
})
.then(r => r.json())
.then(d => console.log(d))
.catch(e => console.error(e));
