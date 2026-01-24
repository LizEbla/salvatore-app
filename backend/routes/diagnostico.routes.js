const express = require('express');
const router = express.Router();
const diagnosticosController = require('../controllers/diagnosticos.controller');

// =======================
// 🩺 RUTAS DE DIAGNÓSTICO
// =======================
router.get('/paciente/:id/diagnostico-precios', diagnosticosController.diagnosticarPrecios);
router.get('/paciente/:id/diagnosticar-cabeceras', diagnosticosController.diagnosticarCabecerasPaciente);
router.get('/paciente/:id/diagnosticar-grupos', diagnosticosController.diagnosticarGruposExamenes);
router.get('/paciente/:id/diagnosticar-estructura', diagnosticosController.diagnosticarEstructuraExamenes);
router.get('/paciente/:id/diagnosticar-base-datos', diagnosticosController.diagnosticarBaseDatos);

// =======================
// 🛠️ RUTAS DE REPARACIÓN
// =======================
router.post('/examenes/reparar-precios-masivo', diagnosticosController.repararPreciosMasivo);
router.put('/examenes/:examenPacienteId/precio', diagnosticosController.repararPrecioExamen);
router.post('/paciente/:id/reparar-precios', diagnosticosController.repararPreciosCabeceras);

// =======================
// 🔧 RUTAS DE DIAGNÓSTICO DEL SISTEMA
// =======================
router.get('/diagnostico/modelo', diagnosticosController.diagnosticarModelo);

module.exports = router;