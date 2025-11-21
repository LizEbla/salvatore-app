// ============================================
//  routes/examen.routes.js - VERSIÓN FINAL 💎
// ============================================

const express = require('express');
const router = express.Router();
const examenesController = require('../controllers/examenes.controller');
const verificarAuth = require('../middleware/auth');
const db = require('../models');

// =========================
// 📁 Subida de certificado
// =========================
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// PROTEGER TODAS LAS RUTAS
router.use(verificarAuth);

// =====================================================
// 🟢 1) CONSULTAS ESPECÍFICAS POR PACIENTE
// =====================================================

router.get('/pacientes/:id/resumen-examenes', examenesController.obtenerResumenExamenesPaciente);
router.get('/pacientes/:id/examenes-agrupados', examenesController.obtenerExamenesAgrupadosPorFecha);
router.get('/pacientes/:id/examenes-con-precios', examenesController.obtenerExamenesConPreciosSeparados);

// Última fecha de exámenes
router.get('/pacientes/:id/ultima-fecha', async (req, res) => {
  try {
    const { id } = req.params;

    const ultimoExamen = await db.ExamenPaciente.findOne({
      where: { pacienteId: id },
      order: [['fechaAsignacion', 'DESC']],
      attributes: ['fechaAsignacion']
    });

    if (!ultimoExamen) {
      return res.json({ success: false, mensaje: 'No se encontraron exámenes' });
    }

    const fecha = new Date(ultimoExamen.fechaAsignacion);
    const fechaFormateada = fecha.toISOString().split('T')[0];

    res.json({
      success: true,
      fecha: fechaFormateada,
      fechaCompleta: ultimoExamen.fechaAsignacion
    });

  } catch (error) {
    res.status(500).json({ success: false, mensaje: 'Error interno del servidor' });
  }
});

// Diagnóstico automático
router.get('/pacientes/:id/diagnostico', examenesController.diagnosticarExamenesPaciente);

// Reparar nombres
router.post('/pacientes/:id/reparar-nombres', examenesController.repararNombresExamenes);

// Reparar datos
router.post('/pacientes/:id/reparar-datos', examenesController.repararDatosExamenes);

// =====================================================
// 🟠 2) DETALLES Y REGISTROS
// =====================================================

router.get('/detalle-examen/:detalleId/informacion-registro', examenesController.obtenerInformacionRegistroDetalle);
router.get('/detalle-completo/:id', examenesController.obtenerDetalleCompleto);
router.get('/historial-resultados/:detalleId', examenesController.obtenerHistorialResultados);

// =====================================================
// 🔵 3) CONSULTAS GENERALES / CONFIGURACIÓN
// =====================================================

router.get('/examenes-con-area', examenesController.obtenerExamenesConArea);
router.get('/tipoexamenes', examenesController.obtenerTiposExamen);
router.get('/promociones/activas', examenesController.obtenerPromocionesActivas);

// =====================================================
// 🟣 4) ASIGNAR EXÁMENES A PACIENTE
// =====================================================

router.post('/pacientes/:id/asignar-examenes', examenesController.asignarExamenes);

// =====================================================
// 🔴 5) ACTUALIZACIÓN DE ESTADOS Y RESULTADOS
// =====================================================

router.post('/examenes/:examenPacienteId/resultado', examenesController.subirResultadoExamen);
router.put('/examenes/:examenPacienteId/estado', examenesController.actualizarEstadoExamen);
router.put('/:id/resultado', examenesController.actualizarResultadoExamen);

// =====================================================
// 🟡 6) FIRMA ELECTRÓNICA
// =====================================================

router.post('/examenes/:id/firmar', upload.single('certificado'), examenesController.firmarExamen);
router.post('/firmar-completar', examenesController.firmarYCompletarExamen);
router.get('/descargar/:detalleId', examenesController.descargarPdfFirmado);

// =====================================================
// 📄 7) GENERACIÓN & GUARDADO DE PDF
// =====================================================

// Generar un PDF por examen
router.post('/generar-pdf', examenesController.generarPDFResultados);

// Generar PDF completo por fecha
router.post('/generar-pdf-completo', examenesController.generarPDFCompleto);

// Guardar PDF generado
router.post('/guardar-pdf-generado', examenesController.guardarPdfGenerado);

// Guardar PDF resultado desde el frontend
router.post('/guardar-pdf-resultado', examenesController.guardarPdfResultado);

// Generar PDF automático
router.post('/:id/generar-pdf-automatico', examenesController.generarPdfAutomatico);

// Verificar estado del PDF
router.get('/:id/estado-pdf', examenesController.verificarEstadoPdf);

// =====================================================
// 🧪 8) DEBUG
// =====================================================

router.get('/debug-auth', (req, res) => {
  res.json({ success: true, usuario: req.usuario, msg: 'Auth OK' });
});

router.get('/health/check', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Módulo de exámenes funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Debug agrupación
router.get('/debug/pacientes/:id/examenes-agrupados', async (req, res) => {
  try {
    const { id } = req.params;

    const examenes = await db.ExamenPaciente.findAll({
      where: { pacienteId: id },
      include: [
        {
          model: db.ExamenPacienteDetalle,
          as: 'Detalles',
          include: [
            { model: db.Examen, as: 'Examen' },
            { model: db.Subexamen, as: 'Subexamen' }
          ]
        }
      ],
      order: [['fechaAsignacion', 'DESC']]
    });

    res.json({ success: true, examenes });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
console.log('✅ Rutas de EXÁMENES cargadas correctamente');
module.exports = router;
