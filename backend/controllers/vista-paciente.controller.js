// vista-paciente.controller.js - VERSIÓN COMPLETAMENTE CORREGIDA
const db = require('../models');
const { Sequelize } = db;

const {
  Paciente,
  ExamenPaciente,
  ExamenPacienteDetalle,
  Examen,
  Area
} = db;

const Op = Sequelize.Op;

/* ===========================================================
   🔵 1. DASHBOARD DEL PACIENTE - CORREGIDO
=========================================================== */
exports.obtenerDashboardPaciente = async (req, res) => {
  try {
    const pacienteId = req.usuario.id;

    console.log(`📊 Obteniendo dashboard para paciente: ${pacienteId}`);

    const examenes = await ExamenPaciente.findAll({
      where: { pacienteId },
      include: [
        {
          model: ExamenPacienteDetalle,
          as: 'Detalles',
          include: [
            {
              model: Examen,
              as: 'Examen',
              include: [{ model: Area, as: 'Area', attributes: ['nombre'] }],
              attributes: ['id','nombre']
            }
          ]
        }
      ],
      order: [['fechaAsignacion','DESC']]
    });

    // Calcular estadísticas
    const totalExamenes = examenes.length;
    const pendientes = examenes.filter(e => e.estadoPago === 'pendiente').length;
    const pagados = examenes.filter(e => e.estadoPago === 'pagado').length;
    
    let completados = 0;
    let enProceso = 0;
    
    examenes.forEach(examen => {
      if (examen.Detalles) {
        examen.Detalles.forEach(detalle => {
          if (detalle.estado === 'completado') completados++;
          if (detalle.estado === 'en_proceso') enProceso++;
        });
      }
    });

    return res.json({
      totalExamenes,
      pendientes,
      pagados,
      completados,
      enProceso,
      examenes
    });

  } catch (error) {
    console.error("❌ Error en Dashboard:", error);
    res.status(500).json({ 
      message: "Error interno del servidor", 
      error: error.message 
    });
  }
};

/* ===========================================================
   🔵 2. GENERAR PDF POR FECHA - CORREGIDO
=========================================================== */
exports.generarPdfPorFecha = async (req, res) => {
  try {
    const { fecha } = req.params;
    const pacienteId = req.usuario.id;

    console.log(`📄 Generando PDF por fecha: ${fecha}, paciente: ${pacienteId}`);

    const examenes = await ExamenPaciente.findAll({
      where: {
        pacienteId,
        fechaAsignacion: { [Op.like]: `${fecha}%` }
      },
      include: [
        {
          model: Paciente,
          as: 'Paciente',
          attributes: ['id','nombres','apellidos','cedula','edad','sexo','correo']
        },
        {
          model: ExamenPacienteDetalle,
          as: 'Detalles',
          include: [
            {
              model: Examen,
              as: 'Examen',
              include: [
                { model: Area, as: 'Area', attributes: ['nombre'] }
              ],
              attributes: ['id','nombre']
            }
          ]
        }
      ],
      order: [['createdAt','ASC']]
    });

    if (!examenes.length) {
      return res.status(404).json({ message: 'No se encontraron exámenes en esa fecha' });
    }

    const paciente = examenes[0].Paciente;
    const detalles = [];

    examenes.forEach(orden => {
      (orden.Detalles || []).forEach(det => {
        detalles.push({
          examen: {
            nombre: det.Examen?.nombre,
            area: det.Examen?.Area?.nombre
          },
          resultados: det.resultados || {},
          observaciones: det.observaciones || '',
          estado: det.estado,
          precio: det.precioFinal
        });
      });
    });

    return res.json({
      paciente,
      fecha,
      detalles,
      totalExamenes: detalles.length
    });

  } catch (error) {
    console.error("❌ Error generando PDF por fecha:", error);
    res.status(500).json({ message: 'Error generando PDF por fecha', error: error.message });
  }
};

