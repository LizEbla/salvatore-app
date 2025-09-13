const express = require('express');
const router = express.Router();
const pacienteController = require('../controllers/paciente.controller');

// Rutas específicas PRIMERO
router.get('/buscar', pacienteController.buscarConFiltros);
router.get('/debug-fecha', pacienteController.debugPacientesPorFecha);
router.get('/verificar-existencia', pacienteController.verificarExistencia);

// Rutas con parámetros DESPUÉS
router.get('/:id', pacienteController.obtenerPacientePorId);
router.get('/', pacienteController.obtenerPacientes);
router.post('/', pacienteController.crearPaciente);
router.put('/:id', pacienteController.actualizarPaciente);
router.delete('/:id', pacienteController.eliminarPaciente);

module.exports = router;