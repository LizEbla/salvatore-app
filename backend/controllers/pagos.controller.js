

// ✅ IMPORTACIONES CORRECTAS
const db = require('../models');
const { sequelize } = db;
const { ExamenPaciente, ExamenPacienteDetalle, Examen, Subexamen, Pago, Paciente, Area   } = db;
const { Op } = require('sequelize');




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



// ✅ MÉTODO AUXILIAR para obtener fechas disponibles
const obtenerFechasDisponibles = async (pacienteId) => {
  try {
    const examenes = await ExamenPaciente.findAll({
      where: { pacienteId },
      attributes: ['fechaAsignacion'],
      group: ['fechaAsignacion'],
      raw: true
    });
    
    return examenes.map(e => e.fechaAsignacion.toISOString().split('T')[0]);
  } catch (error) {
    return [];
  }
};


















/////////////////////////////////////////////////////

// ✅ FUNCIÓN AUXILIAR PARA OBTENER PRECIO - COLOCAR AL INICIO DEL ARCHIVO
const obtenerPrecioExamen = (examen) => {
  console.log(`🔍 Calculando precio para examenPaciente ID: ${examen.id}`);
  
  // 1. Intentar obtener precio de ExamenPaciente directamente
  let precio = parseFloat(examen.precioFinal) || parseFloat(examen.precio) || parseFloat(examen.total) || 0;
  
  // 2. Si no tiene precio, buscar en los detalles
  if (precio === 0 && examen.Detalles && examen.Detalles.length > 0) {
    console.log(`📋 Buscando precio en ${examen.Detalles.length} detalles...`);
    
    for (const detalle of examen.Detalles) {
      // Buscar precio en el detalle
      const precioDetalle = parseFloat(detalle.precioFinal) || parseFloat(detalle.precioAplicado) || 0;
      
      if (precioDetalle > 0) {
        precio = precioDetalle;
        console.log(`💰 Precio encontrado en detalle: ${precio}`);
        break;
      }
      
      // Buscar precio en el examen relacionado
      if (detalle.Examen) {
        const precioExamen = parseFloat(detalle.Examen.precio) || 0;
        if (precioExamen > 0) {
          precio = precioExamen;
          console.log(`💰 Precio encontrado en examen relacionado: ${precio}`);
          break;
        }
      }
      
      // Buscar precio en subexamen relacionado
      if (detalle.Subexamen) {
        const precioSubexamen = parseFloat(detalle.Subexamen.precio) || 0;
        if (precioSubexamen > 0) {
          precio = precioSubexamen;
          console.log(`💰 Precio encontrado en subexamen relacionado: ${precio}`);
          break;
        }
      }
    }
  }
  
  // 3. Si aún no hay precio, usar valor por defecto basado en detalles
  if (precio === 0 && examen.Detalles && examen.Detalles.length > 0) {
    precio = examen.Detalles.length * 10; // Precio por defecto
    console.log(`⚠️ Usando precio por defecto: ${precio}`);
  }
  
  console.log(`💰 Examen ${examen.id} - Precio final calculado: ${precio}`);
  return precio;
};


