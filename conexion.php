<?php
/**
 * ARCHIVO DE CONEXIÓN A LA BASE DE DATOS
 * Este archivo establece la conexión entre la aplicación y tu base de datos MySQL.
 * Configura los datos de acuerdo a tu servidor (ej: XAMPP, WAMP, Hosting).
 */

require_once 'config.php';

// Inicializar conexión con soporte SSL (Obligatorio para Aiven)
$conn = mysqli_init();
mysqli_ssl_set($conn, NULL, NULL, NULL, NULL, NULL); // Ignorar verificación estricta de CA por ahora
mysqli_real_connect($conn, $host, $user, $password, $dbname, $port, NULL, MYSQLI_CLIENT_SSL);

// Verificar conexión
if ($conn->connect_error) {
    die("Error de conexión: " . $conn->connect_error);
}

// Establecer el conjunto de caracteres a UTF-8 para soportar tildes y eñes
$conn->set_charset("utf8mb4");

// Opcional: Mensaje de prueba (eliminar o comentar en producción)
// echo "Conectado exitosamente a la base de datos";
