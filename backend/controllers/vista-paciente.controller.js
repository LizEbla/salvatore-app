// vista-paciente.controller.js - VERSIÓN COMPLETAMENTE CORREGIDA
const db = require('../models');
const { Sequelize } = db;



const {
  Paciente,
  ExamenPaciente,
  ExamenPacienteDetalle,
  Examen,
  Area,
  Laboratorista // ✅ AÑADIR
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
          // ✅ IMPORTANTE: necesitamos resultados/plantilla en esta respuesta
          attributes: [
            'id',
            'examenId',
            'precioFinal',
            'estado',
            'resultados',
            'parametrosResultados'
          ],
          include: [
            {
              model: Examen,
              as: 'Examen',
              include: [
                {
                  model: Area,
                  as: 'Area',
                  attributes: ['id', 'nombre']
                }
              ],
              attributes: ['id', 'nombre']
            }
          ]
        }
      ],
      order: [
        ['fechaAsignacion', 'DESC'],
        [{ model: ExamenPacienteDetalle, as: 'Detalles' }, 'id', 'ASC']
      ]
    });

    const porFecha = {};

    for (const ord of ordenes) {
      const f = new Date(ord.fechaAsignacion);
      const fechaKey = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-${String(
        f.getDate()
      ).padStart(2, '0')}`;

      if (!porFecha[fechaKey]) {
        porFecha[fechaKey] = {
          fechaISO: fechaKey,
          fechaFormateada: f.toLocaleDateString('es-EC', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          }),
          ordenes: []
        };
      }

      const pagoOk =
        ord.estadoPago === 'pagado' ||
        (ord.estadoPago === 'parcial' && Number(ord.saldoPendiente || 0) === 0);

      const areasMap = {};

      (ord.Detalles || []).forEach((det) => {
        const area = det.Examen?.Area?.nombre || 'Sin Área';

        if (!areasMap[area]) {
          areasMap[area] = {
            nombre: area,
            examenes: []
          };
        }

        // ✅ 1) tieneResultados: objeto con llaves o string no vacío
        const tieneResultados =
          det.resultados &&
          ((typeof det.resultados === 'object' && Object.keys(det.resultados).length > 0) ||
            (typeof det.resultados === 'string' && det.resultados.trim().length > 0));

        // ✅ 2) tienePlantilla (parametrosResultados)
        const tienePlantilla =
          det.parametrosResultados &&
          ((typeof det.parametrosResultados === 'object' &&
            Object.keys(det.parametrosResultados).length > 0) ||
            (typeof det.parametrosResultados === 'string' &&
              det.parametrosResultados.trim().length > 0));

        // ✅ 3) AHORA "puedeVer" ya NO depende de pdfGenerado
        const puedeVer = pagoOk && det.estado === 'completado' && (tieneResultados || tienePlantilla);

        areasMap[area].examenes.push({
          id: det.id,
          examenId: det.examenId,
          nombre: det.Examen?.nombre || 'Examen sin nombre',
          estado: det.estado,
          precio: det.precioFinal,

          // ✅ flags útiles para el frontend
          tieneResultados: !!tieneResultados,
          tienePlantilla: !!tienePlantilla,

          puedeVer,

          debug: {
            pagoOk,
            completado: det.estado === 'completado',
            tieneResultados: !!tieneResultados,
            tienePlantilla: !!tienePlantilla
          }
        });
      });

      porFecha[fechaKey].ordenes.push({
        id: ord.id,
        fecha: ord.fechaAsignacion,
        estadoPago: ord.estadoPago,
        saldoPendiente: ord.saldoPendiente,
        pagoOk,
        areas: Object.values(areasMap)
      });
    }

    return res.json(Object.values(porFecha));
  } catch (error) {
    console.error('❌ Error historial agrupado:', error);
    res.status(500).json({
      message: 'Error obteniendo historial',
      error: error.message
    });
  }
};






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
      attributes: ['id', 'estado', 'fechaGeneracionPdf']
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
                          detalle.estado === "completado";

    return res.json({
      examenId: detalle.id,
      nombre: detalle.Examen?.nombre,
      estadoPago: orden.estadoPago,
      estadoExamen: detalle.estado,
      pagoOk,
      completado: detalle.estado === "completado",
      fechaGeneracionPdf: detalle.fechaGeneracionPdf,
      puedeDescargar,
      condiciones: {
        pagoRequerido: pagoOk,
        examenCompletado: detalle.estado === "completado",
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



exports.obtenerDatosExamenCompleto = async (req, res) => {
  try {
    const { detalleId } = req.params;
    const pacienteId = req.usuario?.id;

    const detalle = await db.ExamenPacienteDetalle.findByPk(detalleId, {
      include: [
        {
          model: db.ExamenPaciente,
          as: 'Cabecera',
          ...(pacienteId ? { where: { pacienteId } } : {}),
          include: [
            { model: db.Paciente, as: 'Paciente' }
          ]
        },
        {
          model: db.Examen,
          as: 'Examen',
          required: false,
          include: [{ model: db.Area, as: 'Area', required: false }]
        },
        {
          model: db.Subexamen,
          as: 'Subexamen',
          required: false,
          include: [
            {
              model: db.Examen,
              as: 'Examen',
              required: false,
              include: [{ model: db.Area, as: 'Area', required: false }]
            }
          ]
        },
        {
          model: db.Laboratorista,
          as: 'Laboratorista',
          attributes: ['id','nombres','apellidos'],
          required: false
        }
      ]
    });

    if (!detalle) return res.status(404).json({ message: 'Examen no encontrado' });

    const safeParse = (v) => {
      if (!v) return null;
      if (typeof v === 'object') return v;
      if (typeof v === 'string') { try { return JSON.parse(v); } catch { return v; } }
      return v;
    };

    const resultados = safeParse(detalle.resultados) || {};
    const plantillaDetalle  = safeParse(detalle.parametrosResultados) || null;

    const examenBase = detalle.Examen || detalle.Subexamen?.Examen || null;

    const plantilla =
      plantillaDetalle ||
      safeParse(examenBase?.parametrosResultados) ||
      safeParse(detalle.Subexamen?.parametrosResultados) ||
      null;

    return res.json({
      detalle,      // ✅ LO MÁS IMPORTANTE
      resultados,
      plantilla
    });

  } catch (error) {
    console.error('❌ Error obteniendo datos completos:', error);
    res.status(500).json({ message: 'Error interno', error: error.message });
  }
};

