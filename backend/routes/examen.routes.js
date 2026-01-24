// ============================================
//  routes/examen.routes.js - CORRECTO ✅
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

// =====================================================
// 🟢 1) CONSULTAS ESPECÍFICAS POR PACIENTE
// =====================================================

// ✅ Resumen de exámenes del paciente
router.get(
  '/pacientes/:id/resumen-examenes',
  verificarAuth,
  examenesController.obtenerResumenExamenesPaciente
);

// ✅ Exámenes agrupados por fecha
router.get(
  '/pacientes/:id/examenes-agrupados',
  verificarAuth,
  examenesController.obtenerExamenesAgrupadosPorFecha
);

// ✅ Exámenes con precios separados
router.get(
  '/pacientes/:id/examenes-con-precios',
  verificarAuth,
  examenesController.obtenerExamenesConPreciosSeparados
);

// ✅ Última fecha de exámenes
router.get('/pacientes/:id/ultima-fecha', verificarAuth, async (req, res) => {
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

    return res.json({
      success: true,
      fecha: fechaFormateada,
      fechaCompleta: ultimoExamen.fechaAsignacion
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor',
      error: error.message
    });
  }
});

// ✅ Diagnóstico automático
router.get(
  '/pacientes/:id/diagnostico',
  verificarAuth,
  examenesController.diagnosticarExamenesPaciente
);

// ✅ Reparar nombres
router.post(
  '/pacientes/:id/reparar-nombres',
  verificarAuth,
  examenesController.repararNombresExamenes
);

// ✅ Reparar datos
router.post(
  '/pacientes/:id/reparar-datos',
  verificarAuth,
  examenesController.repararDatosExamenes
);

// =====================================================
// 🟠 2) DETALLES Y REGISTROS
// =====================================================

// ✅ Información de registro del detalle
router.get(
  '/detalle-examen/:detalleId/informacion-registro',
  verificarAuth,
  examenesController.obtenerInformacionRegistroDetalle
);

// ✅ Detalle completo (si lo usas)
router.get(
  '/detalle-completo/:id',
  verificarAuth,
  examenesController.obtenerDetalleCompleto
);

// ✅ Historial resultados por detalleId (si lo usas)
router.get(
  '/historial-resultados/:detalleId',
  verificarAuth,
  examenesController.obtenerHistorialResultados
);

// ✅ Detalle simple (tu endpoint actual)
router.get(
  '/detalle/:detalleId',
  verificarAuth,
  examenesController.obtenerDetalleExamen
);

// ✅ ✅ DETALLE COMPLETO PARA PDF (IMPORTANTE)
router.get(
  '/detalle/:detalleId/pdf',
  verificarAuth,
  examenesController.getDetalleParaPdf
);

// ✅ Historial por detalle específico (UNA SOLA RUTA, con log)
router.get(
  '/pacientes/:pacienteId/historial-por-detalle/:detalleId',
  verificarAuth,
  (req, res, next) => {
    console.log('🔥 ENTRO A RUTA HISTORIAL', req.params);
    next();
  },
  examenesController.obtenerHistorialPorDetalle
);

// =====================================================
// 🔵 3) CONSULTAS GENERALES / CONFIGURACIÓN
// =====================================================

// ✅ Catálogos (públicos)
router.get('/examenes-con-area', examenesController.obtenerExamenesConArea);
router.get('/tipoexamenes', examenesController.obtenerTiposExamen);
router.get('/promociones/activas', examenesController.obtenerPromocionesActivas);

// ✅ Exámenes pendientes (dashboard)
router.get(
  '/examenes-pendientes',
  verificarAuth,
  examenesController.getExamenesPendientes
);

// ✅ Sucursales
router.get(
  '/sucursales',
  verificarAuth,
  examenesController.getSucursales
);

// =====================================================
// 🟣 4) ASIGNAR EXÁMENES A PACIENTE
// =====================================================

router.post(
  '/pacientes/:id/asignar-examenes',
  verificarAuth,
  examenesController.asignarExamenes
);

// =====================================================
// 🔴 5) ACTUALIZACIÓN DE ESTADOS Y RESULTADOS
// =====================================================

// ⚠️ Tu backend usa PUT /examenes/:detalleId/resultado (según tu examen.service.ts)
// Dejo aquí solo las que ya tenías; asegúrate que existan en el controller.

router.post(
  '/examenes/:examenPacienteId/resultado',
  verificarAuth,
  examenesController.subirResultadoExamen
);

