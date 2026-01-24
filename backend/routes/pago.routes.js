const express = require('express');
const router = express.Router();

const pagosController = require('../controllers/pagos.controller');

// INDIVIDUALES
router.put('/examen/:examenPacienteId/pago', pagosController.actualizarEstadoPago);
router.post('/examen/:id/abono', pagosController.registrarAbono);
router.post('/procesar-pagos-multiples', pagosController.procesarPagosMultiples);

// GRUPAL
router.post('/procesar-pago-grupal', pagosController.procesarPagoGrupal);
router.get('/paciente/:pacienteId/resumen-grupal/:fecha', pagosController.obtenerResumenGrupalPorFecha);
router.get('/paciente/:pacienteId/grupo-pago/:fecha', pagosController.obtenerDetalleGrupoPago);

// VERIFICACIONES (LAS QUE TU FRONT ESTÁ LLAMANDO)
router.get('/verificar-saldo/:pacienteId/:fecha', pagosController.verificarSaldo);
router.get('/verificar-saldo-real/:pacienteId/:fecha', pagosController.verificarSaldoReal);

// DIAGNÓSTICOS
router.get('/paciente/:pacienteId/diagnostico-fechas-pago/:fecha', pagosController.diagnosticarFechasPago);
router.get('/paciente/:pacienteId/diagnostico-pago/:fecha', pagosController.diagnosticoCompletoPago);
router.post('/diagnostico-fechas', pagosController.diagnosticarFechasPagoGrupal);
router.get('/diagnostico-fechas-completo/:pacienteId', pagosController.diagnosticoCompletoFechas);
router.get('/diagnostico-paciente/:pacienteId', pagosController.diagnosticarPaciente);

// ACTUALIZACIÓN
router.get('/pacientes/:pacienteId/fecha/:fecha/datos-actualizados', pagosController.obtenerDatosActualizados);

module.exports = router;
