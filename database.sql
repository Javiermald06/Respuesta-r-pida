-- TABLA: ADMINISTRADORES (Personal del centro de monitoreo)
CREATE TABLE administradores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    cargo VARCHAR(100) DEFAULT 'Despachador'
);

-- TABLA: USUARIOS (Ciudadanos registrados)
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    dni VARCHAR(8) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(15),
    password VARCHAR(255) NOT NULL,
    estado VARCHAR(20) DEFAULT 'activo', -- 'activo' o 'bloqueado'
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TABLA: INCIDENTES (Reportes)
CREATE TABLE incidentes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_dni VARCHAR(8) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    descripcion TEXT,
    latitud DECIMAL(10, 8) NOT NULL,
    longitud DECIMAL(11, 8) NOT NULL,
    estado VARCHAR(20) DEFAULT 'activo', -- 'activo' o 'atendido'
    foto_base64 LONGTEXT,
    audio_base64 LONGTEXT,
    fecha_reporte TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_dni) REFERENCES usuarios(dni) ON DELETE CASCADE
);

-- TABLA: CONTACTOS DE EMERGENCIA
CREATE TABLE emergencias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    categoria VARCHAR(50) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(15) NOT NULL,
    descripcion TEXT
);

-- =====================================
-- DATOS DE EJEMPLO (Mock Data)
-- =====================================

-- Insertar Administradores
INSERT INTO administradores (username, password, nombre, cargo) VALUES 
('admin', 'admin123', 'Administrador Principal', 'Jefe de Monitoreo'),
('operador1', 'operador123', 'Luis Gomez', 'Despachador Turno Mañana');

-- Insertar 10 Usuarios Ciudadanos
INSERT INTO usuarios (dni, nombre, telefono, password, estado) VALUES 
('12345678', 'Juan Pérez', '952000111', 'password', 'activo'),
('87654321', 'María Gómez', '952111222', 'password', 'activo'),
('72345678', 'María Condori Mamani', '952123456', 'password', 'activo'),
('45219876', 'Carlos Quispe Flores', '952987654', 'password', 'activo'),
('88912345', 'Ana Lope Cohaila', '952778899', 'password', 'activo'),
('75661234', 'Luis Torres Silva', '952445566', 'password', 'activo'),
('44556677', 'Carmen Rosa Tintaya', '952889900', 'password', 'bloqueado'),
('77889900', 'Jorge Luis Poma', '952334455', 'password', 'activo'),
('71223344', 'Sonia Mamani Cruz', '952667788', 'password', 'activo'),
('74556688', 'Pedro Alcántara', '952112233', 'password', 'activo');

-- Insertar 15 Incidentes de Ejemplo
INSERT INTO incidentes (usuario_dni, tipo, descripcion, latitud, longitud, estado) VALUES
('12345678', 'robo', 'Robo de celular en el paradero mercado Santa Rosa', -18.0315, -70.2480, 'activo'),
('87654321', 'alcohol', 'Grupo tomando licor en la plaza central de la junta vecinal', -18.0330, -70.2450, 'activo'),
('72345678', 'accidente', 'Choque leve entre dos mototaxis cerca al municipio', -18.0345, -70.2410, 'atendido'),
('45219876', 'sospechosos', 'Tres personas encapuchadas merodeando la avenida principal', -18.0290, -70.2505, 'activo'),
('88912345', 'violencia', 'Pelea callejera a la salida de un local nocturno', -18.0360, -70.2400, 'activo'),
('75661234', 'abandono', 'Vehículo abandonado sin placas desde hace 3 días', -18.0305, -70.2465, 'atendido'),
('77889900', 'otro', 'Incendio en basural que genera mucho humo tóxico', -18.0385, -70.2380, 'activo'),
('71223344', 'robo', 'Asalto a mano armada a una bodega en Av. La Cultura', -18.0322, -70.2433, 'activo'),
('74556688', 'alcohol', 'Sujetos bebiendo en el parque del niño, incomodando vecinos', -18.0355, -70.2421, 'atendido'),
('12345678', 'accidente', 'Motociclista derrapó por la lluvia en óvalo Cusco', -18.0285, -70.2490, 'activo'),
('87654321', 'sospechosos', 'Auto con lunas oscurecidas estacionado frente a colegio', -18.0370, -70.2444, 'activo'),
('72345678', 'violencia', 'Violencia familiar reportada en vivienda de la asociación M. Caceres', -18.0310, -70.2395, 'activo'),
('45219876', 'abandono', 'Mochila sospechosa abandonada en paradero de buses', -18.0340, -70.2477, 'activo'),
('88912345', 'otro', 'Perritos abandonados en caja cerca al canal', -18.0390, -70.2350, 'atendido'),
('75661234', 'robo', 'Robo de autopartes en horas de la madrugada', -18.0300, -70.2520, 'activo');

-- Insertar Emergencias de Ejemplo
INSERT INTO emergencias (categoria, nombre, telefono, descripcion) VALUES
('Policia', 'Central Policial', '105', 'Línea única de emergencias policiales'),
('Policia', 'Comisaría Gregorio Albarracín', '052-402030', 'Atención directa distrito'),
('Policia', 'Depincri Tacna', '052-411234', 'Departamento de Investigación Criminal'),
('Salud', 'SAMU', '106', 'Sistema de Atención Móvil de Urgencias'),
('Salud', 'Hospital Hipólito Unanue', '052-241241', 'Emergencias y hospitalización'),
('Salud', 'Centro de Salud San Francisco', '052-401122', 'Atención primaria Minsa GAL'),
('Salud', 'EsSalud Calana', '052-314151', 'Atención asegurados EsSalud'),
('Bomberos', 'Bomberos Voluntarios', '116', 'Central nacional de emergencias'),
('Bomberos', 'Compañía N° 24 Tacna', '052-411333', 'Estación central de Tacna'),
('Bomberos', 'Defensa Civil', '115', 'Reporte de desastres naturales'),
('Otros', 'Cruz Roja Peruana', '052-252551', 'Asistencia humanitaria y traslados'),
('Otros', 'Línea 100', '100', 'Atención a violencia familiar y sexual'),
('Otros', 'Serenazgo Gregorio Albarracín', '0800-15314', 'Seguridad ciudadana municipal gratuita');
