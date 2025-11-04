const express = require('express');
const router = express.Router();
const pagosController = require('../controllers/pagos.controller');

// =======================
// 🔄 RUTAS DE PAGOS INDIVIDUALES
// =======================
router.put('/examen/:examenPacienteId/pago', pagosController.actualizarEstadoPago);
router.post('/examen/:id/abono', pagosController.registrarAbono);
router.post('/procesar-pagos-multiples', pagosController.procesarPagosMultiples);

// =======================
// 💰 RUTAS DE PAGO GRUPAL
// =======================
router.post('/procesar-pago-grupal', pagosController.procesarPagoGrupal);
router.get('/paciente/:pacienteId/resumen-grupal/:fecha', pagosController.obtenerResumenGrupalPorFecha);
router.get('/paciente/:pacienteId/grupo-pago/:fecha', pagosController.obtenerDetalleGrupoPago);

// =======================
// 📊 RUTAS DE DIAGNÓSTICO DE PAGOS
// =======================
router.get('/paciente/:pacienteId/diagnostico-fechas-pago/:fecha', pagosController.diagnosticarFechasPago);
router.get('/paciente/:pacienteId/diagnostico-pago/:fecha', pagosController.diagnosticoCompletoPago);

module.exports = router;