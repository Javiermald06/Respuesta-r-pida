<?php
require_once 'conexion.php';

$sql = "ALTER TABLE incidentes ADD COLUMN direccion VARCHAR(255) DEFAULT 'Ubicación reportada'";
if ($conn->query($sql)) {
    echo "Column 'direccion' added successfully.\n";
} else {
    echo "Error or column already exists: " . $conn->error . "\n";
}
$conn->close();
