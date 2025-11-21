// routes/vista-paciente.routes.js - VERSIÓN CORREGIDA
const express = require('express');
const router = express.Router();

// Middleware de autenticación
const verificarAuth = require('../middleware/auth');

// Controlador
const vistaPacienteController = require('../controllers/vista-paciente.controller');

// Modelos correctos desde Sequelize
const db = require('../models');
const { Paciente, ExamenPaciente, Examen } = db;

// Middleware: Requiere autenticación
router.use(verificarAuth);

// Restringir acceso a pacientes exclusivamente
router.use((req, res, next) => {
  if (req.usuario.tipoUsuario !== 'paciente' && req.usuario.tipoUsuario !== 'usuario_simulado') {
    return res.status(403).json({ message: '⚠️ Solo pacientes pueden acceder a esta vista' });
  }
  next();
});

/* =====================================
   PERFIL DEL PACIENTE
===================================== */
router.get('/perfil', async (req, res) => {
  try {
    const paciente = await Paciente.findByPk(req.usuario.id, {
      attributes: ['id','nombres','apellidos','cedula','sexo','edad']
    });
    res.json(paciente);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* =====================================
   DEUDAS
===================================== */
router.get('/deudas', async (req, res) => {
  try {
    const registros = await ExamenPaciente.findAll({
      where: { pacienteId: req.usuario.id }
    });

    const total = registros.reduce((sum, r) => sum + (Number(r.saldoPendiente) || 0), 0);

    res.json({ totalPendiente: total, registros });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* =====================================
   MIS EXÁMENES
===================================== */
router.get('/mis-examenes', async (req, res) => {
  try {
    const examenes = await ExamenPaciente.findAll({
      where: { pacienteId: req.usuario.id },
      include: [{ model: Examen, as: 'Examen', attributes: ['id','nombre','precio'] }],
      order: [['fechaAsignacion','DESC']]
    });
    res.json(examenes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* =====================================
   DASHBOARD
===================================== */
router.get('/dashboard', vistaPacienteController.obtenerDashboardPaciente);

/* =====================================
   HISTORIAL AGRUPADO
===================================== */
router.get('/historial', vistaPacienteController.obtenerHistorialAgrupado);

/* =====================================
   PDFS
===================================== */
router.get('/orden/:id/pdf', vistaPacienteController.generarPdfOrden);
router.get('/ordenes/fecha/:fecha/pdf-datos', vistaPacienteController.generarPdfPorFecha);
router.get('/ordenes/fecha/:fecha/pdfs-existentes', vistaPacienteController.obtenerPdfsExistentesPorFecha);
router.get('/pdf/individual/:examenId', vistaPacienteController.generarPdfIndividual);

// Agregar esta línea en las rutas de PDFs
router.get('/pdf/estado/:examenId', vistaPacienteController.verificarEstadoPdf);

/* =====================================
   DATOS COMPLETOS DEL EXAMEN
===================================== */
router.get('/examenes/:detalleId/datos-completos', vistaPacienteController.obtenerDatosExamenCompleto);

/* =====================================
   DIAGNÓSTICO
===================================== */
router.get('/diagnostico-pdfs', vistaPacienteController.diagnosticoPdfs);

// Exportar
module.exports = router;