
// ✅ IMPORTACIONES CORRECTAS
const db = require('../models'); // Importa todos los modelos
const { sequelize } = db; // Extrae sequelize
const { ExamenPaciente, ExamenPacienteDetalle, Examen, Subexamen, Pago } = db; // Extrae los modelos
const { Op } = require('sequelize'); // ✅ IMPORTAR Op DIRECTAMENTE


// FUNCIÓN AUXILIAR PARA BUSCAR CABECERAS
const buscarCabecerasPorFecha = async (pacienteId, fecha) => {
  try {
    console.log('🔍 BÚSQUEDA MEJORADA POR FECHA:', { pacienteId, fecha });
    
    let fechaInicio, fechaFin;

    if (fecha.includes('T')) {
      const fechaObj = new Date(fecha);
      fechaInicio = new Date(Date.UTC(
        fechaObj.getUTCFullYear(),
        fechaObj.getUTCMonth(),
        fechaObj.getUTCDate(),
        0, 0, 0, 0
      ));
      fechaFin = new Date(Date.UTC(
        fechaObj.getUTCFullYear(),
        fechaObj.getUTCMonth(),
        fechaObj.getUTCDate(),
        23, 59, 59, 999
      ));
    } else {
      fechaInicio = new Date(fecha + 'T00:00:00.000Z');
      fechaFin = new Date(fecha + 'T23:59:59.999Z');
    }

    const cabeceras = await ExamenPaciente.findAll({
      where: {
        pacienteId: pacienteId,
        fechaAsignacion: {
          [Op.between]: [fechaInicio, fechaFin]
        }
      },
      include: [
        {
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
      order: [['fechaAsignacion', 'DESC']]
    });

    console.log(`✅ BÚSQUEDA COMPLETADA: ${cabeceras.length} cabeceras encontradas`);
    return cabeceras;
    
  } catch (error) {
    console.error('❌ Error en buscarCabecerasPorFecha:', error);
    throw error;
  }
};

// ACTUALIZAR ESTADO DE PAGO
const actualizarEstadoPago = async (req, res) => {
  try {
    const { examenPacienteId } = req.params;
    const { estadoPago, metodoPago, abono } = req.body;

    console.log('🔍 BACKEND - INICIANDO ACTUALIZACIÓN DE PAGO');
    console.log('📦 Datos recibidos:', { 
      examenPacienteId, 
      estadoPago, 
      metodoPago, 
      abono 
    });

    const examenPaciente = await ExamenPaciente.findByPk(examenPacienteId);

    if (!examenPaciente) {
      console.log('❌ Examen no encontrado con ID:', examenPacienteId);
      return res.status(404).json({ error: 'Examen no encontrado' });
    }

    const precioTotal = parseFloat(examenPaciente.precio) || 0;
    const nuevoAbono = parseFloat(abono) || 0;
    const saldoPendiente = precioTotal - nuevoAbono;

    let estadoPagoFinal;
    if (saldoPendiente <= 0) {
      estadoPagoFinal = 'pagado';
    } else if (nuevoAbono > 0) {
      estadoPagoFinal = 'abono';
    } else {
      estadoPagoFinal = 'pendiente';
    }

    const updateData = { 
      estadoPago: estadoPagoFinal,
      metodoPago: metodoPago || 'efectivo',
      abono: nuevoAbono
    };

    await examenPaciente.update(updateData);

    const examenActualizado = await ExamenPaciente.findByPk(examenPacienteId);
    
    res.json({ 
      success: true,
      message: 'Estado de pago actualizado correctamente',
      examen: examenActualizado
    });
    
  } catch (error) {
    console.error('❌ ERROR CRÍTICO al actualizar estado de pago:', error);
    res.status(500).json({ 
      success: false,
      mensaje: 'Error al actualizar estado de pago',
      error: error.message 
    });
  }
};

// REGISTRAR ABONO
const registrarAbono = async (req, res) => {
  const { id } = req.params;
  const { monto } = req.body;

  try {
    const item = await ExamenPaciente.findByPk(id);
    if (!item) return res.status(404).json({ message: 'No encontrado' });

    const abonoActual = parseFloat(item.abono || 0);
    const nuevoAbono = abonoActual + parseFloat(monto || 0);
    item.abono = nuevoAbono;

    const precio = parseFloat(item.precio || 0);
    if (nuevoAbono + 1e-6 >= precio) {
      item.estadoPago = 'pagado';
    }

    await item.save();
    res.json({ message: '💸 Abono registrado', examen: item });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Error al registrar abono' });
  }
};

// PROCESAR PAGOS MÚLTIPLES
const procesarPagosMultiples = async (req, res) => {
  const { examenes, montoTotal, metodoPago } = req.body;

  try {
    console.log('💰 Procesando pagos múltiples:', { examenes, montoTotal, metodoPago });

    const resultados = [];
    
    for (const examenData of examenes) {
      const { examenPacienteId, monto } = examenData;
      
      const examenPaciente = await ExamenPaciente.findByPk(examenPacienteId);
      if (!examenPaciente) {
        resultados.push({ examenPacienteId, success: false, error: 'Examen no encontrado' });
        continue;
      }

      const precioTotal = parseFloat(examenPaciente.precio) || 0;
      const abonoActual = parseFloat(examenPaciente.abono) || 0;
      const nuevoAbono = abonoActual + parseFloat(monto);
      
      let estadoPagoFinal;
      if (nuevoAbono >= precioTotal) {
        estadoPagoFinal = 'pagado';
      } else if (nuevoAbono > 0) {
        estadoPagoFinal = 'abono';
      } else {
        estadoPagoFinal = 'pendiente';
      }

      await examenPaciente.update({
        estadoPago: estadoPagoFinal,
        metodoPago: metodoPago,
        abono: nuevoAbono
      });

      resultados.push({ 
        examenPacienteId, 
        success: true, 
        nuevoEstado: estadoPagoFinal,
        nuevoAbono 
      });
    }

    res.json({
      message: 'Pagos procesados correctamente',
      resultados,
      totalProcesado: resultados.filter(r => r.success).length
    });

  } catch (error) {
    console.error('❌ Error al procesar pagos múltiples:', error);
    res.status(500).json({ mensaje: 'Error al procesar pagos múltiples', error: error.message });
  }
};



// OBTENER DETALLE GRUPO PAGO
const obtenerDetalleGrupoPago = async (req, res) => {
  try {
    const { pacienteId, fecha } = req.params;
    
    console.log('📋 OBTENIENDO DETALLE GRUPO PAGO:', { pacienteId, fecha });

    if (!fecha || fecha.length !== 10) {
      return res.status(400).json({
        success: false,
        mensaje: 'Formato de fecha inválido. Use YYYY-MM-DD'
      });
    }

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
      include: [
        {
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
      ]
    });

    if (!cabeceras || cabeceras.length === 0) {
      return res.status(404).json({
        success: false,
        mensaje: 'No se encontraron exámenes para la fecha especificada'
      });
    }

    res.json({
      success: true,
      grupo: {
        fecha,
        pacienteId,
        cabeceras: cabeceras.map(cab => ({
          id: cab.id,
          fecha: cab.fechaAsignacion,
          precioTotal: cab.precioTotal,
          abono: cab.abono,
          saldoPendiente: (cab.precioTotal || 0) - (cab.abono || 0),
          estadoPago: cab.estadoPago,
          detalles: cab.Detalles ? cab.Detalles.map(det => ({
            id: det.id,
            examenNombre: det.Examen?.nombre,
            areaNombre: det.Examen?.Area?.nombre,
            precio: det.precioAplicado,
            tipo: det.Examen ? 'examen' : 'subexamen'
          })) : []
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error en obtenerDetalleGrupoPago:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor',
      error: error.message
    });
  }
};

// DIAGNÓSTICO FECHAS PAGO
const diagnosticarFechasPago = async (req, res) => {
  try {
    const { pacienteId, fecha } = req.params;
    
    console.log('🔍 DIAGNÓSTICO FECHAS PAGO:', { pacienteId, fecha });

    const todasCabeceras = await ExamenPaciente.findAll({
      where: { pacienteId },
      attributes: ['id', 'fechaAsignacion', 'precioTotal', 'abono', 'estadoPago'],
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
      attributes: ['id', 'fechaAsignacion', 'precioTotal', 'abono', 'estadoPago']
    });

    res.json({
      success: true,
      diagnostico: {
        fechaSolicitada: fecha,
        totalCabecerasPaciente: todasCabeceras.length,
        cabecerasEnFecha: cabeceras.length,
        todasCabeceras: todasCabeceras.map(cab => ({
          id: cab.id,
          fechaAsignacion: cab.fechaAsignacion,
          fechaLocal: new Date(cab.fechaAsignacion).toLocaleDateString('es-EC'),
          precioTotal: cab.precioTotal,
          abono: cab.abono,
          estadoPago: cab.estadoPago
        })),
        cabecerasEncontradas: cabeceras.map(cab => ({
          id: cab.id,
          fechaAsignacion: cab.fechaAsignacion,
          precioTotal: cab.precioTotal,
          abono: cab.abono,
          estadoPago: cab.estadoPago
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error en diagnóstico fechas:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// DIAGNÓSTICO COMPLETO PAGO
const diagnosticoCompletoPago = async (req, res) => {
  try {
    const { pacienteId, fecha } = req.params;
    
    console.log('🩺 DIAGNÓSTICO COMPLETO PAGO:', { pacienteId, fecha });

    const paciente = await Paciente.findByPk(pacienteId);
    if (!paciente) {
      return res.status(404).json({
        success: false,
        mensaje: 'Paciente no encontrado'
      });
    }

    const todasCabeceras = await ExamenPaciente.findAll({
      where: { pacienteId },
      include: [{
        model: ExamenPacienteDetalle,
        as: 'Detalles'
      }],
      order: [['fechaAsignacion', 'DESC']]
    });

    const cabecerasEnFecha = await buscarCabecerasPorFecha(pacienteId, fecha);

    res.json({
      success: true,
      diagnostico: {
        paciente: {
          id: paciente.id,
          nombre: `${paciente.nombres} ${paciente.apellidos}`
        },
        fechaSolicitada: fecha,
        totalCabeceras: todasCabeceras.length,
        cabecerasEnFecha: cabecerasEnFecha.length,
        todasCabeceras: todasCabeceras.map(cab => ({
          id: cab.id,
          fechaAsignacion: cab.fechaAsignacion,
          fechaLocal: new Date(cab.fechaAsignacion).toLocaleDateString('es-EC'),
          fechaUTC: cab.fechaAsignacion,
          precioTotal: cab.precioTotal,
          abono: cab.abono,
          estadoPago: cab.estadoPago,
          laboratoristaId: cab.laboratoristaId,
          detalles: cab.Detalles?.length || 0
        })),
        cabecerasEncontradas: cabecerasEnFecha.map(cab => ({
          id: cab.id,
          fechaAsignacion: cab.fechaAsignacion,
          precioTotal: cab.precioTotal,
          abono: cab.abono,
          estadoPago: cab.estadoPago
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error en diagnóstico completo:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};



// ✅ CONTROLADOR CORREGIDO PARA PROCESAR PAGO GRUPAL
const procesarPagoGrupal = async (req, res) => {
  let transaction;
  
  try {
    console.log('🔄 Iniciando transacción...');
    transaction = await sequelize.transaction();
    
    const { pacienteId, fecha, montoTotal, metodoPago, laboratoristaId } = req.body;
    
    console.log('💰 BACKEND - PROCESANDO PAGO GRUPAL:', {
      pacienteId, 
      fecha, 
      montoTotal, 
      metodoPago, 
      laboratoristaId
    });

    // ✅ VALIDACIONES BÁSICAS
    if (!pacienteId || !fecha || !montoTotal || !metodoPago) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        mensaje: 'Datos incompletos. Se requieren: pacienteId, fecha, montoTotal, metodoPago'
      });
    }

    if (montoTotal <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        mensaje: 'El monto debe ser mayor a cero'
      });
    }

    // ✅ CORREGIR MANEJO DE FECHAS - VERSIÓN MEJORADA
    console.log('📅 FECHA RECIBIDA:', fecha);
    
    // Crear fecha en UTC para evitar problemas de zona horaria
    const fechaUTC = new Date(fecha + 'T00:00:00.000Z');
    
    // Rango de 24 horas en UTC
    const fechaInicio = new Date(fechaUTC);
    const fechaFin = new Date(fechaUTC);
    fechaFin.setDate(fechaFin.getDate() + 1);
    fechaFin.setMilliseconds(fechaFin.getMilliseconds() - 1);

    console.log('🔍 FECHAS CORREGIDAS PARA BÚSQUEDA:', {
      fechaRecibida: fecha,
      fechaInicio: fechaInicio.toISOString(),
      fechaFin: fechaFin.toISOString(),
      fechaInicioLocal: new Date(fechaInicio).toString(),
      fechaFinLocal: new Date(fechaFin).toString()
    });

    // ✅ BUSCAR EXAMENES PACIENTE CON FECHAS CORREGIDAS
    const examenesPaciente = await ExamenPaciente.findAll({
      where: { 
        pacienteId: pacienteId,
        fechaAsignacion: {
          [Op.between]: [fechaInicio, fechaFin]
        }
      },
      include: [
        {
          model: ExamenPacienteDetalle,
          as: 'Detalles'
        }
      ],
      transaction
    });

    console.log(`🔍 ExamenesPaciente encontrados: ${examenesPaciente.length}`);
    
    // ✅ DEBUG: Mostrar las fechas de los exámenes encontrados
    if (examenesPaciente.length > 0) {
      examenesPaciente.forEach((examen, index) => {
        console.log(`📋 Examen ${index + 1}:`, {
          id: examen.id,
          fechaAsignacion: examen.fechaAsignacion,
          fechaAsignacionISO: examen.fechaAsignacion.toISOString(),
          fechaAsignacionLocal: new Date(examen.fechaAsignacion).toString(),
          total: examen.total
        });
      });
    } else {
      // ✅ DEBUG ADICIONAL: Buscar todos los exámenes del paciente para debug
      const todosExamenes = await ExamenPaciente.findAll({
        where: { pacienteId: pacienteId },
        attributes: ['id', 'fechaAsignacion', 'total'],
        order: [['fechaAsignacion', 'DESC']],
        limit: 10
      });
      
      console.log('🔍 ÚLTIMOS 10 EXÁMENES DEL PACIENTE:');
      todosExamenes.forEach(examen => {
        console.log(`   - ID: ${examen.id}, Fecha: ${examen.fechaAsignacion}, FechaLocal: ${new Date(examen.fechaAsignacion).toString()}, Total: $${examen.total}`);
      });
    }

    if (examenesPaciente.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        mensaje: `No se encontraron exámenes para el paciente ${pacienteId} en la fecha ${fecha}. Verifique la fecha.`
      });
    }

    // ✅ CALCULAR TOTALES
    let totalGrupo = 0;
    let abonoActual = 0;
    let saldoPendienteActual = 0;
    
    for (const examenPaciente of examenesPaciente) {
      totalGrupo += parseFloat(examenPaciente.total || 0);
      abonoActual += parseFloat(examenPaciente.abono || 0);
      saldoPendienteActual += parseFloat(examenPaciente.saldoPendiente || 0);
    }

    console.log('📊 TOTALES CALCULADOS:', {
      totalGrupo, 
      abonoActual, 
      saldoPendienteActual, 
      montoTotal
    });

    // ✅ VALIDAR MONTO
    if (parseFloat(montoTotal) > saldoPendienteActual) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        mensaje: `El monto a pagar ($${montoTotal}) no puede ser mayor al saldo pendiente ($${saldoPendienteActual.toFixed(2)})`
      });
    }

    // ✅ ACTUALIZAR EXAMENES PACIENTE
    const montoPago = parseFloat(montoTotal);
    const nuevoAbonoTotal = abonoActual + montoPago;
    const nuevoSaldoPendiente = Math.max(0, saldoPendienteActual - montoPago);
    
    console.log('🔄 ACTUALIZANDO EXAMENES:', {
      examenesCount: examenesPaciente.length,
      montoPago,
      nuevoAbonoTotal,
      nuevoSaldoPendiente
    });

    // Si el monto cubre exactamente el saldo pendiente, distribuir proporcionalmente
    for (const examenPaciente of examenesPaciente) {
      const saldoExamenActual = parseFloat(examenPaciente.saldoPendiente || 0);
      
      if (saldoExamenActual > 0) {
        const proporcion = saldoExamenActual / saldoPendienteActual;
        const abonoParaEsteExamen = montoPago * proporcion;
        const nuevoAbonoExamen = parseFloat(examenPaciente.abono || 0) + abonoParaEsteExamen;
        const nuevoSaldoExamen = Math.max(0, parseFloat(examenPaciente.total) - nuevoAbonoExamen);
        
        // Determinar estado
        let estadoPago = 'parcial';
        if (nuevoSaldoExamen <= 0.01) { // Tolerancia para decimales
          estadoPago = 'pagado';
        } else if (nuevoAbonoExamen === 0) {
          estadoPago = 'pendiente';
        }

        await examenPaciente.update({
          abono: parseFloat(nuevoAbonoExamen.toFixed(2)),
          saldoPendiente: parseFloat(nuevoSaldoExamen.toFixed(2)),
          estadoPago: estadoPago,
          metodoPago: metodoPago // Actualizar método de pago también
        }, { transaction });

        console.log(`✅ ExamenPaciente ${examenPaciente.id} actualizado:`, {
          abono: nuevoAbonoExamen.toFixed(2),
          saldo: nuevoSaldoExamen.toFixed(2),
          estado: estadoPago
        });
      }
    }

    // ✅ REGISTRAR PAGO (OPCIONAL)
    let nuevoPago = null;
    try {
      if (sequelize.models.Pago) {
        nuevoPago = await Pago.create({
          pacienteId: pacienteId,
          monto: montoPago,
          metodoPago: metodoPago,
          fechaPago: new Date(),
          laboratoristaId: laboratoristaId || 1,
          tipoPago: 'grupal',
          referencia: `Pago grupal - ${fecha}`,
          estado: 'completado'
        }, { transaction });
        console.log('💰 Pago registrado:', nuevoPago.id);
      }
    } catch (pagoError) {
      console.warn('⚠️ No se pudo registrar en tabla Pago:', pagoError.message);
    }

    // ✅ CONFIRMAR TRANSACCIÓN
    await transaction.commit();
    console.log('✅ Transacción completada exitosamente');

    // ✅ RESPUESTA EXITOSA
    res.json({
      success: true,
      mensaje: `Pago de $${montoTotal} procesado exitosamente. Saldo pendiente: $${nuevoSaldoPendiente.toFixed(2)}`,
      grupo: {
        total: totalGrupo,
        abono: nuevoAbonoTotal,
        pendiente: nuevoSaldoPendiente,
        estadoPago: nuevoSaldoPendiente <= 0 ? 'pagado' : 'parcial',
        examenesPaciente: examenesPaciente.length
      },
      saldoActualizado: nuevoSaldoPendiente
    });

  } catch (error) {
    // ✅ REVERTIR EN CASO DE ERROR
    if (transaction) {
      await transaction.rollback();
      console.log('🔴 Transacción revertida');
    }
    
    console.error('❌ Error en procesarPagoGrupal:', error);
    
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor al procesar el pago',
      error: error.message
    });
  }
};

// ✅ CONTROLADOR CORREGIDO PARA RESUMEN GRUPAL
const obtenerResumenGrupalPorFecha = async (req, res) => {
  try {
    const { pacienteId, fecha } = req.params;
    
    console.log('📊 OBTENIENDO RESUMEN GRUPAL:', { pacienteId, fecha });
    
    // ✅ CORREGIR MANEJO DE FECHAS - VERSIÓN MEJORADA
    const fechaUTC = new Date(fecha + 'T00:00:00.000Z');
    
    const fechaInicio = new Date(fechaUTC);
    const fechaFin = new Date(fechaUTC);
    fechaFin.setDate(fechaFin.getDate() + 1);
    fechaFin.setMilliseconds(fechaFin.getMilliseconds() - 1);

    console.log('🔍 FECHAS CORREGIDAS PARA BÚSQUEDA:', {
      fechaRecibida: fecha,
      fechaInicio: fechaInicio.toISOString(),
      fechaFin: fechaFin.toISOString(),
      fechaInicioLocal: new Date(fechaInicio).toString(),
      fechaFinLocal: new Date(fechaFin).toString()
    });

    const examenesPaciente = await ExamenPaciente.findAll({
      where: { 
        pacienteId: pacienteId,
        fechaAsignacion: {
          [Op.between]: [fechaInicio, fechaFin]
        }
      }
    });

    console.log(`📊 Exámenes encontrados: ${examenesPaciente.length}`);

    let total = 0;
    let abono = 0;
    let pendiente = 0;
    
    for (const examen of examenesPaciente) {
      total += parseFloat(examen.total || 0);
      abono += parseFloat(examen.abono || 0);
      pendiente += parseFloat(examen.saldoPendiente || 0);
    }

    const estadoPago = pendiente <= 0 ? 'pagado' : (abono > 0 ? 'parcial' : 'pendiente');

    console.log('📈 RESUMEN CALCULADO:', { total, abono, pendiente, estadoPago });

    res.json({
      success: true,
      grupo: {
        total,
        abono,
        pendiente,
        estadoPago: estadoPago,
        cantidadExamenes: examenesPaciente.length
      }
    });

  } catch (error) {
    console.error('❌ Error en obtenerResumenGrupalPorFecha:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al obtener resumen grupal',
      error: error.message
    });
  }
};

module.exports = {
  actualizarEstadoPago,
  registrarAbono,
  procesarPagosMultiples,
  procesarPagoGrupal,
  obtenerResumenGrupalPorFecha,
  obtenerDetalleGrupoPago,
  diagnosticarFechasPago,
  diagnosticoCompletoPago,
  buscarCabecerasPorFecha
};