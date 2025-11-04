const express = require('express');
const router = express.Router();
const resultadosController = require('../controllers/resultados.controller');

// =======================
// 📝 RUTAS PARA RESULTADOS
// =======================
router.post('/examen/:examenPacienteId/resultado', resultadosController.subirResultadoExamen);
router.get('/examen/:examenPacienteId/detalles-resultados', resultadosController.obtenerDetallesResultados);

// =======================
// 📄 RUTAS PARA PDFs
// =======================
router.post('/generar-pdf-resultados', resultadosController.generarPDFResultados);
router.get('/paciente/:pacienteId/reporte-completo-pdf', resultadosController.generarPDFReporteCompleto);

// =======================
// 📊 RUTAS DE HISTORIAL Y REPORTES
// =======================
router.get('/paciente/:pacienteId/historial-examenes/:nombreExamen', resultadosController.obtenerHistorialExamenes);
router.get('/paciente/:pacienteId/reporte-estadistico', resultadosController.generarReporteEstadistico);

module.exports = router;