/* ===========================================================
   🔵 3. PDF COMBINADO POR ORDEN - CORREGIDO
=========================================================== */
exports.generarPdfOrden = async (req, res) => {
  try {
    const { id } = req.params;
    const pacienteId = req.usuario.id;

    console.log(`📦 Generando PDF para orden: ${id}, paciente: ${pacienteId}`);

    const orden = await ExamenPaciente.findOne({
      where: { 
        id: Number(id), 
        pacienteId 
      },
      include: [
        {
          model: ExamenPacienteDetalle,
          as: "Detalles",
          where: { 
            estado: 'completado', 
            pdfGenerado: { [Op.not]: null } 
          },
          include: [
            { 
              model: Examen, 
              as: 'Examen', 
              attributes: ['nombre'] 
            }
          ]
        }
      ]
    });

    if (!orden) {
      return res.status(404).json({ 
        message: 'Orden no encontrada o sin PDFs disponibles' 
      });
    }

    return res.json(orden);

  } catch (error) {
    console.error("❌ Error en PDF por orden:", error);
    return res.status(500).json({ 
      message: 'Error generando PDF', 
      error: error.message 
    });
  }
};

/* ===========================================================
   🔵 4. PDF INDIVIDUAL - CORREGIDO
=========================================================== */
exports.generarPdfIndividual = async (req, res) => {
  try {
    const { examenId } = req.params;
    const pacienteId = req.usuario.id;

    console.log(`📄 Generando PDF individual: ${examenId}, paciente: ${pacienteId}`);

    const detalle = await ExamenPacienteDetalle.findOne({
      where: {
        id: examenId,
        estado: 'completado',
        pdfGenerado: { [Op.not]: null }
      },
      include: [
        {
          model: ExamenPaciente,
          as: 'Cabecera',
          where: { pacienteId },
          include: [{ 
            model: Paciente, 
            as: 'Paciente', 
            attributes: ['id','nombres','apellidos','cedula'] 
          }]
        },
        {
          model: Examen,
          as: 'Examen',
          attributes: ['id','nombre']
        }
      ]
    });

    if (!detalle) {
      return res.status(404).json({ 
        message: 'Examen no disponible para descarga' 
      });
    }

    const orden = detalle.Cabecera;
    const pagoOk = orden.estadoPago === 'pagado' ||
                  (orden.estadoPago === 'parcial' && Number(orden.saldoPendiente) === 0);

    if (!pagoOk) {
      return res.status(403).json({ 
        message: 'El examen no está pagado.' 
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 
      `attachment; filename="resultado_${detalle.Examen?.nombre || 'examen'}.pdf"`);
    
    return res.send(detalle.pdfGenerado);

  } catch (error) {
    console.error("❌ Error en PDF individual:", error);
    res.status(500).json({ 
      message: 'Error sirviendo PDF', 
      error: error.message 
    });
  }
};

/* ===========================================================
   🔵 5. PDFs EXISTENTES POR FECHA - CORREGIDO
=========================================================== */
exports.obtenerPdfsExistentesPorFecha = async (req, res) => {
  try {
    const { fecha } = req.params;
    const pacienteId = req.usuario.id;

    console.log(`🔍 Obteniendo PDFs existentes para fecha: ${fecha}, paciente: ${pacienteId}`);

    const examenes = await ExamenPaciente.findAll({
      where: { 
        pacienteId, 
        fechaAsignacion: { [Op.like]: `${fecha}%` } 
      },
      include: [
        {
          model: ExamenPacienteDetalle,
          as: 'Detalles',
          where: { 
            estado: 'completado', 
            pdfGenerado: { [Op.not]: null } 
          },
          include: [
            { 
              model: Examen, 
              as: 'Examen', 
              attributes: ['id','nombre'] 
            }
          ]
        },
        {
          model: Paciente,
          as: 'Paciente',
          attributes: ['id','nombres','apellidos','cedula']
        }
      ]
    });

    if (!examenes.length) {
      return res.status(404).json({ 
        message: 'No hay PDFs para esta fecha' 
      });
    }

    const pdfs = [];

    examenes.forEach(ord => {
      (ord.Detalles || []).forEach(d => {
        pdfs.push({
          ordenId: ord.id,
          detalleId: d.id,
          examenNombre: d.Examen?.nombre,
          cedula: ord.Paciente?.cedula,
          fecha: ord.fechaAsignacion,
          pdfSize: d.pdfGenerado?.length || 0
        });
      });
    });

    return res.json({
      fecha,
      totalPdfs: pdfs.length,
      pdfs
    });

  } catch (error) {
    console.error("❌ Error obteniendo PDFs:", error);
    res.status(500).json({ 
      message: 'Error obteniendo PDFs', 
      error: error.message 
    });
  }
};

/* ===========================================================
   🔵 6. HISTORIAL AGRUPADO - CORREGIDO
=========================================================== */
exports.obtenerHistorialAgrupado = async (req, res) => {
  try {
    const pacienteId = req.usuario.id;

    console.log(`📋 Obteniendo historial para paciente: ${pacienteId}`);

    const ordenes = await ExamenPaciente.findAll({
      where: { pacienteId },
      include: [
        {
          model: ExamenPacienteDetalle,
          as: 'Detalles',
          include: [
            {
              model: Examen,
              as: 'Examen',
              include: [{ 
                model: Area, 
                as: 'Area', 
                attributes: ['id','nombre'] 
              }],
              attributes: ['id','nombre']
            }
          ]
        }
      ],
      order: [
        ['fechaAsignacion','DESC'],
        [{ model: ExamenPacienteDetalle, as: 'Detalles' }, 'id', 'ASC']
      ]
    });

    const porFecha = {};

    for (const ord of ordenes) {
      const f = new Date(ord.fechaAsignacion);
      const fechaKey = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(f.getDate()).padStart(2, '0')}`;

      if (!porFecha[fechaKey]) {
        porFecha[fechaKey] = {
          fechaISO: fechaKey,
          fechaFormateada: f.toLocaleDateString("es-EC", {
            day: "numeric",
            month: "long",
            year: "numeric"
          }),
          ordenes: []
        };
      }

      const pagoOk = ord.estadoPago === 'pagado' ||
                    (ord.estadoPago === 'parcial' && Number(ord.saldoPendiente || 0) === 0);

      const areasMap = {};

      (ord.Detalles || []).forEach(det => {
        const area = det.Examen?.Area?.nombre || "Sin Área";

        if (!areasMap[area]) {
          areasMap[area] = {
            nombre: area,
            examenes: []
          };
        }

        const puedeVer = pagoOk && 
                        det.estado === "completado" && 
                        det.pdfGenerado !== null;

        areasMap[area].examenes.push({
          id: det.id,
          examenId: det.examenId,
          nombre: det.Examen?.nombre || 'Examen sin nombre',
          estado: det.estado,
          precio: det.precioFinal,
          tienePdf: det.pdfGenerado !== null,
          puedeVer: puedeVer,
          debug: {
            pagoOk,
            completado: det.estado === "completado",
            pdf: det.pdfGenerado ? "sí" : "no"
          }
        });
      });

      porFecha[fechaKey].ordenes.push({
        id: ord.id,
        fecha: ord.fechaAsignacion,
        estadoPago: ord.estadoPago,
        saldoPendiente: ord.saldoPendiente,
        pagoOk,
        resultadosOk: (ord.Detalles || []).some(d => d.pdfGenerado),
        puedeVerOrden: (ord.Detalles || []).every(d => d.pdfGenerado),
        areas: Object.values(areasMap)
      });
    }

    return res.json(Object.values(porFecha));

  } catch (error) {
    console.error("❌ Error historial agrupado:", error);
    res.status(500).json({ 
      message: 'Error obteniendo historial', 
      error: error.message 
    });
  }
};

/* ===========================================================
   🔵 7. DIAGNÓSTICO DE PDFs - CORREGIDO
=========================================================== */
exports.diagnosticoPdfs = async (req, res) => {
  try {
    const pacienteId = req.usuario.id;

    console.log(`🔧 Diagnóstico PDFs para paciente: ${pacienteId}`);

    const detalles = await ExamenPacienteDetalle.findAll({
      include: [
        {
          model: ExamenPaciente,
          as: 'Cabecera',
          where: { pacienteId },
          attributes: ['id', 'fechaAsignacion', 'estadoPago']
        },
        {
          model: Examen,
          as: 'Examen',
          attributes: ['nombre']
        }
      ]
    });

    const data = detalles.map(det => ({
      detalleId: det.id,
      examen: det.Examen?.nombre,
      fecha: det.Cabecera?.fechaAsignacion,
      estado: det.estado,
      tienePdf: !!det.pdfGenerado,
      pdfSize: det.pdfGenerado?.length || 0
    }));

    return res.json({
      total: data.length,
      completos: data.filter(d => d.tienePdf).length,
      pendientes: data.filter(d => !d.tienePdf).length,
      data
    });

  } catch (error) {
    console.error("❌ Error en diagnóstico PDFs:", error);
    return res.status(500).json({ 
      message: 'Error en diagnóstico', 
      error: error.message 
    });
  }
};

/* ===========================================================
   🔵 8. DATOS COMPLETOS DEL EXAMEN - CORREGIDO
=========================================================== */
exports.obtenerDatosExamenCompleto = async (req, res) => {
  try {
    const { detalleId } = req.params;
    const pacienteId = req.usuario.id;

    console.log(`📋 Obteniendo datos completos para examen: ${detalleId}, paciente: ${pacienteId}`);

    const detalle = await ExamenPacienteDetalle.findByPk(detalleId, {
      include: [
        {
          model: ExamenPaciente,
          as: 'Cabecera',
          where: { pacienteId },
          include: [{ 
            model: Paciente, 
            as: 'Paciente' 
          }]
        },
        {
          model: Examen,
          as: 'Examen',
          include: [{ 
            model: Area, 
            as: 'Area' 
          }]
        }
      ]
    });

    if (!detalle) {
      return res.status(404).json({ 
        message: 'Examen no encontrado' 
      });
    }

    res.json({
      paciente: detalle.Cabecera?.Paciente,
      examen: detalle.Examen,
      resultados: detalle.resultados,
      plantilla: detalle.parametrosResultados,
      laboratorista: detalle.Laboratorista
    });

  } catch (error) {
    console.error('❌ Error obteniendo datos completos:', error);
    res.status(500).json({ 
      message: 'Error interno', 
      error: error.message 
    });
  }
}; // ✅ CORREGIDO: Este cierre estaba faltando

/* ===========================================================
   🔵 9. VERIFICAR ESTADO PDF ESPECÍFICO - NUEVO MÉTODO
=========================================================== */
exports.verificarEstadoPdf = async (req, res) => {
  try {
    const { examenId } = req.params;
    const pacienteId = req.usuario.id;

    console.log(`🔍 Verificando estado PDF para examen: ${examenId}, paciente: ${pacienteId}`);

    const detalle = await ExamenPacienteDetalle.findOne({
      where: {
        id: examenId
      },
      include: [
        {
          model: ExamenPaciente,
          as: 'Cabecera',
          where: { pacienteId },
          attributes: ['id', 'estadoPago', 'saldoPendiente']
        },
        {
          model: Examen,
          as: 'Examen',
          attributes: ['id','nombre']
        }
      ],
      attributes: ['id', 'estado', 'pdfGenerado', 'fechaGeneracionPdf']
    });

    if (!detalle) {
      return res.status(404).json({ 
        message: 'Examen no encontrado' 
      });
    }

    const orden = detalle.Cabecera;
    const pagoOk = orden.estadoPago === 'pagado' ||
                  (orden.estadoPago === 'parcial' && Number(orden.saldoPendiente) === 0);

    const puedeDescargar = pagoOk && 
                          detalle.estado === "completado" && 
                          detalle.pdfGenerado !== null;

    return res.json({
      examenId: detalle.id,
      nombre: detalle.Examen?.nombre,
      estadoPago: orden.estadoPago,
      estadoExamen: detalle.estado,
      pagoOk,
      completado: detalle.estado === "completado",
      tienePdf: detalle.pdfGenerado !== null,
      pdfSize: detalle.pdfGenerado?.length || 0,
      fechaGeneracionPdf: detalle.fechaGeneracionPdf,
      puedeDescargar,
      condiciones: {
        pagoRequerido: pagoOk,
        examenCompletado: detalle.estado === "completado",
        pdfGenerado: detalle.pdfGenerado !== null
      }
    });

  } catch (error) {
    console.error("❌ Error verificando estado PDF:", error);
    res.status(500).json({ 
      message: 'Error verificando estado PDF', 
      error: error.message 
    });
  }
};