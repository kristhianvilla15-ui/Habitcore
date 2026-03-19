const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/auth');
const progresoController = require('../controllers/progresoController');

// Ruta protegida: obtener progreso
router.get('/', verificarToken, progresoController.obtenerProgreso);

module.exports = router;