router.put(
  '/examenes/:examenPacienteId/estado',
  verificarAuth,
  examenesController.actualizarEstadoExamen
);

router.put(
  '/:id/resultado',
  verificarAuth,
  examenesController.actualizarResultadoExamen
);

// =====================================================
// 🟡 6) FIRMA ELECTRÓNICA
// =====================================================

router.post(
  '/examenes/:id/firmar',
  verificarAuth,
  upload.single('certificado'),
  examenesController.firmarExamen
);

router.post(
  '/firmar-completar',
  verificarAuth,
  examenesController.firmarYCompletarExamen
);

router.get(
  '/descargar/:detalleId',
  verificarAuth,
  examenesController.descargarPdfFirmado
);

// =====================================================
// 📄 7) GENERACIÓN & GUARDADO DE PDF
// =====================================================

// ✅ Generar PDF
router.post(
  '/generar-pdf',
  verificarAuth,
  examenesController.generarPDFResultados
);

// ✅ Guardar PDF resultado
router.post(
  '/guardar-pdf-resultado',
  verificarAuth,
  examenesController.guardarPdfResultado
);

// ✅ Generación automática
router.post(
  '/:id/generar-pdf-automatico',
  verificarAuth,
  examenesController.generarPdfAutomatico
);

// ✅ Forzar generación
router.post(
  '/:id/forzar-generacion-pdf',
  verificarAuth,
  examenesController.forzarGeneracionPdf
);

// =====================================================
// 🧪 8) DEBUG & MONITOREO
// =====================================================

router.get('/debug-auth', verificarAuth, (req, res) => {
  console.log('🔍 DEBUG AUTH - Usuario:', req.usuario);
  res.json({
    success: true,
    usuario: req.usuario,
    msg: 'Auth OK',
    timestamp: new Date().toISOString()
  });
});

router.get('/diagnostico-sesion', verificarAuth, (req, res) => {
  console.log('🔍 DIAGNÓSTICO SESIÓN - Usuario completo:', req.usuario);

  res.json({
    success: true,
    usuario: req.usuario,
    detalles: {
      id: req.usuario?.id,
      tipo: req.usuario?.tipoUsuario,
      nombres: req.usuario?.nombres,
      apellidos: req.usuario?.apellidos,
      usuario: req.usuario?.usuario,
      timestamp: new Date().toISOString()
    }
  });
});

