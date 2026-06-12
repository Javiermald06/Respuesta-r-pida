<?php
header('Content-Type: application/json');
require_once '../conexion.php';

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

if ($method === 'GET') {
    // Listar usuarios (para admin)
    $sql = "SELECT id, dni, nombre, telefono, estado, fecha_registro FROM usuarios";
    $result = $conn->query($sql);
    $usuarios = [];
    while($row = $result->fetch_assoc()) {
        $usuarios[] = $row;
    }
    echo json_encode(["success" => true, "data" => $usuarios]);
} elseif ($method === 'POST') {
    $action = $_GET['action'] ?? '';
    
    if ($action === 'login') {
        $dni = $conn->real_escape_string($input['dni']);
        $password = $conn->real_escape_string($input['password']);
        
        $sql = "SELECT id, dni, nombre, telefono, estado FROM usuarios WHERE dni = '$dni' AND password = '$password'";
        $result = $conn->query($sql);
        
        if ($result->num_rows > 0) {
            $user = $result->fetch_assoc();
            if ($user['estado'] === 'bloqueado') {
                echo json_encode(["success" => false, "message" => "Tu cuenta ha sido bloqueada. Contacta al administrador."]);
            } else {
                echo json_encode(["success" => true, "data" => $user]);
            }
        } else {
            echo json_encode(["success" => false, "message" => "DNI o contraseña incorrectos."]);
        }
    } elseif ($action === 'register') {
        $dni = $conn->real_escape_string($input['dni']);
        $nombre = $conn->real_escape_string($input['nombre']);
        $telefono = $conn->real_escape_string($input['telefono'] ?? '');
        $password = $conn->real_escape_string($input['password']);
        
        // Verificar si ya existe
        $check = $conn->query("SELECT id FROM usuarios WHERE dni = '$dni'");
        if ($check->num_rows > 0) {
            echo json_encode(["success" => false, "message" => "El DNI ya está registrado en el sistema."]);
            exit;
        }
        
        $sql = "INSERT INTO usuarios (dni, nombre, telefono, password) VALUES ('$dni', '$nombre', '$telefono', '$password')";
        if ($conn->query($sql)) {
            echo json_encode(["success" => true, "message" => "Usuario registrado correctamente."]);
        } else {
            echo json_encode(["success" => false, "message" => "Error de base de datos al registrar: ".$conn->error]);
        }
    }
} elseif ($method === 'PUT') {
    // Editar usuario (bloquear/desbloquear)
    $dni = $conn->real_escape_string($input['dni']);
    $estado = $conn->real_escape_string($input['estado']);
    $sql = "UPDATE usuarios SET estado = '$estado' WHERE dni = '$dni'";
    if ($conn->query($sql)) {
        echo json_encode(["success" => true]);
    } else {
        echo json_encode(["success" => false, "message" => "Error al actualizar el estado."]);
    }
} elseif ($method === 'DELETE') {
    $dni = $conn->real_escape_string($_GET['dni']);
    $sql = "DELETE FROM usuarios WHERE dni = '$dni'";
    if ($conn->query($sql)) {
        echo json_encode(["success" => true]);
    } else {
        echo json_encode(["success" => false, "message" => "Error al eliminar usuario."]);
    }
}
$conn->close();
