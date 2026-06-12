<?php
header('Content-Type: application/json');
require_once '../conexion.php';

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

if ($method === 'GET') {
    // Parámetros de seguridad y privacidad
    $isAdmin = isset($_GET['admin']) && $_GET['admin'] === 'true';
    $citizen_dni = isset($_GET['citizen_dni']) ? $conn->real_escape_string($_GET['citizen_dni']) : null;
    $filter_dni = isset($_GET['dni']) ? $conn->real_escape_string($_GET['dni']) : null;
    
    $sql = "SELECT i.*, u.nombre as autor_nombre FROM incidentes i JOIN usuarios u ON i.usuario_dni = u.dni";
    if ($filter_dni) {
        $sql .= " WHERE i.usuario_dni = '$filter_dni'";
    }
    $sql .= " ORDER BY i.fecha_reporte DESC";
    
    $result = $conn->query($sql);
    $incidentes = [];
    while($row = $result->fetch_assoc()) {
        // LÓGICA DE PRIVACIDAD
        if (!$isAdmin && $row['usuario_dni'] !== $citizen_dni) {
            // Ofuscar coordenadas para otros ciudadanos (+/- ~50 metros)
            $lat_offset = (mt_rand(-500, 500) / 1000000);
            $lng_offset = (mt_rand(-500, 500) / 1000000);
            $row['latitud'] = (float)$row['latitud'] + $lat_offset;
            $row['longitud'] = (float)$row['longitud'] + $lng_offset;
            
            // Ocultar dirección exacta
            if (!empty($row['direccion']) && strpos($row['direccion'], 'Zona cercana a') === false) {
                $row['direccion'] = 'Zona cercana a: ' . $row['direccion'];
            }
        }
        $incidentes[] = $row;
    }
    echo json_encode(["success" => true, "data" => $incidentes]);

} elseif ($method === 'POST') {
    $usuario_dni = $conn->real_escape_string($input['usuario_dni']);
    $tipo = $conn->real_escape_string($input['tipo']);
    $descripcion = $conn->real_escape_string($input['descripcion']);
    $latitud = (float)$input['latitud'];
    $longitud = (float)$input['longitud'];
    $foto_base64 = $conn->real_escape_string($input['foto_base64'] ?? '');
    $audio_base64 = $conn->real_escape_string($input['audio_base64'] ?? '');
    $direccion = $conn->real_escape_string($input['direccion'] ?? 'Ubicación reportada');
    
    $sql = "INSERT INTO incidentes (usuario_dni, tipo, descripcion, latitud, longitud, foto_base64, audio_base64, direccion) 
            VALUES ('$usuario_dni', '$tipo', '$descripcion', $latitud, $longitud, '$foto_base64', '$audio_base64', '$direccion')";
            
    if ($conn->query($sql)) {
        echo json_encode(["success" => true, "id" => $conn->insert_id]);
    } else {
        echo json_encode(["success" => false, "message" => "Error al guardar reporte: ".$conn->error]);
    }
} elseif ($method === 'PUT') {
    $id = (int)$input['id'];
    $estado = $conn->real_escape_string($input['estado']);
    
    $sql = "UPDATE incidentes SET estado = '$estado' WHERE id = $id";
    if ($conn->query($sql)) {
        echo json_encode(["success" => true]);
    } else {
        echo json_encode(["success" => false, "message" => "Error al actualizar estado del reporte."]);
    }
} elseif ($method === 'DELETE') {
    $id = (int)$_GET['id'];
    $sql = "DELETE FROM incidentes WHERE id = $id";
    if ($conn->query($sql)) {
        echo json_encode(["success" => true]);
    } else {
        echo json_encode(["success" => false, "message" => "Error al eliminar reporte."]);
    }
}
$conn->close();