router.get('/health/check', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Módulo de exámenes funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Debug agrupación
router.get('/debug/pacientes/:id/examenes-agrupados', verificarAuth, async (req, res) => {
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

// Opcionales
router.put(
  '/:id/actualizar-area',
  verificarAuth,
  examenesController.actualizarAreaEspecializada
);

router.put(
  '/:id/cambiar-estado',
  verificarAuth,
  examenesController.cambiarEstado
);


// Agrega esto después de la ruta /debug/pacientes/:id/examenes-agrupados
// pero antes del module.exports

// =====================================================
// 📊 HISTORIAL DE EXAMENES POR PACIENTE
// =====================================================
// En tu archivo routes/examen.routes.js, agrega estos endpoints:

// ✅ Endpoint para actualizar estado de firma
router.put('/:id/firma', async (req, res) => {
  try {
    const { id } = req.params;
    const { firmado, fechaFirma, laboratoristaId } = req.body;

    console.log('🔐 Actualizando estado de firma para examen:', {
      detalleId: id,
      firmado,
      laboratoristaId
    });

    // Buscar el detalle del examen
    const detalle = await db.ExamenPacienteDetalle.findByPk(id);
    
    if (!detalle) {
      return res.status(404).json({
        success: false,
        mensaje: 'No se encontró el detalle del examen'
      });
    }

    // Actualizar campos de firma
    const updateData = {
      firmado: firmado || false,
      fecha_firma: fechaFirma ? new Date(fechaFirma) : new Date(),
      laboratorista_firma_id: laboratoristaId || null
    };

    await detalle.update(updateData);

    // Registrar en historial de auditoría
    try {
      await db.AuditoriaFirma.create({
        examen_paciente_detalle_id: id,
        firmado: firmado,
        fecha_firma: new Date(),
        laboratorista_id: laboratoristaId,
        accion: firmado ? 'FIRMA_APLICADA' : 'FIRMA_REMOVIDA',
        ip_address: req.ip,
        user_agent: req.get('User-Agent')
      });
    } catch (auditError) {
      console.warn('⚠️ No se pudo registrar auditoría:', auditError);
    }

    res.json({
      success: true,
      mensaje: firmado ? 'Examen marcado como firmado' : 'Estado de firma actualizado',
      data: {
        id: detalle.id,
        firmado: detalle.firmado,
        fecha_firma: detalle.fecha_firma,
        nombre_examen: detalle.Examen?.nombre || detalle.Subexamen?.nombre
      }
    });

  } catch (error) {
    console.error('❌ Error actualizando firma:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno actualizando estado de firma',
      detalle: error.message
    });
  }
});

// ✅ Endpoint para obtener información de firma
router.get('/:id/info-firma', async (req, res) => {
  try {
    const { id } = req.params;

    const detalle = await db.ExamenPacienteDetalle.findByPk(id, {
      include: [
        {
          model: db.Laboratorista,
          as: 'LaboratoristaFirma',
          attributes: ['id', 'nombres', 'apellidos', 'registro_profesional']
        },
        {
          model: db.Examen,
          as: 'Examen',
          attributes: ['id', 'nombre']
        },
        {
          model: db.Subexamen,
          as: 'Subexamen',
          attributes: ['id', 'nombre']
        }
      ]
    });

    if (!detalle) {
      return res.status(404).json({
        success: false,
        mensaje: 'No se encontró información de firma'
      });
    }

    const infoFirma = {
      firmado: detalle.firmado || false,
      fecha_firma: detalle.fecha_firma,
      laboratorista: detalle.LaboratoristaFirma ? {
        id: detalle.LaboratoristaFirma.id,
        nombre_completo: `${detalle.LaboratoristaFirma.nombres} ${detalle.LaboratoristaFirma.apellidos}`,
        registro: detalle.LaboratoristaFirma.registro_profesional
      } : null,
      examen: {
        id: detalle.Examen?.id || detalle.Subexamen?.id,
        nombre: detalle.Examen?.nombre || detalle.Subexamen?.nombre || 'Examen'
      },
      tiene_pdf_firmado: !!detalle.resultado_pdf,
      fecha_ultima_actualizacion: detalle.updatedAt
    };

    res.json({
      success: true,
      data: infoFirma
    });

  } catch (error) {
    console.error('❌ Error obteniendo info firma:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno obteniendo información de firma',
      detalle: error.message
    });
  }
});

// ✅ Endpoint para actualizar estado (si no lo tienes)
router.put('/:id/estado', async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    console.log('🔄 Actualizando estado del examen:', { id, estado });

    if (!estado) {
      return res.status(400).json({
        success: false,
        mensaje: 'Estado no proporcionado'
      });
    }

    const detalle = await db.ExamenPacienteDetalle.findByPk(id);
    
    if (!detalle) {
      return res.status(404).json({
        success: false,
        mensaje: 'No se encontró el examen'
      });
    }

    await detalle.update({ estado });

    res.json({
      success: true,
      mensaje: 'Estado actualizado correctamente',
      data: {
        id: detalle.id,
        estado: detalle.estado,
        actualizado_en: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error actualizando estado:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno actualizando estado',
      detalle: error.message
    });
  }
});

