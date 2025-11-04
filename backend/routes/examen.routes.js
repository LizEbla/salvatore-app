// routes/examen.routes.js
const express = require('express');
const router = express.Router();
const examenesController = require('../controllers/examenes.controller');
const verificarAuth = require('../middleware/auth');

// 🔐 PROTEGER TODAS LAS RUTAS
router.use(verificarAuth);

// 🩺 ASIGNACIÓN DE EXÁMENES - ✅ RUTA CORREGIDA
router.post('/pacientes/:id/asignar-examenes', examenesController.asignarExamenes);

// 📊 CONSULTAS DE EXÁMENES
router.get('/examenes-con-area', examenesController.obtenerExamenesConArea);
router.get('/pacientes/:id/resumen-examenes', examenesController.obtenerResumenExamenesPaciente);
router.get('/pacientes/:id/examenes-agrupados', examenesController.obtenerExamenesAgrupadosPorFecha);
router.get('/pacientes/:id/examenes-con-precios', examenesController.obtenerExamenesConPreciosSeparados);
// Ruta para obtener información de registro
router.get('/detalle-examen/:detalleId/informacion-registro', examenesController.obtenerInformacionRegistroDetalle);

// 🔄 ACTUALIZACIONES DE EXÁMENES
router.put('/examenes/:examenPacienteId/estado', examenesController.actualizarEstadoExamen);
router.post('/examenes/:examenPacienteId/resultado', examenesController.subirResultadoExamen);

// ============================================
// ✅ RUTA DE HEALTH CHECK
// ============================================

router.get('/health/check', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Módulo de exámenes funcionando correctamente',
    timestamp: new Date().toISOString(),
    rutas: {
      asignacion: ['POST /pacientes/:id/asignar-examenes'],
      consultas: [
        'GET /examenes-con-area',
        'GET /pacientes/:id/resumen-examenes',
        'GET /pacientes/:id/examenes-agrupados',
        'GET /pacientes/:id/examenes-con-precios'
      ],
      actualizaciones: [
        'PUT /examenes/:examenPacienteId/estado',
        'POST /examenes/:examenPacienteId/resultado'
      ]
    }
  });
});

console.log('✅ Rutas de exámenes configuradas correctamente:');
console.log('   🩺 POST /pacientes/:id/asignar-examenes');
console.log('   📊 4 rutas de consulta');
console.log('   🔄 2 rutas de actualización');
console.log('   🔧 Total: 7 rutas activas');

module.exports = router;