const db = require('../models');
const { Op, Sequelize } = require('sequelize');

// Modelos
const { ExamenPaciente, ExamenPacienteDetalle, Examen, Area, Subexamen, Paciente, Laboratorista, Sucursal, Promocion } = db;

// 🩺 ASIGNAR EXAMENES A PACIENTE
const asignarExamenes = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const pacienteId = req.params.id;
    
    console.log('🩺 ========== ASIGNACIÓN EXÁMENES ==========');
    console.log('🔗 PARAMS recibidos:', req.params);
    console.log('📦 BODY recibido:', JSON.stringify(req.body, null, 2));
    
    const { observaciones, laboratoristaId, examenes } = req.body;

    // ✅ VALIDACIONES
    if (!Array.isArray(examenes) || examenes.length === 0) {
      await t.rollback();
      return res.status(400).json({ 
        success: false,
        message: 'Debe enviar al menos un examen' 
      });
    }

    if (!laboratoristaId) {
      await t.rollback();
      return res.status(400).json({ 
        success: false,
        message: 'laboratoristaId es requerido' 
      });
    }

    console.log('🎯 LABORATORISTA_ID:', laboratoristaId);
    console.log('📊 CANTIDAD EXAMENES:', examenes.length);

    // ✅ VERIFICAR DATOS DE EXAMENES
    console.log('🔍 ANALIZANDO DATOS DE EXAMENES RECIBIDOS:');
    examenes.forEach((examen, index) => {
      console.log(`   Examen ${index + 1}:`, {
        nombre: examen.nombreExamen || examen.nombre,
        examenId: examen.examenId,
        esSubexamen: examen.esSubexamen,
        precioOriginal: examen.precioOriginal,
        precioFinal: examen.precioFinal,
        descuentoAplicado: examen.descuentoAplicado,
        conPromocion: examen.conPromocion,
        promocionId: examen.promocionId
      });
    });

    // ✅ OBTENER LABORATORISTA CON SUCURSAL
    const laboratorista = await Laboratorista.findByPk(laboratoristaId, {
      include: [{ 
        model: Sucursal, 
        as: 'Sucursal',
        attributes: ['id', 'nombre'] 
      }],
      transaction: t
    });

    if (!laboratorista) {
      await t.rollback();
      return res.status(404).json({ 
        success: false,
        message: 'Laboratorista no encontrado' 
      });
    }

    console.log('🏥 SUCURSAL DEL LABORATORISTA:', laboratorista.Sucursal?.nombre);

    // ✅ CALCULAR PRECIOS TOTALES
    let totalCalculado = 0;
    let descuentoTotalGrupo = 0;

    console.log('💰 CALCULANDO PRECIOS TOTALES...');
    
    for (const examenData of examenes) {
      const calculoPrecios = calcularPreciosExamenCorregido(examenData);
      totalCalculado += calculoPrecios.precioFinal;
      descuentoTotalGrupo += calculoPrecios.descuentoAplicado;
      
      console.log(`   📊 "${examenData.nombreExamen}":`, {
        precioFinal: calculoPrecios.precioFinal,
        descuento: calculoPrecios.descuentoAplicado,
        acumuladoTotal: totalCalculado
      });
    }

    console.log('💰 RESUMEN FINANCIERO GRUPAL:', {
      totalCalculado: totalCalculado,
      descuentoTotal: descuentoTotalGrupo,
      cantidadExamenes: examenes.length
    });

    // 1) CREAR CABECERA CON PRECIOS CORRECTOS
    const cabecera = await ExamenPaciente.create({
      pacienteId: pacienteId,
      laboratoristaId: laboratoristaId,
      sucursalId: laboratorista.Sucursal?.id || null,
      observaciones: observaciones || '',
      cantidadExamenes: examenes.length,
      estadoPago: 'pendiente',
      abono: 0,
      total: totalCalculado,
      saldoPendiente: totalCalculado,
      fechaAsignacion: new Date()
    }, { transaction: t });

    console.log('✅ CABECERA CREADA CON PRECIOS:', {
      id: cabecera.id,
      pacienteId: cabecera.pacienteId,
      laboratoristaId: cabecera.laboratoristaId,
      sucursalId: cabecera.sucursalId,
      total: cabecera.total,
      saldoPendiente: cabecera.saldoPendiente,
      cantidadExamenes: cabecera.cantidadExamenes
    });

    // 2) PROCESAR DETALLES CON CÁLCULOS CORRECTOS
    const detallesLimpios = [];
    let contadorDetalles = 0;

    console.log(`🔍 Procesando ${examenes.length} exámenes para detalles...`);
    
    for (const examenData of examenes) {
      console.log('💰 Procesando examen para detalle:', {
        nombre: examenData.nombreExamen || examenData.nombre,
        examenId: examenData.examenId,
        esSubexamen: examenData.esSubexamen,
        precioOriginal: examenData.precioOriginal,
        precioFinal: examenData.precioFinal,
        descuentoAplicado: examenData.descuentoAplicado
      });

      // ✅ CALCULAR PRECIOS CORRECTAMENTE
      const calculoPrecios = calcularPreciosExamenCorregido(examenData);

      // ✅ DETALLE CON TODOS LOS CAMPOS CORREGIDOS
      // En examenes.controller.js - en la parte donde creas los detalles
// ✅ DETALLE CON TODOS LOS CAMPOS CORREGIDOS - VERSIÓN CORREGIDA
let detalleNormalizado = {
  examenPacienteId: cabecera.id,
  precioAplicado: calculoPrecios.precioAplicado,
  descuentoAplicado: calculoPrecios.descuentoAplicado,
  precioFinal: calculoPrecios.precioFinal,
  estado: 'pendiente',
  laboratoristaId: laboratoristaId, // ✅ ESTE ES EL CAMPO CLAVE
  sucursalId: laboratorista.Sucursal?.id || null,
  laboratorio: laboratorista.Sucursal?.nombre || 'Laboratorio Central',
  conPromocion: examenData.conPromocion || false,
  promocionId: examenData.promocionId || null,
  nombreExamen: examenData.nombreExamen || examenData.nombre || 'Examen',
  // ✅ AGREGAR INFORMACIÓN DE REGISTRO COMPLETA
  registradoPor: `${laboratorista.nombres} ${laboratorista.apellidos}`,
  fechaRegistro: new Date(),
  horaRegistro: new Date().toTimeString().split(' ')[0],
  createdAt: new Date(),
  updatedAt: new Date()
};

      // ✅ ASIGNAR ID CORRECTO SEGÚN TIPO DE EXAMEN
      if (examenData.esSubexamen) {
        detalleNormalizado.subexamenId = examenData.examenId;
        detalleNormalizado.esSubexamen = true;
        detalleNormalizado.examenId = null;
      } else {
        detalleNormalizado.examenId = examenData.examenId;
        detalleNormalizado.esSubexamen = false;
        detalleNormalizado.subexamenId = null;
      }

      detallesLimpios.push(detalleNormalizado);
      contadorDetalles++;

      console.log(`   ✅ ${examenData.esSubexamen ? 'SUBEXAMEN' : 'EXAMEN'} "${examenData.nombreExamen}":`);
      console.log(`      Precio Aplicado: $${calculoPrecios.precioAplicado}`);
      console.log(`      Descuento Aplicado: $${calculoPrecios.descuentoAplicado}`);
      console.log(`      Precio Final: $${calculoPrecios.precioFinal}`);
      console.log(`      Con Promoción: ${examenData.conPromocion || false}`);
      console.log(`      Promoción ID: ${examenData.promocionId || 'null'}`);
      console.log(`      Tipo: ${examenData.esSubexamen ? 'Subexamen' : 'Examen Principal'}`);
    }

    // 3) INSERTAR DETALLES EN BD
    console.log(`📝 Insertando ${detallesLimpios.length} detalles en examen_paciente_detalles...`);
    const detallesInsertados = await ExamenPacienteDetalle.bulkCreate(detallesLimpios, { 
      transaction: t,
      returning: true
    });

    // 4) VERIFICAR INSERCIÓN
    console.log(`✅ Detalles insertados correctamente: ${detallesInsertados.length}`);
    
    // Verificar los primeros 2 detalles insertados
    if (detallesInsertados.length > 0) {
      console.log('🔍 MUESTRA DE DETALLES INSERTADOS:');
      detallesInsertados.slice(0, 2).forEach((detalle, index) => {
        console.log(`   Detalle ${index + 1}:`, {
          id: detalle.id,
          examenId: detalle.examenId,
          subexamenId: detalle.subexamenId,
          precioAplicado: detalle.precioAplicado,
          descuentoAplicado: detalle.descuentoAplicado,
          precioFinal: detalle.precioFinal,
          nombreExamen: detalle.nombreExamen,
          conPromocion: detalle.conPromocion,
          promocionId: detalle.promocionId,
          esSubexamen: detalle.esSubexamen
        });
      });
    }

    await t.commit();
    
    console.log('🎉 ASIGNACIÓN EXITOSA - RESUMEN FINAL:', {
      cabeceraId: cabecera.id,
      pacienteId: cabecera.pacienteId,
      laboratoristaId: cabecera.laboratoristaId,
      sucursalId: cabecera.sucursalId,
      cantidadExamenes: cabecera.cantidadExamenes,
      total: cabecera.total,
      descuentoTotal: descuentoTotalGrupo,
      saldoPendiente: cabecera.saldoPendiente,
      detallesInsertados: detallesInsertados.length,
      fechaAsignacion: cabecera.fechaAsignacion
    });
    
    return res.status(201).json({
      success: true,
      message: `Se asignaron ${examenes.length} exámenes correctamente`,
      data: {
        cabeceraId: cabecera.id,
        cantidadExamenes: cabecera.cantidadExamenes,
        total: cabecera.total,
        descuentoTotal: descuentoTotalGrupo,
        saldoPendiente: cabecera.saldoPendiente,
        sucursalId: cabecera.sucursalId,
        laboratoristaId: cabecera.laboratoristaId,
        detalles: detallesInsertados.map(d => ({
          id: d.id,
          nombre: d.nombreExamen,
          precioFinal: d.precioFinal,
          descuento: d.descuentoAplicado,
          conPromocion: d.conPromocion,
          promocionId: d.promocionId,
          esSubexamen: d.esSubexamen
        }))
      }
    });
    
  } catch (error) {
    await t.rollback();
    console.error('❌ ERROR EN ASIGNACIÓN:', error);
    console.error('❌ STACK TRACE:', error.stack);
    return res.status(500).json({ 
      success: false,
      message: 'Error al asignar exámenes', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// 📊 OBTENER EXAMENES CON ÁREA
const obtenerExamenesConArea = async (req, res) => {
  try {
    const examenes = await Examen.findAll({
      include: [{ model: Area, as: 'Area' }],
      order: [['nombre', 'ASC']]
    });
    res.json(examenes);
  } catch (error) {
    console.error('❌ Error obteniendo exámenes con área:', error);
    res.status(500).json({ error: 'Error cargando exámenes' });
  }
};

// 📋 OBTENER RESUMEN DE EXAMENES DEL PACIENTE
const obtenerResumenExamenesPaciente = async (req, res) => {
  try {
    const { id } = req.params;

    const examenes = await ExamenPaciente.findAll({
      where: { pacienteId: id },
      include: [
        {
          model: ExamenPacienteDetalle,
          as: "Detalles",
          include: [
            { 
              model: Examen, 
              as: "Examen",
              include: [{ model: Area, attributes: ['id', 'nombre'] }]
            },
            { model: Promocion, as: "Promocion" }
          ]
        },
        { model: Laboratorista }
      ],
      order: [
        ['createdAt', 'DESC'],
        [{ model: ExamenPacienteDetalle, as: 'Detalles' }, { model: Examen, as: 'Examen' }, { model: Area }, 'nombre', 'ASC'],
        [{ model: ExamenPacienteDetalle, as: 'Detalles' }, { model: Examen, as: 'Examen' }, 'nombre', 'ASC']
      ]
    });

    res.status(200).json(examenes);
  } catch (error) {
    console.error("❌ Error al obtener resumen de exámenes:", error);
    res.status(500).json({ message: "Error al obtener resumen de exámenes", error: error.message });
  }
};


// 🔍 OBTENER EXAMENES CON PRECIOS SEPARADOS
const obtenerExamenesConPreciosSeparados = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🔍 OBTENER EXAMENES CON PRECIOS SEPARADOS - Paciente ID:', id);

    const examenes = await ExamenPaciente.findAll({
      where: { pacienteId: id },
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
                as: 'Area'
              }]
            },
            {
              model: Subexamen,
              as: 'Subexamen',
              include: [{
                model: Examen,
                as: 'ExamenPadre',
                include: [{
                  model: Area,
                  as: 'Area'
                }]
              }]
            }
          ]
        }
      ],
      order: [['fechaAsignacion', 'DESC']]
    });

    console.log(`✅ Se encontraron ${examenes.length} registros de examen-paciente`);

    // PROCESAMIENTO CON VALIDACIÓN NUMÉRICA MEJORADA
    const examenesProcesados = [];
    let totalDetalles = 0;

    examenes.forEach(examen => {
      console.log(`\n📦 Procesando examen-paciente ID: ${examen.id}`);
      
      if (examen.Detalles && Array.isArray(examen.Detalles)) {
        examen.Detalles.forEach((detalle, detalleIndex) => {
          totalDetalles++;
          
          // VALIDACIÓN NUMÉRICA ROBUSTA
          let precioFinal = 0;
          
          if (detalle.precioFinal) {
            if (typeof detalle.precioFinal === 'number') {
              precioFinal = detalle.precioFinal;
            } else if (typeof detalle.precioFinal === 'string') {
              // Intentar extraer precios concatenados
              const preciosExtraidos = extraerPreciosConcatenados(detalle.precioFinal);
              precioFinal = preciosExtraidos[0] || 0;
            }
          }
          
          // Asegurar que sea un número válido
          precioFinal = isNaN(precioFinal) ? 0 : Math.max(0, precioFinal);

          console.log(`   🔍 Detalle ${detalleIndex + 1}:`, {
            id: detalle.id,
            precioOriginal: detalle.precioFinal,
            precioProcesado: precioFinal,
            esSubexamen: detalle.esSubexamen,
            nombre: detalle.nombreExamen
          });

          const examenProcesado = {
            id: detalle.id,
            pacienteId: examen.pacienteId,
            estado: examen.estado,
            estadoPago: examen.estadoPago,
            metodoPago: examen.metodoPago,
            abono: parseFloat(examen.abono) || 0,
            precio: precioFinal,
            nombreExamen: detalle.nombreExamen || 'Examen',
            areaNombre: detalle.Examen?.Area?.nombre || 
                       detalle.Subexamen?.ExamenPadre?.Area?.nombre || 
                       'General',
            esSubexamen: detalle.esSubexamen || false,
            fechaAsignacion: examen.fechaAsignacion,
            createdAt: examen.createdAt
          };

          examenesProcesados.push(examenProcesado);
        });
      }
    });

    console.log(`\n📊 RESUMEN FINAL PROCESADO:`);
    console.log(`   Registros examen-paciente: ${examenes.length}`);
    console.log(`   Detalles encontrados: ${totalDetalles}`);
    console.log(`   Exámenes procesados: ${examenesProcesados.length}`);
    
    // VERIFICAR QUE TODOS LOS PRECIOS SON NÚMEROS VÁLIDOS
    const preciosInvalidos = examenesProcesados.filter(ex => 
      typeof ex.precio !== 'number' || isNaN(ex.precio)
    );
    
    if (preciosInvalidos.length > 0) {
      console.warn(`⚠️ Se encontraron ${preciosInvalidos.length} precios inválidos, corrigiendo...`);
      preciosInvalidos.forEach(ex => ex.precio = 0);
    }

    res.json(examenesProcesados);

  } catch (error) {
    console.error('❌ Error al obtener exámenes con precios separados:', error);
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: error.message
    });
  }
};

