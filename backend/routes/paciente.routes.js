const express = require('express');
const router = express.Router();
const pacienteController = require('../controllers/paciente.controller');

// Asegúrate de que TODAS estas funciones estén exportadas en paciente.controller.js
router.get('/verificar-existencia', pacienteController.verificarExistencia);
router.get('/:id', pacienteController.obtenerPacientePorId);
router.get('/', pacienteController.obtenerPacientes);
router.post('/', pacienteController.crearPaciente);
router.put('/:id', pacienteController.actualizarPaciente);
router.delete('/:id', pacienteController.eliminarPaciente);

module.exports = router;
