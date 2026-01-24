// controllers/pagos.controller.js  ✅ COMPLETO Y CORREGIDO (SIN INCONSISTENCIAS)

const db = require('../models');
const { sequelize } = db;
const { ExamenPaciente, ExamenPacienteDetalle, Examen, Area, Pago, Paciente } = db;
const { Op } = require('sequelize');

// =========================
// ✅ HELPERS NUMÉRICOS
// =========================
const toNum = (v) => {
  const n = Number(String(v ?? 0).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

// =========================
// ✅ HELPERS DE FECHA (GRUPOS)
// =========================
// fecha viene como 'YYYY-MM-DD'
const TZ = 'America/Guayaquil';

const whereByDate = (fecha) => ([
  sequelize.where(
    sequelize.fn('DATE', sequelize.literal(`"fechaAsignacion" AT TIME ZONE '${TZ}'`)),
    fecha
  )
]);

// =========================
// ✅ FUNCIÓN AUXILIAR: CALCULAR SALDOS
// =========================
const calcularSaldos = (total, abono) => {
  const totalNum = round2(toNum(total));
  const abonoNum = round2(toNum(abono));
  const pendiente = round2(Math.max(0, totalNum - abonoNum));

  let estadoPago = 'pendiente';
  if (pendiente <= 0.01) estadoPago = 'pagado';
  else if (abonoNum > 0) estadoPago = 'abono';

  return { total: totalNum, abono: abonoNum, pendiente, estadoPago };
};

// =========================
// ✅ (OPCIONAL RECOMENDADO) Recalcular saldoPendiente/estadoPago de una cabecera
// =========================
const recalcularCabecera = async (examenPacienteId) => {
  const cab = await ExamenPaciente.findByPk(examenPacienteId);
  if (!cab) return null;

  const total = round2(toNum(cab.total));
  const abono = round2(toNum(cab.abono));
  const saldos = calcularSaldos(total, abono);

  await cab.update({
    saldoPendiente: saldos.pendiente,
    estadoPago: saldos.estadoPago,
  });

  return saldos;
};

// =======================================================
// ✅ PROCESAR PAGOS MÚLTIPLES (varias cabeceras)
// Body: { examenes: [{examenPacienteId, monto}], metodoPago }
// =======================================================
const procesarPagosMultiples = async (req, res) => {
  const { examenes, metodoPago } = req.body;

  try {
    if (!Array.isArray(examenes) || examenes.length === 0) {
      return res.status(400).json({ success: false, mensaje: 'Lista de exámenes inválida' });
    }

    const resultados = [];

    for (const examenData of examenes) {
      const { examenPacienteId, monto } = examenData;

      const cab = await ExamenPaciente.findByPk(examenPacienteId);
      if (!cab) {
        resultados.push({ examenPacienteId, success: false, error: 'Examen no encontrado' });
        continue;
      }

      const total = round2(toNum(cab.total));
      const abonoActual = round2(toNum(cab.abono));
      const montoNum = round2(toNum(monto));

      if (montoNum <= 0) {
        resultados.push({ examenPacienteId, success: false, error: 'Monto inválido' });
        continue;
      }

      const saldoPendienteActual = round2(Math.max(0, total - abonoActual));
      if (montoNum > saldoPendienteActual + 0.01) {
        resultados.push({
          examenPacienteId,
          success: false,
          error: `El monto excede saldo pendiente ($${saldoPendienteActual.toFixed(2)})`
        });
        continue;
      }

      const nuevoAbono = round2(abonoActual + montoNum);
      const saldos = calcularSaldos(total, nuevoAbono);

      await cab.update({
        abono: saldos.abono,
        saldoPendiente: saldos.pendiente,
        estadoPago: saldos.estadoPago,
        metodoPago: metodoPago || 'efectivo'
      });

      resultados.push({
        examenPacienteId,
        success: true,
        nuevoEstado: saldos.estadoPago,
        total,
        abonoAnterior: abonoActual,
        abonoNuevo: saldos.abono,
        pendiente: saldos.pendiente
      });
    }

    return res.json({
      success: true,
      message: 'Pagos procesados correctamente',
      resultados,
      totalProcesado: resultados.filter(r => r.success).length
    });

  } catch (error) {
    console.error('❌ Error al procesar pagos múltiples:', error);
    return res.status(500).json({ success: false, mensaje: 'Error al procesar pagos múltiples', error: error.message });
  }
};

// =======================================================
// ✅ OBTENER DETALLE GRUPO PAGO (cabeceras + detalles)
// GET /paciente/:pacienteId/grupo-pago/:fecha   fecha=YYYY-MM-DD
// =======================================================
const obtenerDetalleGrupoPago = async (req, res) => {
  try {
    const { pacienteId, fecha } = req.params;

    if (!fecha || fecha.length !== 10) {
      return res.status(400).json({ success: false, mensaje: 'Formato de fecha inválido. Use YYYY-MM-DD' });
    }

    const cabeceras = await ExamenPaciente.findAll({
      where: {
        pacienteId,
        [Op.and]: whereByDate(fecha)
      },
      include: [
        {
          // detalles
          model: ExamenPacienteDetalle,
          as: 'Detalles',
          include: [
            {
              model: Examen,
              as: 'Examen',
              include: [{ model: Area, as: 'Area' }]
            }
          ]
        }
      ],
      order: [['fechaAsignacion', 'ASC']]
    });

    if (!cabeceras || cabeceras.length === 0) {
      return res.status(404).json({ success: false, mensaje: 'No se encontraron exámenes para la fecha especificada' });
    }

    return res.json({
      success: true,
      grupo: {
        fecha,
        pacienteId,
        cabeceras: cabeceras.map(cab => {
          const total = round2(toNum(cab.total));
          const abono = round2(toNum(cab.abono));
          const pendiente = round2(Math.max(0, total - abono));
          return {
            id: cab.id,
            fecha: cab.fechaAsignacion,
            total,
            abono,
            saldoPendiente: pendiente,
            estadoPago: cab.estadoPago,
            detalles: (cab.Detalles || []).map(det => ({
              id: det.id,
              examenNombre: det.Examen?.nombre ?? det.nombreExamen ?? 'Sin nombre',
              areaNombre: det.Examen?.Area?.nombre ?? null,
              precio: round2(toNum(det.precioFinal ?? det.precioAplicado)),
              tipo: det.examenId ? 'examen' : 'subexamen'
            }))
          };
        })
      }
    });

  } catch (error) {
    console.error('❌ Error en obtenerDetalleGrupoPago:', error);
    return res.status(500).json({ success: false, mensaje: 'Error interno del servidor', error: error.message });
  }
};

// =======================================================
// ✅ ACTUALIZAR ESTADO DE PAGO INDIVIDUAL (SET)
// PUT /examen/:examenPacienteId/pago  Body: { abono, metodoPago }
// OJO: aquí "abono" es el abono TOTAL final, no incremental.
// =======================================================
const actualizarEstadoPago = async (req, res) => {
  try {
    const { examenPacienteId } = req.params;
    const { metodoPago, abono } = req.body;

    const cab = await ExamenPaciente.findByPk(examenPacienteId);
    if (!cab) return res.status(404).json({ success: false, error: 'Examen no encontrado' });

    const total = round2(toNum(cab.total));
    const abonoTotal = round2(toNum(abono));

    if (abonoTotal < 0) {
      return res.status(400).json({ success: false, mensaje: 'El abono no puede ser negativo' });
    }
    if (abonoTotal > total + 0.01) {
      return res.status(400).json({ success: false, mensaje: 'El abono excede el total', total });
    }

    const saldos = calcularSaldos(total, abonoTotal);

    await cab.update({
      abono: saldos.abono,
      saldoPendiente: saldos.pendiente,
      estadoPago: saldos.estadoPago,
      metodoPago: metodoPago || 'efectivo'
    });

    const actualizado = await ExamenPaciente.findByPk(examenPacienteId);

    return res.json({
      success: true,
      message: 'Estado de pago actualizado correctamente',
      examen: actualizado,
      saldos
    });

  } catch (error) {
    console.error('❌ ERROR al actualizar estado de pago:', error);
    return res.status(500).json({ success: false, mensaje: 'Error al actualizar estado de pago', error: error.message });
  }
};

// =======================================================
// ✅ REGISTRAR ABONO INDIVIDUAL (INCREMENTAL)
// POST /examen/:id/abono   Body: { monto }
// =======================================================
const registrarAbono = async (req, res) => {
  const { id } = req.params;
  const { monto } = req.body;

  try {
    const cab = await ExamenPaciente.findByPk(id);
    if (!cab) return res.status(404).json({ success: false, message: 'Examen no encontrado' });

    const total = round2(toNum(cab.total));
    const abonoActual = round2(toNum(cab.abono));
    const montoNum = round2(toNum(monto));

    if (montoNum <= 0) {
      return res.status(400).json({ success: false, message: 'El monto debe ser mayor a 0' });
    }

    const saldoPendienteActual = round2(Math.max(0, total - abonoActual));
    if (montoNum > saldoPendienteActual + 0.01) {
      return res.status(400).json({
        success: false,
        message: `El monto ($${montoNum.toFixed(2)}) excede el saldo pendiente ($${saldoPendienteActual.toFixed(2)})`,
        saldoPendiente: saldoPendienteActual
      });
    }

    const nuevoAbono = round2(abonoActual + montoNum);
    const saldos = calcularSaldos(total, nuevoAbono);

    await cab.update({
      abono: saldos.abono,
      saldoPendiente: saldos.pendiente,
      estadoPago: saldos.estadoPago
    });

    // (opcional) registrar Pago individual si quieres llevar historial
    // await Pago.create({ pacienteId: cab.pacienteId, examenPacienteId: cab.id, monto: montoNum, metodoPago: 'efectivo', tipo: 'individual' })

    return res.json({
      success: true,
      message: 'Abono registrado exitosamente',
      examen: cab,
      saldos
    });

  } catch (error) {
    console.error('❌ Error al registrar abono:', error);
    return res.status(500).json({ success: false, message: 'Error al registrar abono', error: error.message });
  }
};

// =======================================================
// ✅ OBTENER RESUMEN GRUPAL POR FECHA
// GET /paciente/:pacienteId/resumen-grupal/:fecha
// =======================================================
const obtenerResumenGrupalPorFecha = async (req, res) => {
  try {
    const { pacienteId, fecha } = req.params;

    const cabeceras = await ExamenPaciente.findAll({
      where: {
        pacienteId,
        [Op.and]: whereByDate(fecha)
      },
      order: [['fechaAsignacion', 'ASC']]
    });

    if (!cabeceras || cabeceras.length === 0) {
      return res.json({
        success: true,
        grupo: {
          total: 0,
          abono: 0,
          pendiente: 0,
          estadoPago: 'pendiente',
          cantidadExamenes: 0,
          fecha,
          examenes: []
        }
      });
    }

    let totalGrupo = 0;
    let abonoGrupo = 0;

    for (const cab of cabeceras) {
      // aseguras consistencia en BD
      await recalcularCabecera(cab.id);

      totalGrupo += round2(toNum(cab.total));
      abonoGrupo += round2(toNum(cab.abono));
    }

    totalGrupo = round2(totalGrupo);
    abonoGrupo = round2(abonoGrupo);

    const pendienteGrupo = round2(Math.max(0, totalGrupo - abonoGrupo));
    const estadoGrupo = calcularSaldos(totalGrupo, abonoGrupo).estadoPago;

    const examenesDetalle = cabeceras.map(cab => {
      const total = round2(toNum(cab.total));
      const abono = round2(toNum(cab.abono));
      const pendiente = round2(Math.max(0, total - abono));
      return {
        id: cab.id,
        fechaAsignacion: cab.fechaAsignacion,
        total,
        abono,
        pendiente,
        estadoPago: cab.estadoPago
      };
    });

    return res.json({
      success: true,
      grupo: {
        total: totalGrupo,
        abono: abonoGrupo,
        pendiente: pendienteGrupo,
        estadoPago: estadoGrupo,
        cantidadExamenes: cabeceras.length,
        fecha,
        examenes: examenesDetalle,
        resumen: `$${abonoGrupo.toFixed(2)} / $${totalGrupo.toFixed(2)}`
      }
    });

  } catch (error) {
    console.error('❌ Error en obtenerResumenGrupalPorFecha:', error);
    return res.status(500).json({ success: false, mensaje: 'Error al obtener resumen grupal', error: error.message });
  }
};

// =======================================================
// ✅ PROCESAR PAGO GRUPAL (por fecha)
// POST /procesar-pago-grupal
// Body: { pacienteId, fechaGrupo, montoTotal, metodoPago, laboratoristaId }
// Distribución: "por orden" (primero completa cabecera A, luego B...)
// =======================================================
const procesarPagoGrupal = async (req, res) => {
  try {
    const { pacienteId, fechaGrupo, montoTotal, metodoPago, laboratoristaId } = req.body;

    if (!pacienteId || !fechaGrupo) {
      return res.status(400).json({ success: false, mensaje: 'pacienteId y fechaGrupo son obligatorios' });
    }

    let montoPagado = round2(toNum(montoTotal));
    if (montoPagado <= 0) {
      return res.status(400).json({ success: false, mensaje: 'El monto debe ser mayor a 0' });
    }

    const cabeceras = await ExamenPaciente.findAll({
      where: {
        pacienteId,
        [Op.and]: whereByDate(fechaGrupo)
      },
      order: [['fechaAsignacion', 'ASC']]
    });

    if (!cabeceras || cabeceras.length === 0) {
      return res.status(404).json({ success: false, mensaje: `No se encontraron exámenes para la fecha ${fechaGrupo}` });
    }

    // recalcular cabeceras (por si hubo nuevos detalles/exámenes)
    for (const cab of cabeceras) await recalcularCabecera(cab.id);

    // saldo pendiente real del grupo
    let totalGrupo = 0;
    let abonoGrupo = 0;

    for (const cab of cabeceras) {
      totalGrupo += round2(toNum(cab.total));
      abonoGrupo += round2(toNum(cab.abono));
    }

    totalGrupo = round2(totalGrupo);
    abonoGrupo = round2(abonoGrupo);

    const saldoPendienteGrupo = round2(Math.max(0, totalGrupo - abonoGrupo));

    if (montoPagado > saldoPendienteGrupo + 0.01) {
      return res.status(400).json({
        success: false,
        mensaje: `El monto pagado ($${montoPagado.toFixed(2)}) excede el saldo pendiente ($${saldoPendienteGrupo.toFixed(2)})`,
        saldoPendiente: saldoPendienteGrupo,
        puedePagarMaximo: saldoPendienteGrupo
      });
    }

    // distribuir pago por orden
    const examenesActualizados = [];
    let montoRestante = montoPagado;

    for (const cab of cabeceras) {
      if (montoRestante <= 0) break;

      const total = round2(toNum(cab.total));
      const abonoActual = round2(toNum(cab.abono));
      const pendiente = round2(Math.max(0, total - abonoActual));

      if (pendiente <= 0.01) continue;

      const aplicar = round2(Math.min(pendiente, montoRestante));
      const nuevoAbono = round2(abonoActual + aplicar);
      const saldos = calcularSaldos(total, nuevoAbono);

      await cab.update({
        abono: saldos.abono,
        saldoPendiente: saldos.pendiente,
        estadoPago: saldos.estadoPago,
        metodoPago: metodoPago || 'efectivo'
      });

      examenesActualizados.push({
        id: cab.id,
        total,
        abonoAnterior: abonoActual,
        abonoNuevo: saldos.abono,
        pendiente: saldos.pendiente,
        estadoPago: saldos.estadoPago,
        montoAsignado: aplicar
      });

      montoRestante = round2(montoRestante - aplicar);
    }

    // registrar pago (historial)
    const pago = await Pago.create({
      pacienteId,
      laboratoristaId: laboratoristaId || null,
      monto: montoPagado,
      metodoPago: metodoPago || 'efectivo',
      tipo: 'grupal',
      estado: 'completado',
      fechaPago: new Date(),
      referencia: `Pago grupal ${fechaGrupo} - ${cabeceras.length} cabeceras`
    });

    // recalcular totales verificados
    const cabecerasVer = await ExamenPaciente.findAll({
      where: { pacienteId, [Op.and]: whereByDate(fechaGrupo) }
    });

    let totalVer = 0;
    let abonoVer = 0;
    for (const cab of cabecerasVer) {
      totalVer += round2(toNum(cab.total));
      abonoVer += round2(toNum(cab.abono));
    }
    totalVer = round2(totalVer);
    abonoVer = round2(abonoVer);

    const pendienteVer = round2(Math.max(0, totalVer - abonoVer));
    const estadoFinal = calcularSaldos(totalVer, abonoVer).estadoPago;

    return res.json({
      success: true,
      mensaje: `Pago de $${montoPagado.toFixed(2)} registrado exitosamente`,
      pago: {
        id: pago.id,
        monto: toNum(pago.monto),
        metodoPago: pago.metodoPago,
        fechaPago: pago.fechaPago
      },
      grupo: {
        fecha: fechaGrupo,
        estadoPago: estadoFinal,
        financiero: {
          total: totalVer,
          abonado: abonoVer,
          pendiente: pendienteVer
        },
        cabeceras: cabecerasVer.length
      },
      cabecerasActualizadas: examenesActualizados,
      resumen: {
        antes: { total: totalGrupo, abono: abonoGrupo, pendiente: saldoPendienteGrupo },
        despues: { total: totalVer, abono: abonoVer, pendiente: pendienteVer }
      }
    });

  } catch (error) {
    console.error('❌ ERROR en procesarPagoGrupal:', error);
    return res.status(500).json({ success: false, mensaje: 'Error interno al procesar pago grupal', error: error.message });
  }
};

// =======================================================
// ✅ OBTENER DATOS ACTUALIZADOS (grupo por fecha)
// GET /pacientes/:pacienteId/fecha/:fecha/datos-actualizados
// =======================================================
const obtenerDatosActualizados = async (req, res) => {
  try {
    const { pacienteId, fecha } = req.params;

    const cabeceras = await ExamenPaciente.findAll({
      where: {
        pacienteId,
        [Op.and]: whereByDate(fecha)
      },
      order: [['fechaAsignacion', 'ASC']]
    });

    // recalcular cada cabecera por consistencia
    for (const cab of cabeceras) await recalcularCabecera(cab.id);

    let total = 0;
    let abono = 0;

    for (const cab of cabeceras) {
      total += round2(toNum(cab.total));
      abono += round2(toNum(cab.abono));
    }

    total = round2(total);
    abono = round2(abono);

    const pendiente = round2(Math.max(0, total - abono));
    const estadoPago = calcularSaldos(total, abono).estadoPago;

    return res.json({
      success: true,
      datos: {
        total,
        abono,
        pendiente,
        estadoPago,
        cantidadExamenes: cabeceras.length,
        examenes: cabeceras.map(cab => {
          const t = round2(toNum(cab.total));
          const a = round2(toNum(cab.abono));
          return {
            id: cab.id,
            total: t,
            abono: a,
            saldoPendiente: round2(Math.max(0, t - a)),
            estadoPago: cab.estadoPago,
            fecha: cab.fechaAsignacion
          };
        }),
        fechaConsulta: fecha
      }
    });

  } catch (error) {
    console.error('❌ Error en obtenerDatosActualizados:', error);
    return res.status(500).json({ success: false, mensaje: 'Error obteniendo datos actualizados', error: error.message });
  }
};

// =======================================================
// ✅ DIAGNÓSTICOS (opcionales)
// (Los dejo, pero corregidos a "total" en vez de "precioTotal")
// =======================================================
const buscarCabecerasPorFecha = async (pacienteId, fecha) => {
  const fechaInicio = new Date(fecha + 'T00:00:00.000Z');
  const fechaFin = new Date(fecha + 'T23:59:59.999Z');

  return ExamenPaciente.findAll({
    where: {
      pacienteId,
      fechaAsignacion: { [Op.between]: [fechaInicio, fechaFin] }
    },
    include: [
      {
        model: ExamenPacienteDetalle,
        as: 'Detalles',
        include: [{ model: Examen, as: 'Examen', attributes: ['id', 'nombre'] }]
      }
    ],
    order: [['fechaAsignacion', 'DESC']]
  });
};

const diagnosticarFechasPago = async (req, res) => {
  try {
    const { pacienteId, fecha } = req.params;

    const todasCabeceras = await ExamenPaciente.findAll({
      where: { pacienteId },
      attributes: ['id', 'fechaAsignacion', 'total', 'abono', 'estadoPago'],
      order: [['fechaAsignacion', 'DESC']]
    });

    const cabeceras = await ExamenPaciente.findAll({
      where: { 
        pacienteId,
        fechaAsignacion: {
          [Op.between]: [
            new Date(fecha + 'T00:00:00.000Z'),
            new Date(fecha + 'T23:59:59.999Z')
          ]
        }
      },
      attributes: ['id', 'fechaAsignacion', 'total', 'abono', 'estadoPago']
    });

    return res.json({
      success: true,
      diagnostico: {
        fechaSolicitada: fecha,
        totalCabecerasPaciente: todasCabeceras.length,
        cabecerasEnFecha: cabeceras.length,
        todasCabeceras,
        cabecerasEncontradas: cabeceras
      }
    });

  } catch (error) {
    console.error('❌ Error en diagnóstico fechas:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

const diagnosticoCompletoPago = async (req, res) => {
  try {
    const { pacienteId, fecha } = req.params;

    const paciente = await Paciente.findByPk(pacienteId);
    if (!paciente) {
      return res.status(404).json({ success: false, mensaje: 'Paciente no encontrado' });
    }

    const todasCabeceras = await ExamenPaciente.findAll({
      where: { pacienteId },
      include: [{ model: ExamenPacienteDetalle, as: 'Detalles' }],
      order: [['fechaAsignacion', 'DESC']]
    });

    const cabecerasEnFecha = await buscarCabecerasPorFecha(pacienteId, fecha);

    return res.json({
      success: true,
      diagnostico: {
        paciente: { id: paciente.id, nombre: `${paciente.nombres} ${paciente.apellidos}` },
        fechaSolicitada: fecha,
        totalCabeceras: todasCabeceras.length,
        cabecerasEnFecha: cabecerasEnFecha.length
      }
    });

  } catch (error) {
    console.error('❌ Error en diagnóstico completo:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};


// =======================================================
// 🩺 DIAGNÓSTICO FECHAS PAGO GRUPAL (POST)
// Body: { pacienteId, fecha }
// =======================================================
const diagnosticarFechasPagoGrupal = async (req, res) => {
  try {
    const { pacienteId, fecha } = req.body;

    if (!pacienteId || !fecha) {
      return res.status(400).json({
        success: false,
        mensaje: 'pacienteId y fecha son obligatorios'
      });
    }

    const todos = await ExamenPaciente.findAll({
      where: { pacienteId },
      attributes: ['id', 'fechaAsignacion', 'total', 'abono', 'estadoPago'],
      order: [['fechaAsignacion', 'DESC']]
    });

    const porDATE = await ExamenPaciente.findAll({
      where: {
        pacienteId,
        [Op.and]: [
          sequelize.where(sequelize.fn('DATE', sequelize.col('fechaAsignacion')), fecha)
        ]
      },
      attributes: ['id', 'fechaAsignacion', 'total', 'abono', 'estadoPago'],
      order: [['fechaAsignacion', 'ASC']]
    });

    return res.json({
      success: true,
      diagnostico: {
        pacienteId,
        fechaSolicitada: fecha,
        totalCabecerasPaciente: todos.length,
        cabecerasEnFecha_porDATE: porDATE.length,
        cabecerasEnFecha: porDATE
      }
    });

  } catch (error) {
    console.error('❌ Error en diagnosticarFechasPagoGrupal:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// =======================================================
// 🩺 DIAGNÓSTICO COMPLETO FECHAS (GET)
// =======================================================
const diagnosticoCompletoFechas = async (req, res) => {
  try {
    const { pacienteId } = req.params;

    const cabeceras = await ExamenPaciente.findAll({
      where: { pacienteId },
      attributes: ['id', 'fechaAsignacion', 'total', 'abono', 'estadoPago', 'createdAt', 'updatedAt'],
      order: [['fechaAsignacion', 'DESC']]
    });

    const analisis = cabeceras.map(c => {
      const fa = new Date(c.fechaAsignacion);
      const ca = new Date(c.createdAt);
      return {
        id: c.id,
        fechaAsignacionISO: fa.toISOString(),
        fechaAsignacionLocal: fa.toLocaleString('es-EC'),
        createdAtISO: ca.toISOString(),
        createdAtLocal: ca.toLocaleString('es-EC'),
        total: toNum(c.total),
        abono: toNum(c.abono),
        estadoPago: c.estadoPago
      };
    });

    return res.json({
      success: true,
      diagnostico: {
        pacienteId,
        totalCabeceras: cabeceras.length,
        analisis
      }
    });

  } catch (error) {
    console.error('❌ Error en diagnosticoCompletoFechas:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};


// =======================================================
// ✅ VERIFICAR SALDO (USA MISMA LÓGICA DEL RESUMEN)
// GET /verificar-saldo/:pacienteId/:fecha
// =======================================================
const verificarSaldo = async (req, res) => {
  try {
    const { pacienteId, fecha } = req.params;

    const cabeceras = await ExamenPaciente.findAll({
      where: { pacienteId, [Op.and]: whereByDate(fecha) },
      order: [['fechaAsignacion', 'ASC']]
    });

    let total = 0, abono = 0;

    for (const cab of cabeceras) {
      await recalcularCabecera(cab.id); // asegura consistencia
      total += round2(toNum(cab.total));
      abono += round2(toNum(cab.abono));
    }

    total = round2(total);
    abono = round2(abono);

    const pendiente = round2(Math.max(0, total - abono));
    const estadoPago = calcularSaldos(total, abono).estadoPago;

    return res.json({
  success: true,
  fecha,
  pacienteId,
  encontrado: cabeceras.length > 0,
  total,
  abono,
  pendiente,
  saldoPendiente: pendiente,   // ✅ CLAVE ÚNICA
  estadoPago,
  cabeceras: cabeceras.length
});


  } catch (error) {
    console.error('❌ verificarSaldo:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};



// =======================================================
// ✅ DIAGNÓSTICO PACIENTE (PARA TU FRONT)
// GET /diagnostico-paciente/:pacienteId
// Devuelve últimas cabeceras y fechas reales registradas.
// =======================================================
const diagnosticarPaciente = async (req, res) => {
  try {
    const { pacienteId } = req.params;

    const cabeceras = await ExamenPaciente.findAll({
      where: { pacienteId },
      attributes: ['id', 'fechaAsignacion', 'total', 'abono', 'saldoPendiente', 'estadoPago', 'createdAt'],
      order: [['fechaAsignacion', 'DESC']],
      limit: 30
    });

    return res.json({
      success: true,
      pacienteId,
      totalCabeceras: cabeceras.length,
      cabeceras
    });

  } catch (error) {
    console.error('❌ diagnosticarPaciente:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ SALDO REAL DEL GRUPO (sumando saldoPendiente de cada cabecera)
const verificarSaldoReal = async (req, res) => {
  try {
    const { pacienteId, fecha } = req.params;

    const cabeceras = await ExamenPaciente.findAll({
      where: { pacienteId, [Op.and]: whereByDate(fecha) },
      attributes: ['id', 'total', 'abono', 'saldoPendiente', 'estadoPago', 'fechaAsignacion'],
      order: [['fechaAsignacion', 'ASC']]
    });

    if (!cabeceras.length) {
      return res.status(404).json({ success: false, mensaje: `No se encontraron exámenes para la fecha ${fecha}` });
    }

    const total = round2(cabeceras.reduce((acc, c) => acc + toNum(c.total), 0));
    const abono = round2(cabeceras.reduce((acc, c) => acc + toNum(c.abono), 0));
    const pendienteReal = round2(cabeceras.reduce((acc, c) => acc + toNum(c.saldoPendiente), 0));

    return res.json({
  success: true,
  pacienteId,
  fecha,
  total,
  abono,
  pendienteReal,
  saldoPendiente: pendienteReal, // ✅ CLAVE ÚNICA
  cantidad: cabeceras.length,
  cabeceras
});


  } catch (error) {
    console.error('❌ Error verificarSaldoReal:', error);
    res.status(500).json({ success: false, mensaje: 'Error interno', error: error.message });
  }
};


// =========================
// ✅ EXPORTS
// =========================
module.exports = {
  // principales
  procesarPagosMultiples,
  obtenerDetalleGrupoPago,
  actualizarEstadoPago,
  registrarAbono,
  obtenerResumenGrupalPorFecha,
  procesarPagoGrupal,
  obtenerDatosActualizados,

  // diagnósticos
  diagnosticarFechasPago,
  diagnosticoCompletoPago,
  buscarCabecerasPorFecha,
  verificarSaldo,
verificarSaldoReal,
diagnosticarPaciente,


  // helpers (por si los usas en pruebas)
  calcularSaldos,

  // ✅ AGREGA ESTOS 2
  diagnosticarFechasPagoGrupal,
  diagnosticoCompletoFechas,
};