// 🔄 ACTUALIZAR ESTADO DEL EXAMEN
const actualizarEstadoExamen = async (req, res) => {
  try {
    const { examenPacienteId } = req.params;
    const { estado } = req.body;

    console.log(`🔄 Actualizando estado del examen ${examenPacienteId} a: ${estado}`);

    const examenPaciente = await ExamenPaciente.findByPk(examenPacienteId);

    if (!examenPaciente) {
      return res.status(404).json({ error: 'Examen no encontrado' });
    }

    const updateData = { estado };
    if (estado === 'listo' && !examenPaciente.fechaFinalizacion) {
      updateData.fechaFinalizacion = new Date();
    }

    await examenPaciente.update(updateData);

    res.json({ 
      message: 'Estado actualizado correctamente',
      examen: examenPaciente 
    });
  } catch (error) {
    console.error('Error al actualizar estado del examen:', error);
    res.status(500).json({ mensaje: 'Error al actualizar estado del examen' });
  }
};

// 📄 SUBIR RESULTADO DE EXAMEN
const subirResultadoExamen = async (req, res) => {
  try {
    const { examenPacienteId } = req.params;
    const { resultado, estado } = req.body;

    console.log('📄 BACKEND - Recibiendo solicitud para examen ID:', examenPacienteId);
    console.log('📊 BACKEND - Body recibido:', { resultado, estado });

    if (!examenPacienteId) {
      console.log('❌ BACKEND - ID de examen no proporcionado');
      return res.status(400).json({ error: 'ID de examen no proporcionado' });
    }

    // Buscar el examen
    const examen = await ExamenPaciente.findByPk(examenPacienteId, {
      include: [{ model: Examen }]
    });

    if (!examen) {
      console.log('❌ BACKEND - Examen no encontrado con ID:', examenPacienteId);
      return res.status(404).json({ error: 'Examen no encontrado' });
    }

    console.log('✅ BACKEND - Examen encontrado:', {
      id: examen.id,
      nombre: examen.Examen?.nombre,
      pacienteId: examen.pacienteId
    });

    // Convertir resultado a string si es objeto
    let resultadoString = resultado;
    if (typeof resultado === 'object' || Array.isArray(resultado)) {
      resultadoString = JSON.stringify(resultado);
      console.log('🔧 BACKEND - Resultado convertido a JSON string');
    }

    const datosActualizacion = {
      resultado: resultadoString,
      fechaResultado: new Date()
    };

    // Si se especifica un estado, actualizarlo también
    if (estado) {
      datosActualizacion.estado = estado;
      console.log('🔄 BACKEND - Actualizando estado a:', estado);
    }

    await examen.update(datosActualizacion);

    console.log('✅ BACKEND - Resultados guardados exitosamente para examen ID:', examenPacienteId);
    
    res.json({ 
      success: true, 
      mensaje: 'Resultados guardados correctamente',
      examen: examen 
    });

  } catch (error) {
    console.error('❌ BACKEND - Error al subir resultado:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al guardar los resultados',
      detalle: error.message 
    });
  }
};

