<?php
header('Content-Type: application/json');
require_once '../conexion.php';

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

if ($method === 'GET') {
    $sql = "SELECT * FROM emergencias";
    $result = $conn->query($sql);
    $emergencias = [];
    while($row = $result->fetch_assoc()) {
        $emergencias[] = $row;
    }
    echo json_encode(["success" => true, "data" => $emergencias]);

} elseif ($method === 'POST') {
    $categoria = $conn->real_escape_string($input['categoria']);
    $nombre = $conn->real_escape_string($input['nombre']);
    $telefono = $conn->real_escape_string($input['telefono']);
    $descripcion = $conn->real_escape_string($input['descripcion']);
    
    $sql = "INSERT INTO emergencias (categoria, nombre, telefono, descripcion) VALUES ('$categoria', '$nombre', '$telefono', '$descripcion')";
    if ($conn->query($sql)) {
        $input['id'] = $conn->insert_id;
        echo json_encode(["success" => true, "data" => $input]);
    } else {
        echo json_encode(["success" => false, "message" => "Error al guardar contacto de emergencia."]);
    }
} elseif ($method === 'PUT') {
    $id = (int)$input['id'];
    $categoria = $conn->real_escape_string($input['categoria']);
    $nombre = $conn->real_escape_string($input['nombre']);
    $telefono = $conn->real_escape_string($input['telefono']);
    $descripcion = $conn->real_escape_string($input['descripcion']);
    
    $sql = "UPDATE emergencias SET categoria='$categoria', nombre='$nombre', telefono='$telefono', descripcion='$descripcion' WHERE id=$id";
    if ($conn->query($sql)) {
        echo json_encode(["success" => true]);
    } else {
        echo json_encode(["success" => false, "message" => "Error al actualizar contacto."]);
    }
} elseif ($method === 'DELETE') {
    $id = (int)$_GET['id'];
    $sql = "DELETE FROM emergencias WHERE id = $id";
    if ($conn->query($sql)) {
        echo json_encode(["success" => true]);
    } else {
        echo json_encode(["success" => false, "message" => "Error al eliminar contacto."]);
    }
}
$conn->close();
