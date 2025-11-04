// pdf.routes.js
const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdf.controller');

// =======================
// 📄 RUTAS DE PDF Y VISUALIZACIÓN
// =======================

// Generar PDF de resultados
router.post('/examenes/generar-pdf', pdfController.generarPDFResultados);

// Obtener historial para comparación
router.get('/pacientes/:pacienteId/historial-examenes/:nombreExamen', pdfController.obtenerHistorialExamenes);

module.exports = router;