// 🔧 FUNCIONES AUXILIARES

// FUNCIÓN PARA CALCULAR PRECIOS CORREGIDA
const calcularPreciosExamenCorregido = (examenData) => {
  console.log(`   🧮 CALCULANDO PRECIOS CORREGIDOS para:`, {
    nombre: examenData.nombreExamen,
    precioOriginal: examenData.precioOriginal,
    precioFinal: examenData.precioFinal,
    descuentoAplicado: examenData.descuentoAplicado
  });

  // ✅ PRIORIDAD: Usar los valores que vienen del frontend
  const precioOriginal = parseFloat(examenData.precioOriginal) || 0;
  const precioFinalRecibido = parseFloat(examenData.precioFinal) || 0;
  const descuentoRecibido = parseFloat(examenData.descuentoAplicado) || 0;

  let precioAplicado = precioOriginal;
  let descuentoAplicado = descuentoRecibido;
  let precioFinalCalculado = precioFinalRecibido;

  console.log(`   📈 VALORES RECIBIDOS DEL FRONTEND:`, {
    precioOriginal,
    precioFinalRecibido,
    descuentoRecibido
  });

  // ✅ ESTRATEGIA MEJORADA DE CÁLCULO
  if (precioFinalRecibido > 0) {
    // Si viene precioFinal, es la autoridad
    precioFinalCalculado = precioFinalRecibido;
    
    // Calcular descuento basado en precioOriginal y precioFinal
    if (precioOriginal > 0) {
      descuentoAplicado = precioOriginal - precioFinalRecibido;
    } else {
      // Si no hay precioOriginal, asumir que el descuento ya está aplicado
      descuentoAplicado = descuentoRecibido;
    }
    
    precioAplicado = precioOriginal > 0 ? precioOriginal : precioFinalRecibido + descuentoAplicado;
    
    console.log(`   ✅ Usando precioFinal como autoridad`);
  } else if (precioOriginal > 0 && descuentoRecibido > 0) {
    // Calcular precioFinal basado en precioOriginal y descuento
    precioFinalCalculado = Math.max(0, precioOriginal - descuentoRecibido);
    precioAplicado = precioOriginal;
    descuentoAplicado = descuentoRecibido;
    
    console.log(`   ✅ Calculando precioFinal desde precioOriginal y descuento`);
  } else if (precioOriginal > 0) {
    // Solo precioOriginal sin descuento
    precioFinalCalculado = precioOriginal;
    precioAplicado = precioOriginal;
    descuentoAplicado = 0;
    
    console.log(`   ✅ Solo precioOriginal sin descuento`);
  } else {
    // Fallback - no debería pasar
    precioAplicado = 0;
    descuentoAplicado = 0;
    precioFinalCalculado = 0;
    
    console.warn(`   ⚠️ No se pudieron determinar precios válidos`);
  }

  // ✅ VALIDACIONES FINALES
  // Asegurar que no haya precios negativos
  precioAplicado = Math.max(0, precioAplicado);
  descuentoAplicado = Math.max(0, Math.min(descuentoAplicado, precioAplicado)); // Descuento no mayor al precio
  precioFinalCalculado = Math.max(0, precioFinalCalculado);

  // Validar consistencia
  if (Math.abs((precioAplicado - descuentoAplicado) - precioFinalCalculado) > 0.01) {
    console.warn(`   ⚠️ Inconsistencia en cálculos, ajustando...`);
    precioFinalCalculado = Math.max(0, precioAplicado - descuentoAplicado);
  }

  console.log(`   🧮 RESULTADO FINAL:`);
  console.log(`      - Precio Aplicado: $${precioAplicado}`);
  console.log(`      - Descuento Aplicado: $${descuentoAplicado}`);
  console.log(`      - Precio Final: $${precioFinalCalculado}`);
  console.log(`      - Verificación: $${precioAplicado} - $${descuentoAplicado} = $${precioAplicado - descuentoAplicado}`);

  return {
    precioAplicado,
    descuentoAplicado,
    precioFinal: precioFinalCalculado
  };
};

