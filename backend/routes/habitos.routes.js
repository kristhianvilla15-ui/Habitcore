// backend/routes/habitos.routes.js
const express = require('express');
const router = express.Router();
const habitosController = require('../controllers/habitos.controller');
const verificarToken = require('../middleware/auth');

router.use(verificarToken);

// rutas específicas primero
router.get('/', habitosController.getHabitos);
router.get('/categorias', habitosController.getCategorias);
router.get('/estadisticas', habitosController.getEstadisticas);
router.post('/registros', habitosController.completarHabito);

// creación/editar/eliminar
router.post('/registros', habitosController.completarHabito);
router.post('/', habitosController.crearHabito);
router.get('/:id', habitosController.getHabitoById);
router.put('/:id', habitosController.actualizarHabito);
router.delete('/:id', habitosController.eliminarHabito);

module.exports = router;