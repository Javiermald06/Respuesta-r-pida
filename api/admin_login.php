<?php
header('Content-Type: application/json');
require_once '../conexion.php';

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

if ($method === 'POST') {
    $username = $conn->real_escape_string($input['username']);
    $password = $conn->real_escape_string($input['password']);
    
    $sql = "SELECT id, username, nombre, cargo FROM administradores WHERE username = '$username' AND password = '$password'";
    $result = $conn->query($sql);
    
    if ($result->num_rows > 0) {
        $admin = $result->fetch_assoc();
        echo json_encode(["success" => true, "data" => $admin]);
    } else {
        echo json_encode(["success" => false, "message" => "Credenciales de administrador incorrectas."]);
    }
} else {
    echo json_encode(["success" => false, "message" => "Método no soportado."]);
}
$conn->close();