// FUNCIÓN PARA EXTRAER PRECIOS CONCATENADOS
function extraerPreciosConcatenados(precioStr) {
  if (!precioStr || typeof precioStr !== 'string') {
    return [0];
  }

  console.log(`   🧮 Analizando precio: "${precioStr}"`);

  // Limpiar el string - eliminar caracteres no numéricos excepto puntos
  const cleaned = precioStr.replace(/[^\d.]/g, '');
  
  // Si después de limpiar no hay nada, retornar 0
  if (!cleaned) {
    return [0];
  }

  // Buscar patrones válidos de precios (XX.XX o X.XX)
  const regexPrecios = /\b\d{1,3}\.\d{2}\b/g;
  const matches = cleaned.match(regexPrecios);
  
  if (matches && matches.length > 0) {
    console.log(`   ✅ Encontrados ${matches.length} precios válidos:`, matches);
    const preciosValidos = matches.map(match => {
      const precio = parseFloat(match);
      return !isNaN(precio) && precio > 0 ? precio : 0;
    }).filter(precio => precio > 0);
    
    if (preciosValidos.length > 0) {
      return preciosValidos;
    }
  }

  // Intentar parseo directo como fallback
  const precioDirecto = parseFloat(cleaned);
  if (!isNaN(precioDirecto) && precioDirecto > 0) {
    console.log(`   🔧 Precio directo: $${precioDirecto}`);
    return [precioDirecto];
  }

  console.log(`   ⚠️ No se pudo extraer precio válido de "${precioStr}", usando 0`);
  return [0];
}

// FUNCIÓN PARA PROCESAR JERARQUÍA COMPLETA
const procesarJerarquiaCompleta = (examenes) => {
  console.log('🎯 INICIANDO PROCESAMIENTO JERÁRQUICO CORREGIDO');
  
  const gruposPorFecha = new Map();

  examenes.forEach(cabecera => {
    const fechaCabecera = new Date(cabecera.fechaAsignacion);
    
    // USAR FECHA UTC PARA CONSISTENCIA
    const fechaUTC = new Date(Date.UTC(
      fechaCabecera.getUTCFullYear(),
      fechaCabecera.getUTCMonth(),
      fechaCabecera.getUTCDate()
    ));
    
    const fechaStr = fechaUTC.toISOString().split('T')[0];
    
    // FORMATEAR FECHA PARA DISPLAY
    const fechaDisplay = fechaUTC.toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    });

    console.log(`\n📅 Procesando cabecera ${cabecera.id}:`);
    console.log(`   Fecha BD: ${cabecera.fechaAsignacion}`);
    console.log(`   Fecha UTC: ${fechaUTC.toISOString()}`);
    console.log(`   Fecha display: ${fechaDisplay}`);
    console.log(`   Total BD: $${cabecera.total}`);
    console.log(`   Abono BD: $${cabecera.abono}`);

    // CREAR GRUPO CON CAMPOS CORRECTOS
    if (!gruposPorFecha.has(fechaStr)) {
      gruposPorFecha.set(fechaStr, {
        id: `grupo-${fechaStr}`,
        fecha: fechaUTC,
        fechaStr: fechaDisplay,
        fechaISO: fechaStr,
        cabeceraIds: [],
        precioTotal: 0,
        total: 0,
        abono: 0,
        saldoPendiente: 0,
        estadoPago: 'pendiente',
        totalExamenes: 0,
        registradoPor: cabecera.Laboratorista ? {
          id: cabecera.Laboratorista.id,
          nombre: `${cabecera.Laboratorista.nombres} ${cabecera.Laboratorista.apellidos}`,
          sucursal: cabecera.Sucursal?.nombre || 'No asignada'
        } : null,
        areas: new Map(),
        detallesConteo: {
          examenesPrincipales: 0,
          examenesSinSubexamenes: 0,
          subexamenes: 0,
          total: 0
        }
      });
    }

    const grupo = gruposPorFecha.get(fechaStr);
    grupo.cabeceraIds.push(cabecera.id);

    // SUMAR TOTALES DE CABECERAS
    grupo.total += parseFloat(cabecera.total || 0);
    grupo.abono += parseFloat(cabecera.abono || 0);

    console.log(`   💰 Sumando cabecera: total=$${cabecera.total}, abono=$${cabecera.abono}`);
    console.log(`   📊 Grupo acumulado: total=$${grupo.total}, abono=$${grupo.abono}`);

    // PROCESAR DETALLES PARA CALCULAR precioTotal REAL
    if (cabecera.Detalles && cabecera.Detalles.length > 0) {
      cabecera.Detalles.forEach(detalle => {
        procesarDetalleParaGrupo(detalle, grupo);
      });
    }
  });

  // CALCULAR SALDOS PENDIENTES
  return calcularSaldosYGrupos(gruposPorFecha);
};