router.get(
  '/pacientes/:pacienteId/historial',
  verificarAuth,
  async (req, res) => {
    try {
      const { pacienteId } = req.params;
      const { examen, tipoExamenId, nombreExamen, examenId } = req.query;
      
      console.log('📊 OBTENIENDO HISTORIAL PARA PACIENTE:', {
        pacienteId,
        examen,
        tipoExamenId,
        nombreExamen,
        examenId
      });
      
      // Buscar todas las cabeceras del paciente con INNER JOIN
      const cabeceras = await db.ExamenPaciente.findAll({
        where: { pacienteId: pacienteId },
        include: [
          {
            model: db.ExamenPacienteDetalle,
            as: 'Detalles',
            required: true, // INNER JOIN para solo traer cabeceras con detalles
            include: [
              {
                model: db.Examen,
                as: 'Examen',
                attributes: ['id', 'nombre'], // ✅ SOLO id y nombre, SIN codigo
                include: [{
                  model: db.Area,
                  as: 'Area',
                  attributes: ['nombre']
                }]
              },
              {
                model: db.Subexamen,
                as: 'Subexamen',
                attributes: ['id', 'nombre'] // ✅ SOLO id y nombre, SIN codigo
              }
            ]
          }
        ],
        order: [['fechaAsignacion', 'DESC']]
      });
      
      // Si no hay cabeceras
      if (!cabeceras || cabeceras.length === 0) {
        return res.json({
          success: true,
          mensaje: 'No se encontró historial para este paciente',
          historial: [],
          total: 0,
          pacienteId: pacienteId
        });
      }
      
      // Extraer todos los detalles en un array plano
      let todosDetalles = [];
      cabeceras.forEach(cabecera => {
        if (cabecera.Detalles && Array.isArray(cabecera.Detalles)) {
          cabecera.Detalles.forEach(detalle => {
            todosDetalles.push({
              ...detalle.toJSON(),
              cabecera: {
                id: cabecera.id,
                fechaAsignacion: cabecera.fechaAsignacion,
                estadoPago: cabecera.estadoPago,
                total: cabecera.total
              }
            });
          });
        }
      });
      
      // Filtrar por nombre de examen si se proporciona
      let detallesFiltrados = todosDetalles;
      if (examen || nombreExamen) {
        const terminoBusqueda = (examen || nombreExamen).toLowerCase();
        detallesFiltrados = todosDetalles.filter(item => {
          const nombreExamenItem = item.Examen?.nombre?.toLowerCase() || 
                                   item.Subexamen?.nombre?.toLowerCase() || 
                                   item.nombreExamen?.toLowerCase() || '';
          return nombreExamenItem.includes(terminoBusqueda);
        });
      }
      
      // Formatear respuesta
      const historialFormateado = detallesFiltrados.map(item => ({
        id: item.id,
        pacienteId: item.pacienteId,
        examenPacienteId: item.examenPacienteId,
        fecha: item.cabecera.fechaAsignacion,
        fechaResultado: item.fechaResultado,
        examenNombre: item.Examen?.nombre || item.Subexamen?.nombre || item.nombreExamen || 'Sin nombre',
        examenId: item.Examen?.id || item.examenId,
        subexamenId: item.Subexamen?.id || item.subexamenId,
        area: item.Examen?.Area?.nombre,
        resultados: item.resultados,
        estado: item.estado,
        precioFinal: item.precioFinal,
        estadoPago: item.cabecera.estadoPago,
        registradoPor: item.registradoPor,
        fechaRegistro: item.createdAt,
        laboratorio: item.laboratorio,
        esSubexamen: item.esSubexamen || false
      }));
      
      console.log(`✅ Historial encontrado: ${historialFormateado.length} registros`);
      
      res.json({
        success: true,
        mensaje: 'Historial obtenido correctamente',
        historial: historialFormateado,
        total: historialFormateado.length,
        pacienteId: pacienteId
      });
      
    } catch (error) {
      console.error('❌ Error obteniendo historial:', error.message);
      res.status(500).json({
        success: false,
        mensaje: 'Error al obtener historial',
        error: error.message
      });
    }
  }
);

// =====================================================
// 📄 RUTAS ESPECÍFICAS PARA FRONTEND (AGREGAR ESTAS)
// =====================================================



// ✅ Ruta para datos completos (lo que intenta el frontend)
router.get(
  '/datos-completos/:id',
  verificarAuth,
  async (req, res) => {
    try {
      // Puedes reutilizar la lógica de detalle-completo o crear una nueva
      const detalle = await db.ExamenPacienteDetalle.findByPk(req.params.id, {
        include: [
          {
            model: db.Examen,
            as: 'Examen',
            include: [{ model: db.Area, as: 'Area' }]
          },
          {
            model: db.Subexamen,
            as: 'Subexamen'
          },
          {
            model: db.Laboratorista,
            as: 'LaboratoristaFirma',
            attributes: ['id', 'nombres', 'apellidos', 'registro_profesional']
          },
          {
            model: db.ExamenPaciente,
            as: 'Cabecera',
            include: [{
              model: db.Paciente,
              as: 'Paciente',
              attributes: ['id', 'nombres', 'apellidos', 'dni']
            }]
          }
        ]
      });

      if (!detalle) {
        return res.status(404).json({
          success: false,
          mensaje: 'Examen no encontrado'
        });
      }

      res.json({
        success: true,
        data: detalle
      });
    } catch (error) {
      console.error('❌ Error obteniendo datos completos:', error);
      res.status(500).json({
        success: false,
        mensaje: 'Error interno del servidor',
        error: error.message
      });
    }
  }
);
console.log('✅ Ruta de historial cargada correctamente');
console.log('✅ Rutas de EXÁMENES cargadas correctamente');
module.exports = router;