// ✅ FUNCIÓN AUXILIAR PARA BUSCAR CABECERAS (SI LA NECESITAS)
const buscarCabecerasPorFecha = async (pacienteId, fecha) => {
  try {
    console.log('🔍 BÚSQUEDA MEJORADA POR FECHA:', { pacienteId, fecha });
    
    const fechaInicio = new Date(fecha + 'T00:00:00.000Z');
    const fechaFin = new Date(fecha + 'T23:59:59.999Z');

    const cabeceras = await db.ExamenPaciente.findAll({
      where: {
        pacienteId: pacienteId,
        fechaAsignacion: {
          [Op.between]: [fechaInicio, fechaFin]
        }
      },
      include: [
        {
          model: db.ExamenPacienteDetalle,
          as: 'Detalles',
          include: [
            {
              model: db.Examen,
              as: 'Examen',
              attributes: ['id', 'nombre', 'precio']
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


// ✅ FUNCIÓN DE DIAGNÓSTICO DE FECHAS (temporal)
const diagnosticarFechasPagoGrupal = async (req, res) => {
  try {
    const { pacienteId, fecha } = req.body;
    
    console.log('🔍 DIAGNÓSTICO FECHAS PAGO GRUPAL:', { pacienteId, fecha });

    // Buscar TODOS los exámenes del paciente
    const todosExamenes = await db.ExamenPaciente.findAll({
      where: { pacienteId },
      attributes: ['id', 'fechaAsignacion', 'total', 'abono', 'estadoPago'],
      order: [['fechaAsignacion', 'DESC']]
    });

    // Buscar con diferentes formatos de fecha
    const fechaUTCInicio = new Date(fecha + 'T00:00:00.000Z');
    const fechaUTCFin = new Date(fecha + 'T23:59:59.999Z');
    
    const fechaLocalInicio = new Date(fecha + 'T00:00:00.000-05:00');
    const fechaLocalFin = new Date(fecha + 'T23:59:59.999-05:00');

    const examenesUTC = await db.ExamenPaciente.findAll({
      where: {
        pacienteId,
        fechaAsignacion: { [Op.between]: [fechaUTCInicio, fechaUTCFin] }
      }
    });

    const examenesLocal = await db.ExamenPaciente.findAll({
      where: {
        pacienteId,
        fechaAsignacion: { [Op.between]: [fechaLocalInicio, fechaLocalFin] }
      }
    });

    res.json({
      success: true,
      diagnostico: {
        fechaSolicitada: fecha,
        totalExamenesPaciente: todosExamenes.length,
        examenesEncontradosUTC: examenesUTC.length,
        examenesEncontradosLocal: examenesLocal.length,
        todosExamenes: todosExamenes.map(ex => ({
          id: ex.id,
          fechaAsignacion: ex.fechaAsignacion,
          fechaISO: ex.fechaAsignacion.toISOString(),
          fechaLocal: ex.fechaAsignacion.toString(),
          total: ex.total,
          abono: ex.abono,
          estadoPago: ex.estadoPago
        })),
        rangosBusqueda: {
          UTC: {
            inicio: fechaUTCInicio.toISOString(),
            fin: fechaUTCFin.toISOString()
          },
          Local: {
            inicio: fechaLocalInicio.toISOString(),
            fin: fechaLocalFin.toISOString()
          }
        }
      }
    });

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};





// ✅ DIAGNÓSTICO COMPLETO DEL PROBLEMA DE FECHAS
const diagnosticoCompletoFechas = async (req, res) => {
  try {
    const { pacienteId } = req.params;
    
    console.log('🔍 DIAGNÓSTICO COMPLETO DE FECHAS PARA PACIENTE:', pacienteId);

    // 1. Obtener TODOS los exámenes del paciente
    const todosExamenes = await db.ExamenPaciente.findAll({
      where: { pacienteId },
      attributes: ['id', 'fechaAsignacion', 'total', 'abono', 'estadoPago', 'createdAt', 'updatedAt'],
      order: [['fechaAsignacion', 'DESC']],
      raw: true
    });

    // 2. Analizar diferencias entre fechas
    const analisisFechas = todosExamenes.map(examen => {
      const fechaAsignacion = new Date(examen.fechaAsignacion);
      const createdAt = new Date(examen.createdAt);
      
      return {
        id: examen.id,
        fechaAsignacion: {
          original: examen.fechaAsignacion,
          iso: fechaAsignacion.toISOString(),
          local: fechaAsignacion.toLocaleString('es-EC'),
          dateOnly: fechaAsignacion.toLocaleDateString('es-EC'),
          time: fechaAsignacion.toLocaleTimeString('es-EC')
        },
        createdAt: {
          original: examen.createdAt,
          iso: createdAt.toISOString(),
          local: createdAt.toLocaleString('es-EC'),
          dateOnly: createdAt.toLocaleDateString('es-EC')
        },
        diferenciaHoras: (createdAt - fechaAsignacion) / (1000 * 60 * 60),
        total: examen.total,
        estadoPago: examen.estadoPago
      };
    });

    // 3. Agrupar por fecha local
    const agrupacionPorFecha = {};
    analisisFechas.forEach(examen => {
      const fechaKey = examen.fechaAsignacion.dateOnly;
      
      if (!agrupacionPorFecha[fechaKey]) {
        agrupacionPorFecha[fechaKey] = [];
      }
      
      agrupacionPorFecha[fechaKey].push(examen);
    });

    // 4. Buscar inconsistencias
    const inconsistencias = analisisFechas.filter(examen => 
      Math.abs(examen.diferenciaHoras) > 24 || // Más de 1 día de diferencia
      examen.fechaAsignacion.dateOnly !== examen.createdAt.dateOnly
    );

    res.json({
      success: true,
      diagnostico: {
        pacienteId,
        totalExamenes: todosExamenes.length,
        fechasUnicas: Object.keys(agrupacionPorFecha),
        agrupacionPorFecha,
        analisisDetallado: analisisFechas,
        inconsistencias: {
          count: inconsistencias.length,
          detalles: inconsistencias
        },
        resumen: `El paciente tiene ${todosExamenes.length} exámenes agrupados en ${Object.keys(agrupacionPorFecha).length} fechas diferentes`
      }
    });

  } catch (error) {
    console.error('❌ Error en diagnóstico completo:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};


// ✅ ACTUALIZAR MÉTODO PARA OBTENER DATOS ACTUALIZADOS
const obtenerDatosActualizados = async (req, res) => {
  try {
    const { pacienteId, fecha } = req.params;
    
    console.log('🔄 OBTENIENDO DATOS ACTUALIZADOS:', { pacienteId, fecha });

    const fechaInicio = new Date(fecha + 'T00:00:00-05:00');
    const fechaFin = new Date(fecha + 'T23:59:59.999-05:00');

    const examenes = await ExamenPaciente.findAll({
      where: {
        pacienteId: pacienteId,
        fechaAsignacion: {
          [Op.between]: [fechaInicio, fechaFin]
        }
      },
      attributes: ['id', 'total', 'abono', 'saldoPendiente', 'estadoPago', 'fechaAsignacion']
    });

    // ✅ CALCULAR TOTALES ACTUALIZADOS
    let total = 0;
    let abono = 0;
    let pendiente = 0;

    examenes.forEach(examen => {
      total += parseFloat(examen.total || 0);
      abono += parseFloat(examen.abono || 0);
      pendiente += parseFloat(examen.saldoPendiente || 0);
    });

    const estadoPago = pendiente <= 0 ? 'pagado' : (abono > 0 ? 'abono' : 'pendiente');

    res.json({
      success: true,
      datos: {
        total,
        abono,
        pendiente,
        estadoPago: estadoPago,
        cantidadExamenes: examenes.length,
        examenes: examenes.map(ex => ({
          id: ex.id,
          total: ex.total,
          abono: ex.abono,
          saldoPendiente: ex.saldoPendiente,
          estadoPago: ex.estadoPago,
          fecha: ex.fechaAsignacion
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo datos actualizados:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error obteniendo datos actualizados',
      error: error.message
    });
  }
};

// ✅ VERSIÓN COMPLETAMENTE CORREGIDA - PROCESAR PAGO GRUPAL
// ✅ VERSIÓN CORREGIDA - PROCESAR PAGO GRUPAL
const procesarPagoGrupal = async (req, res) => {
  try {
    const { pacienteId, fecha, montoTotal, metodoPago, laboratoristaId } = req.body;
    
    console.log('💰 BACKEND - PROCESANDO PAGO GRUPAL CORREGIDO:', {
      pacienteId, fecha, montoTotal, metodoPago, laboratoristaId
    });

    // ✅ CORRECCIÓN: Usar fecha LOCAL (Ecuador UTC-5)
    const fechaInicio = new Date(fecha + 'T00:00:00-05:00');
    const fechaFin = new Date(fecha + 'T23:59:59.999-05:00');

    console.log('📅 RANGO DE BÚSQUEDA (LOCAL Ecuador):', {
      fechaSolicitada: fecha,
      fechaInicio: fechaInicio.toISOString(),
      fechaFin: fechaFin.toISOString(),
      fechaInicioLocal: fechaInicio.toLocaleString('es-EC'),
      fechaFinLocal: fechaFin.toLocaleString('es-EC')
    });

    // Buscar exámenes en el rango LOCAL
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
          as: 'Detalles',
          attributes: ['id', 'precioFinal', 'estado', 'nombreExamen']
        }
      ]
    });

    console.log(`🔍 ExamenPaciente encontrados para ${fecha}:`, examenesPaciente.length);

    if (examenesPaciente.length === 0) {
      // Diagnóstico adicional
      const todasFechas = await ExamenPaciente.findAll({
        where: { pacienteId: pacienteId },
        attributes: ['id', 'fechaAsignacion', 'total'],
        order: [['fechaAsignacion', 'DESC']],
        raw: true
      });
      
      const fechasFormateadas = todasFechas.map(f => 
        new Date(f.fechaAsignacion).toLocaleDateString('es-EC')
      );
      
      console.log('📋 FECHAS DISPONIBLES PARA ESTE PACIENTE:', fechasFormateadas);
      
      return res.status(404).json({
        success: false,
        mensaje: `No se encontraron exámenes para la fecha ${fecha}`,
        fechasDisponibles: fechasFormateadas,
        detalleExamenes: todasFechas.map(e => ({
          id: e.id,
          fechaAsignacion: e.fechaAsignacion,
          fechaLocal: new Date(e.fechaAsignacion).toLocaleDateString('es-EC'),
          total: e.total
        }))
      });
    }


    // ✅ CALCULAR TOTALES ACTUALES DEL GRUPO
    let totalGrupo = 0;
    let abonoActualGrupo = 0;
    let saldoPendienteGrupo = 0;
console.log('🔍 DEBUG - DETALLE DE CADA EXAMEN:');

    examenesPaciente.forEach(examen => {
      totalGrupo += parseFloat(examen.total || 0);
      abonoActualGrupo += parseFloat(examen.abono || 0);
    });

    saldoPendienteGrupo = Math.max(0, totalGrupo - abonoActualGrupo);

    console.log('💰 ESTADO ACTUAL DEL GRUPO:', {
      totalGrupo,
      abonoActualGrupo,
      saldoPendienteGrupo,
      montoPagado: montoTotal,
      examenesCount: examenesPaciente.length
    });

    // ✅ VERIFICAR QUE EL MONTO NO EXCEDA EL SALDO
    const montoNumerico = parseFloat(montoTotal);
    if (montoNumerico > saldoPendienteGrupo) {
      return res.status(400).json({
        success: false,
        mensaje: `El monto ($${montoNumerico.toFixed(2)}) excede el saldo pendiente ($${saldoPendienteGrupo.toFixed(2)})`,
        saldoPendienteActual: saldoPendienteGrupo,
        totalGrupo: totalGrupo,
        abonoActual: abonoActualGrupo
      });
    }

    // ✅ CALCULAR NUEVOS VALORES
    const nuevoAbonoGrupo = abonoActualGrupo + montoNumerico;
    const nuevoSaldoPendiente = Math.max(0, totalGrupo - nuevoAbonoGrupo);
    
    let estadoPagoGrupo;
    if (nuevoSaldoPendiente <= 0) {
      estadoPagoGrupo = 'pagado';
    } else if (nuevoAbonoGrupo > 0) {
      estadoPagoGrupo = 'abono';
    } else {
      estadoPagoGrupo = 'pendiente';
    }

    // ✅ ACTUALIZAR CADA ExamenPaciente (CABECERA)
    const examenesActualizados = [];
    
    for (const examen of examenesPaciente) {
      const precioExamen = parseFloat(examen.total || 0);
      const abonoActual = parseFloat(examen.abono || 0);
      const saldoExamen = Math.max(0, precioExamen - abonoActual);
      
      // Distribuir el pago proporcionalmente entre los exámenes
      let abonoAdicional = 0;
      if (saldoPendienteGrupo > 0) {
        const proporcion = saldoExamen / saldoPendienteGrupo;
        abonoAdicional = montoNumerico * proporcion;
      }
      
      const nuevoAbono = abonoActual + abonoAdicional;
      
      let nuevoEstadoPago;
      if (nuevoAbono >= precioExamen) {
        nuevoEstadoPago = 'pagado';
      } else if (nuevoAbono > 0) {
        nuevoEstadoPago = 'abono';
      } else {
        nuevoEstadoPago = 'pendiente';
      }

      // Actualizar el examen
      await examen.update({
        abono: nuevoAbono,
        estadoPago: nuevoEstadoPago,
        metodoPago: metodoPago,
        saldoPendiente: Math.max(0, precioExamen - nuevoAbono)
      });

      examenesActualizados.push({
        id: examen.id,
        total: precioExamen,
        abonoAnterior: abonoActual,
        abonoNuevo: nuevoAbono,
        estadoPago: nuevoEstadoPago,
        detallesCount: examen.Detalles?.length || 0
      });
    }

    // ✅ CREAR REGISTRO DE PAGO
    const nuevoPago = await Pago.create({
      pacienteId: pacienteId,
      laboratoristaId: laboratoristaId || 1,
      monto: montoNumerico,
      metodoPago: metodoPago,
      tipo: 'grupal',
      estado: 'completado',
      fechaPago: new Date(),
      referencia: `Pago grupal - ${fecha} - ${examenesPaciente.length} exámenes`
    });

    console.log('✅ PAGO GRUPAL PROCESADO EXITOSAMENTE:', {
      pagoId: nuevoPago.id,
      estadoPagoGrupo,
      totalGrupo,
      abonoTotal: nuevoAbonoGrupo,
      saldoPendiente: nuevoSaldoPendiente,
      examenesActualizados: examenesActualizados.length,
      fechaProcesada: fecha
    });

    res.json({
      success: true,
      mensaje: `Pago grupal de $${montoNumerico.toFixed(2)} procesado exitosamente para ${examenesPaciente.length} exámenes`,
      pago: {
        id: nuevoPago.id,
        monto: montoNumerico,
        metodoPago: metodoPago,
        fecha: nuevoPago.fechaPago,
        referencia: nuevoPago.referencia
      },
      grupo: {
        estadoPago: estadoPagoGrupo,
        financiero: {
          total: totalGrupo,
          abonado: nuevoAbonoGrupo,
          pendiente: nuevoSaldoPendiente
        },
        examenesActualizados: examenesActualizados.length,
        fecha: fecha
      },
      detalles: {
        examenes: examenesActualizados,
        pagoId: nuevoPago.id
      }
    });

  } catch (error) {
    console.error('❌ ERROR EN PAGO GRUPAL:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor al procesar pago grupal',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};



// ✅ VERSIÓN COMPLETAMENTE CORREGIDA - OBTENER RESUMEN GRUPAL
const obtenerResumenGrupalPorFecha = async (req, res) => {
  try {
    const { pacienteId, fecha } = req.params;
    
    console.log('📊 OBTENIENDO RESUMEN GRUPAL - FECHA SOLICITADA:', { pacienteId, fecha });

    // ✅ CORRECCIÓN CRÍTICA: Usar fecha local (Ecuador UTC-5)
    const fechaInicio = new Date(fecha + 'T00:00:00-05:00');
    const fechaFin = new Date(fecha + 'T23:59:59.999-05:00');

    console.log('🔍 RANGO DE BÚSQUEDA CORREGIDO (LOCAL Ecuador):', {
      fechaSolicitada: fecha,
      fechaInicio: fechaInicio.toISOString(),
      fechaFin: fechaFin.toISOString(),
      fechaInicioLocal: fechaInicio.toLocaleString('es-EC'),
      fechaFinLocal: fechaFin.toLocaleString('es-EC')
    });

    // Buscar exámenes en el rango de fecha LOCAL
    const examenesPaciente = await db.ExamenPaciente.findAll({
      where: { 
        pacienteId: pacienteId,
        fechaAsignacion: {
          [Op.between]: [fechaInicio, fechaFin]
        }
      },
      include: [
        {
          model: db.ExamenPacienteDetalle,
          as: 'Detalles',
          attributes: ['id', 'nombreExamen', 'precioFinal', 'estado']
        }
      ],
      order: [['fechaAsignacion', 'DESC']]
    });

    console.log(`📊 Exámenes encontrados para ${fecha}:`, examenesPaciente.length);

    // Si no encuentra, hacer diagnóstico detallado
    if (examenesPaciente.length === 0) {
      console.log('⚠️ No se encontraron exámenes, haciendo diagnóstico...');
      
      // Obtener TODOS los exámenes del paciente para diagnóstico
      const todosExamenes = await db.ExamenPaciente.findAll({
        where: { pacienteId },
        attributes: ['id', 'fechaAsignacion', 'total', 'abono', 'estadoPago'],
        order: [['fechaAsignacion', 'DESC']],
        raw: true
      });

      console.log('🔍 TODOS LOS EXAMENES DEL PACIENTE:');
      todosExamenes.forEach(examen => {
        const fechaLocal = new Date(examen.fechaAsignacion).toLocaleDateString('es-EC');
        const fechaISO = new Date(examen.fechaAsignacion).toISOString();
        console.log(`   - ID: ${examen.id}, Fecha BD: ${examen.fechaAsignacion}`);
        console.log(`     Fecha Local: ${fechaLocal}, Fecha ISO: ${fechaISO}`);
        console.log(`     Total: ${examen.total}, Estado: ${examen.estadoPago}`);
      });

      // Buscar por fecha local como fallback
      const examenesPorFechaLocal = todosExamenes.filter(examen => {
        const fechaExamenLocal = new Date(examen.fechaAsignacion).toLocaleDateString('es-EC');
        const fechaSolicitadaLocal = new Date(fecha + 'T00:00:00-05:00').toLocaleDateString('es-EC');
        return fechaExamenLocal === fechaSolicitadaLocal;
      });

      console.log(`🔍 Búsqueda por fecha local: ${examenesPorFechaLocal.length} exámenes`);

      // Usar los exámenes por fecha local si se encontraron
      const examenesEnFecha = examenesPorFechaLocal.length > 0 ? 
        await db.ExamenPaciente.findAll({
          where: { id: examenesPorFechaLocal.map(e => e.id) },
          include: [{ model: db.ExamenPacienteDetalle, as: 'Detalles' }]
        }) : [];

      let total = 0;
      let abono = 0;
      let pendiente = 0;
      
      for (const examen of examenesEnFecha) {
        total += parseFloat(examen.total || 0);
        abono += parseFloat(examen.abono || 0);
        pendiente += (parseFloat(examen.total || 0) - parseFloat(examen.abono || 0));
      }

      const estadoPago = pendiente <= 0 ? 'pagado' : (abono > 0 ? 'abono' : 'pendiente');

      console.log('📈 RESUMEN FINAL (FALLBACK):', { 
        total, 
        abono, 
        pendiente, 
        estadoPago,
        examenesCount: examenesEnFecha.length,
        fechaSolicitada: fecha
      });

      return res.json({
        success: true,
        grupo: {
          total,
          abono,
          pendiente,
          estadoPago: estadoPago,
          cantidadExamenes: examenesEnFecha.length,
          fecha: fecha,
          debug: {
            busquedaLocal: examenesPaciente.length,
            busquedaFallback: examenesPorFechaLocal.length,
            fechaSolicitada: fecha,
            metodoUtilizado: examenesPorFechaLocal.length > 0 ? 'fecha_local_fallback' : 'sin_examenes',
            totalExamenesPaciente: todosExamenes.length
          }
        }
      });
    }

    // ✅ CALCULAR TOTALES CON EXAMENES ENCONTRADOS
    let total = 0;
    let abono = 0;
    let pendiente = 0;
    
    for (const examen of examenesPaciente) {
      total += parseFloat(examen.total || 0);
      abono += parseFloat(examen.abono || 0);
      pendiente += (parseFloat(examen.total || 0) - parseFloat(examen.abono || 0));
    }

    const estadoPago = pendiente <= 0 ? 'pagado' : (abono > 0 ? 'abono' : 'pendiente');

    console.log('📈 RESUMEN FINAL:', { 
      total, 
      abono, 
      pendiente, 
      estadoPago,
      examenesCount: examenesPaciente.length,
      fechaSolicitada: fecha
    });

    res.json({
      success: true,
      grupo: {
        total,
        abono,
        pendiente,
        estadoPago: estadoPago,
        cantidadExamenes: examenesPaciente.length,
        fecha: fecha,
        examenes: examenesPaciente.map(ex => ({
          id: ex.id,
          fechaAsignacion: ex.fechaAsignacion,
          total: ex.total,
          abono: ex.abono,
          estadoPago: ex.estadoPago,
          detallesCount: ex.Detalles?.length || 0
        }))
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

// ✅ VERSIÓN CORREGIDA - PROCESAR PAGO GRUPAL

module.exports = {
  actualizarEstadoPago,
  registrarAbono,
  procesarPagosMultiples,
  procesarPagoGrupal,
  obtenerResumenGrupalPorFecha,
  obtenerDetalleGrupoPago,
  diagnosticarFechasPago,
  diagnosticoCompletoPago,
  buscarCabecerasPorFecha,
  diagnosticarFechasPagoGrupal,
  diagnosticoCompletoFechas,
  obtenerDatosActualizados
};