// FUNCIÓN AUXILIAR: Calcular saldos y preparar grupos
const calcularSaldosYGrupos = (gruposPorFecha) => {
  const resultadoFinal = Array.from(gruposPorFecha.values()).map(grupo => {
    // CALCULAR SALDO PENDIENTE USANDO EL 'total' REAL
    grupo.saldoPendiente = Math.max(0, grupo.total - grupo.abono);
    
    // DETERMINAR ESTADO DE PAGO
    if (grupo.saldoPendiente <= 0 && grupo.total > 0) {
      grupo.estadoPago = 'pagado';
    } else if (grupo.abono > 0 && grupo.saldoPendiente > 0) {
      grupo.estadoPago = 'abono';
    } else {
      grupo.estadoPago = 'pendiente';
    }

    // CONVERTIR MAPS A ARRAYS
    grupo.areas = Array.from(grupo.areas.values()).map(area => {
      area.examenes = Array.from(area.examenes.values());
      
      // Ordenar exámenes
      area.examenes.sort((a, b) => a.nombre.localeCompare(b.nombre));
      area.examenes.forEach(examen => {
        examen.subexamenes?.sort((a, b) => a.nombre.localeCompare(b.nombre));
      });

      return area;
    });

    // Ordenar áreas
    grupo.areas.sort((a, b) => a.nombre.localeCompare(b.nombre));

    // CONTAR EXAMENES INDIVIDUALES
    grupo.totalExamenes = contarExamenesIndividuales(grupo.areas);

    console.log(`\n🎯 GRUPO FINAL ${grupo.fechaStr}:`);
    console.log(`   Total (BD): $${grupo.total}`);
    console.log(`   Precio Total (detalles): $${grupo.precioTotal}`);
    console.log(`   Abono: $${grupo.abono}`);
    console.log(`   Saldo Pendiente: $${grupo.saldoPendiente}`);
    console.log(`   Estado: ${grupo.estadoPago}`);
    console.log(`   Exámenes: ${grupo.totalExamenes}`);
    console.log(`   Áreas: ${grupo.areas.length}`);

    return grupo;
  });

  // ORDENAR POR FECHA
  return resultadoFinal.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
};

// FUNCIÓN AUXILIAR: Contar exámenes individuales
const contarExamenesIndividuales = (areas) => {
  return areas.reduce((total, area) => {
    return total + area.examenes.reduce((areaTotal, examen) => {
      if (examen.tieneSubexamenes && examen.subexamenes.length > 0) {
        return areaTotal + examen.subexamenes.length;
      }
      return areaTotal + 1;
    }, 0);
  }, 0);
};

// FUNCIÓN PARA BUSCAR CABECERAS POR FECHA
const buscarCabecerasPorFecha = async (pacienteId, fecha) => {
  try {
    console.log('🔍 BÚSQUEDA MEJORADA POR FECHA:', { pacienteId, fecha });
    
    let fechaInicio, fechaFin;

    // MANEJAR DIFERENTES FORMATOS DE FECHA
    if (fecha.includes('T')) {
      // Formato ISO (2025-10-28T05:35:22.935Z)
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
      // Formato simple (2025-10-28)
      fechaInicio = new Date(fecha + 'T00:00:00.000Z');
      fechaFin = new Date(fecha + 'T23:59:59.999Z');
    }

    console.log('📅 RANGO DE BÚSQUEDA:', {
      fechaSolicitada: fecha,
      fechaInicio: fechaInicio.toISOString(),
      fechaFin: fechaFin.toISOString()
    });

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
    
    // VERIFICAR PRECIOS DE LAS CABECERAS
    cabeceras.forEach(cabecera => {
      console.log(`📊 Cabecera ${cabecera.id}:`, {
        precioTotalBD: cabecera.precioTotal,
        totalBD: cabecera.total,
        abonoBD: cabecera.abono,
        detallesCount: cabecera.Detalles?.length || 0,
        fecha: cabecera.fechaAsignacion
      });
    });

    return cabeceras;
    
  } catch (error) {
    console.error('❌ Error en buscarCabecerasPorFecha:', error);
    throw error;
  }
};

// 📅 OBTENER EXAMENES AGRUPADOS POR FECHA - VERSIÓN CORREGIDA
const obtenerExamenesAgrupadosPorFecha = async (req, res) => {
  try {
    const { id } = req.params;
    const pacienteId = parseInt(id);
    
    console.log('📊 OBTENIENDO EXAMENES AGRUPADOS POR FECHA - Paciente ID:', pacienteId);

    // ✅ CONSULTA CORREGIDA CON ASOCIACIONES VÁLIDAS
    const examenes = await ExamenPaciente.findAll({
      where: { pacienteId: id },
      include: [
        {
          model: ExamenPacienteDetalle,
          as: 'Detalles',
          include: [
            // ✅ EXAMEN PRINCIPAL
            {
              model: Examen,
              as: 'Examen',
              include: [
                { 
                  model: Area, 
                  as: 'Area'
                },
                // ❌ QUITAR Subexamenes de aquí - causan duplicación
              ]
            },
            // ✅ SUBEXAMEN
            {
              model: Subexamen,
              as: 'Subexamen',
              include: [
                {
                  model: Examen,
                  as: 'Examen',  // ✅ CORREGIDO: 'Examen' no 'ExamenPadre'
                  include: [
                    { 
                      model: Area, 
                      as: 'Area' 
                    }
                  ]
                }
              ]
            }
          ]
        },
        { 
          model: Paciente, 
          as: 'Paciente' 
        },
        { 
          model: Laboratorista, 
          as: 'Laboratorista' 
        },
        { 
          model: Sucursal, 
          as: 'Sucursal' 
        }
      ],
      order: [['fechaAsignacion', 'DESC']]
    });

    console.log(`✅ Se encontraron ${examenes.length} cabeceras`);

    if (!examenes || examenes.length === 0) {
      return res.json({ 
        success: true, 
        data: [], 
        mensaje: 'No se encontraron exámenes' 
      });
    }

    // ✅ VERIFICAR ESTRUCTURA DE DATOS RECIBIDA
    console.log('🔍 ESTRUCTURA DE DATOS ENCONTRADA:');
    examenes.forEach((cabecera, index) => {
      console.log(`\n📦 Cabecera ${index + 1} (ID: ${cabecera.id}):`);
      console.log(`   Fecha: ${cabecera.fechaAsignacion}`);
      console.log(`   Total: $${cabecera.total}`);
      console.log(`   Detalles: ${cabecera.Detalles?.length || 0}`);
      
      if (cabecera.Detalles && cabecera.Detalles.length > 0) {
        cabecera.Detalles.forEach((detalle, detIndex) => {
          console.log(`   🔍 Detalle ${detIndex + 1}:`, {
            id: detalle.id,
            examenId: detalle.examenId,
            subexamenId: detalle.subexamenId,
            nombreExamen: detalle.nombreExamen,
            precioFinal: detalle.precioFinal,
            esSubexamen: detalle.esSubexamen,
            tieneExamen: !!detalle.Examen,
            tieneSubexamen: !!detalle.Subexamen,
            // Información del examen principal (si existe)
            examenNombre: detalle.Examen?.nombre,
            examenArea: detalle.Examen?.Area?.nombre,
            // Información del subexamen (si existe)
            subexamenNombre: detalle.Subexamen?.nombre,
            subexamenPadre: detalle.Subexamen?.Examen?.nombre, // ✅ CORREGIDO
            subexamenArea: detalle.Subexamen?.Examen?.Area?.nombre // ✅ CORREGIDO
          });
        });
      }
    });

    // Procesar la jerarquía
    const gruposAgrupados = procesarJerarquiaCompleta(examenes);

    res.json({
      success: true,
      data: gruposAgrupados,
      totalGrupos: gruposAgrupados.length,
      pacienteId: pacienteId
    });

  } catch (error) {
    console.error('❌ Error al obtener exámenes agrupados por fecha:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// 🔍 OBTENER INFORMACIÓN DE REGISTRO DE DETALLE
const obtenerInformacionRegistroDetalle = async (req, res) => {
  try {
    const { detalleId } = req.params;
    
    console.log('🔍 SOLICITANDO INFORMACIÓN DE REGISTRO PARA DETALLE:', detalleId);

    const detalle = await ExamenPacienteDetalle.findByPk(detalleId, {
      include: [
        {
          model: Laboratorista,
          as: 'Laboratorista',
          attributes: ['id', 'nombres', 'apellidos', 'usuario']
        },
        {
          model: Sucursal,
          as: 'Sucursal',
          attributes: ['id', 'nombre']
        }
      ]
    });

    if (!detalle) {
      console.log('❌ Detalle no encontrado con ID:', detalleId);
      return res.status(404).json({
        success: false,
        message: 'Detalle de examen no encontrado'
      });
    }

    console.log('✅ DETALLE ENCONTRADO:', {
      id: detalle.id,
      registradoPor: detalle.registradoPor,
      fechaRegistro: detalle.fechaRegistro,
      horaRegistro: detalle.horaRegistro,
      laboratorio: detalle.laboratorio,
      laboratoristaId: detalle.laboratoristaId,
      tieneLaboratorista: !!detalle.Laboratorista
    });

    // ✅ CONSTRUIR INFORMACIÓN DE REGISTRO COMPLETA
    const informacionRegistro = {
      registradoPor: detalle.registradoPor || 
                    (detalle.Laboratorista ? 
                      `${detalle.Laboratorista.nombres} ${detalle.Laboratorista.apellidos}` : 
                      'No disponible'),
      fechaRegistro: detalle.fechaRegistro || detalle.createdAt,
      horaRegistro: detalle.horaRegistro || 
                   (detalle.createdAt ? 
                     detalle.createdAt.toTimeString().split(' ')[0] : 
                     'No disponible'),
      laboratorio: detalle.laboratorio || 
                  (detalle.Sucursal?.nombre || 'Laboratorio Central'),
      laboratoristaId: detalle.laboratoristaId
    };

    console.log('📊 INFORMACIÓN DE REGISTRO PROCESADA:', informacionRegistro);

    res.json({
      success: true,
      data: informacionRegistro
    });

  } catch (error) {
    console.error('❌ Error obteniendo información de registro:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información de registro',
      error: error.message
    });
  }
};

// FUNCIÓN PARA PROCESAR DETALLE EN EL GRUPO - VERSIÓN COMPLETA CORREGIDA
const procesarDetalleParaGrupo = (detalle, grupo) => {
  console.log('🔍 PROCESANDO DETALLE CORREGIDO:', {
    id: detalle.id,
    examenId: detalle.examenId,
    subexamenId: detalle.subexamenId,
    nombreExamen: detalle.nombreExamen,
    precioFinal: detalle.precioFinal,
    esSubexamen: detalle.esSubexamen,
    tieneExamen: !!detalle.Examen,
    tieneSubexamen: !!detalle.Subexamen,
    registradoPor: detalle.registradoPor,
    fechaRegistro: detalle.fechaRegistro,
    horaRegistro: detalle.horaRegistro,
    laboratorio: detalle.laboratorio,
    laboratoristaId: detalle.laboratoristaId
  });

  // ✅ VALIDACIÓN Y SANITIZACIÓN DE PRECIO
  const precioDetalle = parseFloat(detalle.precioFinal || detalle.precioAplicado || 0);
  if (isNaN(precioDetalle)) {
    console.warn(`   ⚠️ Precio inválido para detalle ${detalle.id}, usando 0`);
    precioDetalle = 0;
  }
  
  grupo.precioTotal += precioDetalle;

  let area = null;
  let examen = null;
  let areaNombre = 'General';
  let examenNombre = detalle.nombreExamen || 'Examen sin nombre';

  // ✅ DETERMINAR MEJOR SI ES SUBEXAMEN
  const esSubexamenReal = detalle.subexamenId !== null && detalle.examenId === null;
  
  console.log(`   📊 Tipo detalle: esSubexamen=${detalle.esSubexamen}, esSubexamenReal=${esSubexamenReal}, tieneSubexamen=${!!detalle.Subexamen}`);

  // ✅ INFORMACIÓN DE REGISTRO PARA TODOS LOS CASOS
  const informacionRegistroDetalle = {
    registradoPor: detalle.registradoPor || 
                  (detalle.Laboratorista ? 
                    `${detalle.Laboratorista.nombres} ${detalle.Laboratorista.apellidos}` : 
                    'No disponible'),
    fechaRegistro: detalle.fechaRegistro || detalle.createdAt,
    horaRegistro: detalle.horaRegistro || 
                 (detalle.createdAt ? 
                   detalle.createdAt.toTimeString().split(' ')[0] : 
                   'No disponible'),
    laboratorio: detalle.laboratorio || 
                (detalle.Sucursal?.nombre || 'Laboratorio Central'),
    laboratoristaId: detalle.laboratoristaId
  };

  console.log(`   📋 Información de registro del detalle:`, informacionRegistroDetalle);

  if (esSubexamenReal && detalle.Subexamen) {
    // ES UN SUBEXAMEN - PROCESAR COMO PARTE DEL EXAMEN PADRE
    console.log(`   🧪 Subexamen detectado: ${detalle.Subexamen.nombre}`);
    
    area = detalle.Subexamen.Examen?.Area;
    areaNombre = area?.nombre || 'General';
    
    // ✅ BUSCAR O CREAR EL EXAMEN PADRE
    const examenPadre = detalle.Subexamen.Examen;
    if (examenPadre) {
      examen = {
        id: examenPadre.id,
        nombre: examenPadre.nombre,
        precio: 0, // El examen padre no tiene precio individual
        tieneSubexamenes: true,
        subexamenes: [],
        descripcion: examenPadre.descripcion || '',
        metodo: examenPadre.metodo || '',
        tipoMuestra: examenPadre.tipoMuestra || 'No especificado',
        horaEntrega: examenPadre.horaEntrega || 'No especificado',
        tipoTubo: examenPadre.tipoTubo || 'No especificado',
        estado: detalle.estado || 'pendiente',
        // ✅ INFORMACIÓN DE REGISTRO DEL EXAMEN PADRE
        examenPacienteDetalleId: detalle.id,
        informacionRegistro: informacionRegistroDetalle
      };
      
      // ✅ AGREGAR EL SUBEXAMEN AL EXAMEN PADRE
      examen.subexamenes.push({
        id: detalle.Subexamen.id,
        nombre: detalle.Subexamen.nombre,
        precio: precioDetalle,
        tipo: 'subexamen',
        descripcion: detalle.Subexamen.descripcion || '',
        metodo: detalle.Subexamen.metodo || 'ECLIA', // Método específico del subexamen
        tipoMuestra: detalle.Subexamen.tipoMuestra || examenPadre.tipoMuestra || 'No especificado',
        horaEntrega: detalle.Subexamen.horaEntrega || examenPadre.horaEntrega || 'No especificado',
        tipoTubo: detalle.Subexamen.tipoTubo || examenPadre.tipoTubo || 'No especificado',
        estado: detalle.estado || 'pendiente',
        // ✅ INFORMACIÓN DE REGISTRO ESPECÍFICA DEL SUBEXAMEN
        examenPacienteDetalleId: detalle.id,
        informacionRegistro: informacionRegistroDetalle
      });
      
      console.log(`   ✅ Subexamen "${detalle.Subexamen.nombre}" agregado a "${examenPadre.nombre}"`);
    } else {
      // CASO DE EMERGENCIA: SUBEXAMEN SIN EXAMEN PADRE
      console.warn(`   ⚠️ Subexamen sin examen padre, creando examen individual`);
      examen = {
        id: detalle.Subexamen.id,
        nombre: detalle.Subexamen.nombre,
        precio: precioDetalle,
        tieneSubexamenes: false,
        subexamenes: [],
        descripcion: detalle.Subexamen.descripcion || '',
        metodo: detalle.Subexamen.metodo || '',
        tipoMuestra: detalle.Subexamen.tipoMuestra || 'No especificado',
        horaEntrega: detalle.Subexamen.horaEntrega || 'No especificado',
        tipoTubo: detalle.Subexamen.tipoTubo || 'No especificado',
        estado: detalle.estado || 'pendiente',
        // ✅ INFORMACIÓN DE REGISTRO
        examenPacienteDetalleId: detalle.id,
        informacionRegistro: informacionRegistroDetalle
      };
    }
    grupo.detallesConteo.subexamenes++;
    
    console.log(`   🧪 Subexamen procesado: ${detalle.Subexamen.nombre}, Área: ${areaNombre}, Precio: $${precioDetalle}`);

  } else if (detalle.Examen) {
    // ES UN EXAMEN PRINCIPAL
    console.log(`   🔬 Examen principal detectado: ${detalle.Examen.nombre}`);
    
    area = detalle.Examen.Area;
    areaNombre = area?.nombre || 'General';
    examenNombre = detalle.Examen.nombre || detalle.nombreExamen;
    
    // VERIFICAR SI TIENE SUBEXAMENES
    const tieneSubexamenes = detalle.Examen.Subexamenes && detalle.Examen.Subexamenes.length > 0;
    
    examen = {
      id: detalle.Examen.id,
      nombre: examenNombre,
      precio: tieneSubexamenes ? 0 : precioDetalle, // Solo tiene precio si no tiene subexámenes
      tieneSubexamenes: tieneSubexamenes,
      subexamenes: [],
      descripcion: detalle.Examen.descripcion || '',
      metodo: detalle.Examen.metodo || '',
      tipoMuestra: detalle.Examen.tipoMuestra || 'No especificado',
      horaEntrega: detalle.Examen.horaEntrega || 'No especificado',
      tipoTubo: detalle.Examen.tipoTubo || 'No especificado',
      estado: detalle.estado || 'pendiente',
      // ✅ INFORMACIÓN DE REGISTRO
      examenPacienteDetalleId: detalle.id,
      informacionRegistro: informacionRegistroDetalle
    };
    
    // SI TIENE SUBEXAMENES, AGREGARLOS (pero sin precio - se procesan por separado)
    if (tieneSubexamenes && detalle.Examen.Subexamenes) {
      detalle.Examen.Subexamenes.forEach(sub => {
        examen.subexamenes.push({
          id: sub.id,
          nombre: sub.nombre,
          precio: 0, // Los subexámenes se procesarán por separado
          tipo: 'subexamen',
          descripcion: sub.descripcion || '',
          metodo: sub.metodo || '',
          tipoMuestra: sub.tipoMuestra || detalle.Examen.tipoMuestra || 'No especificado',
          horaEntrega: sub.horaEntrega || detalle.Examen.horaEntrega || 'No especificado',
          tipoTubo: sub.tipoTubo || detalle.Examen.tipoTubo || 'No especificado',
          // ✅ INFORMACIÓN DE REGISTRO PARA SUBEXAMENES (cuando se procesen individualmente)
          examenPacienteDetalleId: null, // Se asignará cuando se procese el detalle específico
          informacionRegistro: {
            registradoPor: 'No asignado',
            fechaRegistro: null,
            horaRegistro: null,
            laboratorio: 'Laboratorio Central',
            laboratoristaId: null
          }
        });
      });
      console.log(`   📋 Examen tiene ${detalle.Examen.Subexamenes.length} subexámenes (sin procesar)`);
    }
    
    grupo.detallesConteo.examenesPrincipales++;
    console.log(`   🔬 Examen principal procesado: ${examenNombre}, Área: ${areaNombre}, Precio: $${precioDetalle}, Tiene subexámenes: ${tieneSubexamenes}`);

  } else {
    // CASO DE FALLBACK MEJORADO
    console.warn(`   ⚠️ Detalle sin información completa, usando datos básicos`);
    
    // INTENTAR OBTENER INFORMACIÓN DE CUALQUIER MANERA
    if (detalle.Examen) {
      areaNombre = detalle.Examen.Area?.nombre || 'General';
      examenNombre = detalle.Examen.nombre || detalle.nombreExamen;
    } else if (detalle.Subexamen) {
      areaNombre = detalle.Subexamen.Examen?.Area?.nombre || 'General';
      examenNombre = detalle.Subexamen.nombre || detalle.nombreExamen;
    }
    
    examen = {
      id: detalle.id,
      nombre: examenNombre,
      precio: precioDetalle,
      tieneSubexamenes: false,
      subexamenes: [],
      descripcion: '',
      metodo: '',
      tipoMuestra: 'No especificado',
      horaEntrega: 'No especificado',
      tipoTubo: 'No especificado',
      estado: detalle.estado || 'pendiente',
      // ✅ INFORMACIÓN DE REGISTRO
      examenPacienteDetalleId: detalle.id,
      informacionRegistro: informacionRegistroDetalle
    };
    
    if (esSubexamenReal) {
      grupo.detallesConteo.subexamenes++;
      console.log(`   🧪 Subexamen procesado (fallback): ${examenNombre}`);
    } else {
      grupo.detallesConteo.examenesPrincipales++;
      console.log(`   🔬 Examen principal procesado (fallback): ${examenNombre}`);
    }
  }

  // ✅ AGREGAR AL GRUPO SI HAY EXAMEN VÁLIDO
  if (examen) {
    const areaId = area?.id || 'general';
    const areaNombreFinal = area?.nombre || 'General';

    if (!grupo.areas.has(areaId)) {
      grupo.areas.set(areaId, {
        id: areaId,
        nombre: areaNombreFinal,
        precioTotal: 0,
        examenes: new Map()
      });
      console.log(`   🆕 Nueva área creada: ${areaNombreFinal}`);
    }

    const areaGrupo = grupo.areas.get(areaId);

    if (!areaGrupo.examenes.has(examen.id)) {
      areaGrupo.examenes.set(examen.id, examen);
      console.log(`   ✅ Nuevo examen agregado: ${examen.nombre}`);
    } else {
      // EXAMEN EXISTENTE - ACTUALIZAR SUBEXAMENES O PRECIO
      const examenExistente = areaGrupo.examenes.get(examen.id);
      
      if (examen.tieneSubexamenes && examen.subexamenes.length > 0) {
        // AGREGAR SUBEXAMENES NUEVOS
        examen.subexamenes.forEach(nuevoSub => {
          const subExiste = examenExistente.subexamenes.some(sub => sub.id === nuevoSub.id);
          if (!subExiste && nuevoSub.precio > 0) { // Solo agregar si tiene precio
            examenExistente.subexamenes.push(nuevoSub);
            console.log(`   ➕ Subexamen agregado a examen existente: ${nuevoSub.nombre} - $${nuevoSub.precio}`);
          }
        });
      } else if (examen.precio > 0) {
        // ACTUALIZAR PRECIO DEL EXAMEN PRINCIPAL
        examenExistente.precio = examen.precio;
        console.log(`   💰 Precio actualizado para examen: ${examen.nombre} - $${examen.precio}`);
      }
      
      // ✅ ACTUALIZAR INFORMACIÓN DE REGISTRO SI ES MÁS RECIENTE
      if (examen.informacionRegistro && examen.informacionRegistro.fechaRegistro) {
        const fechaNueva = new Date(examen.informacionRegistro.fechaRegistro);
        const fechaExistente = new Date(examenExistente.informacionRegistro?.fechaRegistro || 0);
        
        if (fechaNueva > fechaExistente) {
          examenExistente.informacionRegistro = examen.informacionRegistro;
          console.log(`   📅 Información de registro actualizada para: ${examen.nombre}`);
        }
      }
    }

    // ACTUALIZAR PRECIO TOTAL DEL ÁREA
    areaGrupo.precioTotal += precioDetalle;
    console.log(`   📊 Área ${areaNombreFinal} - Precio total: $${areaGrupo.precioTotal}`);
  } else {
    console.warn(`   ❌ No se pudo procesar el detalle ${detalle.id}`);
  }

  grupo.detallesConteo.total++;
  console.log(`   📈 Conteo actual: ${grupo.detallesConteo.total} detalles procesados`);
};

module.exports = {
  // ASIGNACIÓN
  asignarExamenes,
  
  // CONSULTAS
  obtenerExamenesConArea,
  obtenerResumenExamenesPaciente,
  obtenerExamenesAgrupadosPorFecha,
  obtenerExamenesConPreciosSeparados,
  
  // ACTUALIZACIONES
  actualizarEstadoExamen,
  subirResultadoExamen,
  
  // FUNCIONES AUXILIARES
  calcularPreciosExamenCorregido,
  buscarCabecerasPorFecha,
  extraerPreciosConcatenados,
  procesarJerarquiaCompleta,
  obtenerInformacionRegistroDetalle
};