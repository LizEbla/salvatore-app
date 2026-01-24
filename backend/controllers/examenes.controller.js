//controller/examenes.controller.js

const db = require('../models');
const { Op, Sequelize } = require('sequelize');
const forge = require('node-forge');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const crypto = require('crypto');





const path = require('path');


// Modelos
const { ExamenPaciente, ExamenPacienteDetalle, Examen, Area, Subexamen, Paciente, Laboratorista, Sucursal, Promocion,HistorialResultados } = db;

// 🩺 ASIGNAR EXAMENES A PACIENTE
const asignarExamenes = async (req, res) => {
  const t = await db.sequelize.transaction();
  
  try {
    const pacienteId = req.params.id;
    
    console.log('🎯 ========== ASIGNACIÓN DE EXÁMENES ==========');
    console.log('🔐 USUARIO AUTENTICADO:', {
      id: req.usuario?.id,
      tipo: req.usuario?.tipoUsuario,
      nombres: req.usuario?.nombres,
      sucursalActual: req.usuario?.sucursalActual
    });

    if (!req.usuario) {
      await t.rollback();
      return res.status(401).json({ 
        success: false,
        message: 'No autenticado' 
      });
    }

    // ✅ PERMITIR AMBOS ROLES
    const tiposPermitidos = ['laboratorista', 'administrador', 'superadmin'];
    
    if (!tiposPermitidos.includes(req.usuario.tipoUsuario)) {
      await t.rollback();
      return res.status(403).json({
        success: false,
        message: 'Solo el personal autorizado puede asignar exámenes'
      });
    }

    const usuarioId = parseInt(req.usuario.id);
    
    if (isNaN(usuarioId) || usuarioId <= 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'ID de usuario inválido'
      });
    }

    const { observaciones, examenes, medicoSolicitante } = req.body;

    // ✅ VALIDACIONES
    if (!Array.isArray(examenes) || examenes.length === 0) {
      await t.rollback();
      return res.status(400).json({ 
        success: false,
        message: 'Debe enviar al menos un examen' 
      });
    }

    // ✅ VARIABLES PARA REGISTRO
    let laboratoristaId = null;
    let sucursalId = null;
    let sucursalNombre = 'Sin sucursal';
    let asignadoPor = `${req.usuario.nombres} ${req.usuario.apellidos}`;

    // ✅ SI ES LABORATORISTA
    if (req.usuario.tipoUsuario === 'laboratorista') {
      const laboratorista = await Laboratorista.findByPk(usuarioId, {
        include: [{ 
          model: Sucursal, 
          as: 'Sucursal' 
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

      laboratoristaId = laboratorista.id;
      sucursalId = laboratorista.Sucursal?.id || null;
      sucursalNombre = laboratorista.Sucursal?.nombre || 'Sin sucursal';
      asignadoPor = `${laboratorista.nombres} ${laboratorista.apellidos}`;
    } 
    // ✅ SI ES ADMINISTRADOR
    else if (req.usuario.tipoUsuario === 'administrador' || req.usuario.tipoUsuario === 'superadmin') {
      console.log('👨‍💼 Administrador asignando exámenes');
      
      // 1. OBTENER SUCURSAL DEL TOKEN
      if (req.usuario.sucursalActual) {
        sucursalId = req.usuario.sucursalActual.id;
        sucursalNombre = req.usuario.sucursalActual.nombre;
        console.log(`🏢 Usando sucursal del token: ${sucursalNombre}`);
      } else {
        // Sucursal por defecto
        const sucursalDefault = await Sucursal.findOne({
          order: [['id', 'ASC']],
          transaction: t
        });
        if (sucursalDefault) {
          sucursalId = sucursalDefault.id;
          sucursalNombre = sucursalDefault.nombre;
        }
      }
      
      // 2. BUSCAR LABORATORISTA POR DEFECTO PARA ADMINISTRADORES
      console.log('🔍 Buscando laboratorista por defecto para administrador...');
      // controllers/examenes.controller.js - LÍNEA 127 (aproximadamente)
const laboratoristaDefault = await Laboratorista.findOne({
  where: { activo: true }, // ✅ CAMBIAR "estado" por "activo"
  order: [['id', 'ASC']],
  transaction: t
});
      
      if (laboratoristaDefault) {
        laboratoristaId = laboratoristaDefault.id;
        console.log(`👨‍🔬 Laboratorista por defecto asignado: ${laboratoristaDefault.nombres}`);
      } else {
        // Si no hay laboratoristas, crear uno ficticio o usar ID 1
        console.warn('⚠️ No se encontraron laboratoristas en el sistema');
        // laboratoristaId = 1; // Descomentar si tienes un laboratorista con ID 1
      }
    }

    // ✅ VALIDAR QUE TENGA SUCURSAL
    if (!sucursalId) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'No se pudo determinar la sucursal'
      });
    }

    console.log('✅ CONFIGURACIÓN FINAL:', {
      laboratoristaId,
      sucursalId,
      sucursalNombre,
      asignadoPor,
      tipoUsuario: req.usuario.tipoUsuario
    });

    // ✅ CALCULAR PRECIOS
    let totalCalculado = 0;
    let descuentoTotalGrupo = 0;

    for (const examenData of examenes) {
      const calculoPrecios = calcularPreciosExamenCorregido(examenData);
      totalCalculado += calculoPrecios.precioFinal;
      descuentoTotalGrupo += calculoPrecios.descuentoAplicado;
    }

    // ✅ CREAR CABECERA CON CAMPOS NUEVOS
    const cabecera = await ExamenPaciente.create({
      pacienteId,
      // ✅ CAMPOS PARA RASTREO COMPLETO
      usuarioAsignadorId: usuarioId,
      tipoUsuarioAsignador: req.usuario.tipoUsuario,
      asignadoPor: asignadoPor,
      // ✅ CAMPOS EXISTENTES (laboratoristaId puede ser null)
      laboratoristaId: laboratoristaId,
      sucursalId: sucursalId,
      observaciones: observaciones || '',
      cantidadExamenes: examenes.length,
      estadoPago: 'pendiente',
      abono: 0,
      total: totalCalculado,
      saldoPendiente: totalCalculado,
      fechaAsignacion: new Date(),
      medicoSolicitante: medicoSolicitante || null
    }, { 
      transaction: t,
      // ✅ IGNORAR VALIDACIÓN DE laboratoristaId SI ES NULL
      // validate: laboratoristaId !== null // Opcional
    });

    console.log('✅ CABECERA CREADA:', {
      id: cabecera.id,
      laboratoristaId: cabecera.laboratoristaId,
      usuarioAsignadorId: cabecera.usuarioAsignadorId,
      tipoUsuarioAsignador: cabecera.tipoUsuarioAsignador
    });

    // ✅ PROCESAR DETALLES
    const detallesLimpios = examenes.map(examenData => {
      const calculoPrecios = calcularPreciosExamenCorregido(examenData);

      return {
        examenPacienteId: cabecera.id,
        precioAplicado: calculoPrecios.precioAplicado,
        descuentoAplicado: calculoPrecios.descuentoAplicado,
        precioFinal: calculoPrecios.precioFinal,
        estado: 'pendiente',
        // ✅ INFORMACIÓN DEL ASIGNADOR
        usuarioRegistroId: usuarioId,
        tipoUsuarioRegistro: req.usuario.tipoUsuario,
        registradoPor: asignadoPor,
        // ✅ DATOS DE SUCURSAL
        sucursalId: sucursalId,
        laboratorio: sucursalNombre,
        // ✅ INFORMACIÓN DEL EXAMEN
        nombreExamen: (examenData.nombreExamen || 'Examen sin nombre').substring(0, 500),
        medicoSolicitanteDetalle: medicoSolicitante || null,
        // ✅ TIPO DE EXAMEN
        examenId: examenData.esSubexamen ? null : examenData.examenId,
        subexamenId: examenData.esSubexamen ? examenData.examenId : null,
        esSubexamen: examenData.esSubexamen || false,
        // ✅ LABORATORISTA (mismo que cabecera o null)
        laboratoristaId: laboratoristaId,
        // ✅ TIMESTAMPS
        fechaRegistro: new Date(),
        horaRegistro: new Date().toTimeString().split(' ')[0],
        createdAt: new Date(),
        updatedAt: new Date()
      };
    });

    // ✅ INSERTAR DETALLES
    const detallesInsertados = await ExamenPacienteDetalle.bulkCreate(detallesLimpios, { 
      transaction: t,
      returning: true
    });

    await t.commit();
    
    console.log('🎉 ASIGNACIÓN COMPLETADA');
    
    return res.status(201).json({
      success: true,
      message: `Se asignaron ${examenes.length} exámenes correctamente en ${sucursalNombre}`,
      data: {
        cabeceraId: cabecera.id,
        cantidadExamenes: cabecera.cantidadExamenes,
        total: cabecera.total,
        asignadoPor: cabecera.asignadoPor,
        tipoUsuarioAsignador: cabecera.tipoUsuarioAsignador,
        sucursalNombre: sucursalNombre
      }
    });
    
  } catch (error) {
    await t.rollback();
    console.error('❌ ERROR EN ASIGNACIÓN:', error);
    
    // ✅ ERROR ESPECÍFICO PARA laboratoristaId NULL
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map(err => err.message).join(', ');
      return res.status(400).json({
        success: false,
        message: `Error de validación: ${messages}`,
        suggestion: 'Por favor, asegúrese de que existe al menos un laboratorista activo en el sistema'
      });
    }
    
    return res.status(500).json({ 
      success: false,
      message: 'Error al asignar exámenes', 
      error: error.message
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



// ✅ MÉTODO COMPLETAMENTE CORREGIDO PARA GENERAR PDF
const generarPDFResultados = async (req, res) => {
  try {
    const { paciente, examen, resultados, plantilla, fechaGeneracion, laboratoristaId } = req.body;
    
    console.log('📄 Generando PDF individual para examen:', examen?.nombre);
    console.log('👤 Paciente:', paciente?.nombres, paciente?.apellidos);

    // Validar datos requeridos
    if (!paciente || !examen) {
      return res.status(400).json({
        success: false,
        mensaje: 'Datos incompletos para generar PDF'
      });
    }

    // ✅ VERIFICAR QUE PDFKIT ESTÉ DISPONIBLE
    let PDFDocument;
    try {
      PDFDocument = require('pdfkit');
    } catch (pdfkitError) {
      console.error('❌ PDFKit no está instalado:', pdfkitError);
      return res.status(500).json({
        success: false,
        mensaje: 'PDFKit no está disponible. Ejecuta: npm install pdfkit'
      });
    }

    // ✅ SANITIZAR NOMBRE DEL ARCHIVO
    const sanitizeFilename = (filename) => {
      if (!filename) return 'archivo';
      return filename
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
        .replace(/[^a-zA-Z0-9\s_-]/g, '') // Eliminar caracteres especiales
        .replace(/\s+/g, '_') // Reemplazar espacios con _
        .substring(0, 100); // Limitar longitud
    };

    const nombrePaciente = `${paciente.nombres || ''}_${paciente.apellidos || ''}`.trim() || 'Paciente';
    const nombreExamen = examen.nombre || 'Examen';
    
    const filename = `resultado_${sanitizeFilename(nombreExamen)}_${sanitizeFilename(nombrePaciente)}.pdf`;
    
    console.log('📁 Nombre de archivo sanitizado:', filename);

    // ✅ CREAR EL PDF
    const doc = new PDFDocument();
    
    // ✅ CONFIGURAR HEADERS ANTES DE ENVIAR
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    console.log('✅ Headers configurados, iniciando generación de PDF...');

    // ✅ PIPEAR DIRECTAMENTE A LA RESPUESTA
    doc.pipe(res);

    // ✅ AGREGAR CONTENIDO AL PDF
    doc.fontSize(20).text('RESULTADOS DE LABORATORIO', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(12)
       .text(`Paciente: ${paciente.nombres || ''} ${paciente.apellidos || ''}`)
       .text(`Cédula: ${paciente.cedula || 'No especificada'}`)
       .text(`Edad: ${paciente.edad || 'No especificada'} | Sexo: ${paciente.sexo || 'No especificado'}`);
    
    doc.moveDown();
    doc.fontSize(16).text(`Examen: ${examen.nombre || 'Examen no especificado'}`);
    doc.moveDown();
    
    // ✅ AGREGAR RESULTADOS
    if (resultados && Object.keys(resultados).length > 0) {
      doc.fontSize(14).text('RESULTADOS:');
      doc.moveDown(0.5);
      
      if (typeof resultados === 'object') {
        Object.keys(resultados).forEach((key, index) => {
          doc.fontSize(10).text(`${key}: ${resultados[key]}`, { 
            indent: 20,
            continued: false
          });
        });
      } else {
        doc.fontSize(10).text(`Resultado: ${resultados}`);
      }
    } else {
      doc.fontSize(12).text('No hay resultados disponibles');
    }
    
    doc.moveDown();
    doc.fontSize(10)
       .text(`Fecha de generación: ${fechaGeneracion || new Date().toLocaleString('es-ES')}`)
       .text('Laboratorio Clínico - Sistema de Gestión');

    // ✅ FINALIZAR EL PDF
    doc.end();
    
    console.log('✅ PDF generado y enviado correctamente');

  } catch (error) {
    console.error('❌ Error generando PDF individual:', error);
    
    // ✅ ENVIAR ERROR COMO JSON
    res.status(500).json({
      success: false,
      mensaje: 'Error generando PDF: ' + error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};







// 🔍 COMPARAR RESULTADOS Y DETECTAR CAMBIOS
const compararResultados = (anteriores, nuevos) => {
  const cambios = [];
  
  if (!anteriores) {
    return ['Creación inicial de resultados'];
  }

  // Comparar objetos simples
  if (typeof anteriores === 'object' && typeof nuevos === 'object') {
    const todasClaves = new Set([...Object.keys(anteriores), ...Object.keys(nuevos)]);
    
    todasClaves.forEach(clave => {
      const valorAnterior = anteriores[clave];
      const valorNuevo = nuevos[clave];
      
      if (valorAnterior !== valorNuevo) {
        cambios.push(`Campo "${clave}" cambiado de "${valorAnterior}" a "${valorNuevo}"`);
      }
    });
  } else if (anteriores !== nuevos) {
    // Comparar valores primitivos
    cambios.push(`Resultado cambiado de "${anteriores}" a "${nuevos}"`);
  }
  
  return cambios.length > 0 ? cambios : ['Sin cambios detectados'];
};


// 📚 OBTENER HISTORIAL DE CAMBIOS
const obtenerHistorialResultados = async (req, res) => {
  try {
    const { detalleId } = req.params;
    
    console.log('📚 Solicitando historial para detalle:', detalleId);

    const historial = await HistorialResultados.findAll({
      where: { examenPacienteDetalleId: detalleId },
      include: [{
        model: Laboratorista,
        as: 'Laboratorista',
        attributes: ['id', 'nombres', 'apellidos', 'usuario']
      }],
      order: [['createdAt', 'DESC']]
    });

    console.log(`✅ Encontrados ${historial.length} registros de historial`);

    // Procesar el historial para frontend
    const historialProcesado = historial.map(registro => ({
      id: registro.id,
      laboratorista: registro.Laboratorista ? {
        id: registro.Laboratorista.id,
        nombre: `${registro.Laboratorista.nombres} ${registro.Laboratorista.apellidos}`,
        usuario: registro.Laboratorista.usuario
      } : null,
      resultadosAnteriores: registro.resultadosAnteriores,
      resultadosNuevos: registro.resultadosNuevos,
      cambios: JSON.parse(registro.cambios || '[]'),
      accion: registro.accion,
      fecha: registro.createdAt
    }));

    res.json({
      success: true,
      data: historialProcesado
    });

  } catch (error) {
    console.error('❌ Error obteniendo historial:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al obtener historial de cambios',
      error: error.message
    });
  }
};

// 🔍 OBTENER DETALLE COMPLETO CON HISTORIAL
const obtenerDetalleCompleto = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 Obteniendo detalle completo ID:', id);

    const detalle = await ExamenPacienteDetalle.findByPk(id, {
      include: [
        {
          model: ExamenPaciente,
          as: 'Cabecera',
          include: [{
            model: Paciente,
            as: 'Paciente'
          }]
        },
        {
          model: Examen,
          as: 'Examen'
        },
        {
          model: Subexamen,
          as: 'Subexamen',
          include: [{
            model: Examen,
            as: 'Examen'
          }]
        },
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
      return res.status(404).json({
        success: false,
        message: 'Detalle de examen no encontrado'
      });
    }

    // Obtener historial reciente (últimos 10 registros)
    const historial = await HistorialResultados.findAll({
      where: { examenPacienteDetalleId: id },
      include: [{
        model: Laboratorista,
        as: 'Laboratorista',
        attributes: ['id', 'nombres', 'apellidos', 'usuario']
      }],
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    const historialProcesado = historial.map(registro => ({
      id: registro.id,
      laboratorista: registro.Laboratorista ? {
        id: registro.Laboratorista.id,
        nombre: `${registro.Laboratorista.nombres} ${registro.Laboratorista.apellidos}`
      } : null,
      cambios: JSON.parse(registro.cambios || '[]'),
      accion: registro.accion,
      fecha: registro.createdAt
    }));

    res.json({
      success: true,
      data: {
        detalle: detalle,
        historial: historialProcesado,
        permisos: {
          puedeEditar: true, // ✅ TODOS pueden editar ahora
          puedeVer: true,
          ultimoEditor: detalle.Laboratorista ? 
            `${detalle.Laboratorista.nombres} ${detalle.Laboratorista.apellidos}` : 
            'Desconocido'
        }
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo detalle completo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener detalle del examen',
      error: error.message
    });
  }
};

// 📝 REGISTRAR EN HISTORIAL - VERSIÓN CORREGIDA
const registrarEnHistorial = async (detalle, laboratoristaId, resultadosNuevos, accion = 'edicion') => {
  try {
    console.log('📝 Registrando en historial:', {
      detalleId: detalle.id,
      laboratoristaId,
      accion
    });

    const historial = await HistorialResultados.create({
      examenPacienteDetalleId: detalle.id,
      laboratoristaId: laboratoristaId,
      resultadosAnteriores: detalle.resultados, // Guardamos los resultados anteriores
      resultadosNuevos: resultadosNuevos,
      cambios: JSON.stringify(compararResultados(detalle.resultados, resultadosNuevos)),
      accion: accion
    });

    console.log('✅ Registro de historial creado ID:', historial.id);
    return historial;
  } catch (error) {
    console.error('❌ Error registrando en historial:', error);
    throw error;
  }
};


// En el método que completa los exámenes - AGREGAR:
const completarExamen = async (req, res) => {
  try {
    const { id } = req.params;
    const { resultados, observaciones } = req.body;
    const laboratoristaId = req.usuario.id;

    // Buscar el detalle del examen
    const detalle = await ExamenPacienteDetalle.findByPk(id, {
      include: [
        {
          model: Examen,
          as: 'Examen',
          include: [{ model: Area, as: 'Area' }]
        },
        {
          model: ExamenPaciente,
          as: 'ExamenPaciente',
          include: [{ model: Paciente }]
        }
      ]
    });

    if (!detalle) {
      return res.status(404).json({ message: 'Examen no encontrado' });
    }

    // Actualizar el examen
    await detalle.update({
      estado: 'completado',
      resultados: resultados || {},
      observaciones: observaciones,
      fechaRealizacion: new Date(),
      laboratoristaId
    });

    // ✅ GENERAR Y GUARDAR PDF INDIVIDUAL
    await generarYGuardarPdfIndividual(detalle);

    res.json({ 
      success: true, 
      message: 'Examen completado y PDF generado',
      detalle 
    });

  } catch (error) {
    console.error('❌ Error completando examen:', error);
    res.status(500).json({ message: 'Error completando examen', error: error.message });
  }
};

exports.actualizarResultado = async (req, res) => {
  try {
    const { id } = req.params;
    const { resultado, metodo, observaciones, marcarComolisto, enviarEstado } = req.body;
    
    console.log(`🎯 ========== ACTUALIZANDO RESULTADO ==========`);
    console.log(`🔍 PARAMS recibidos:`, { id });
    console.log(`📦 BODY recibido:`, req.body);

    // Buscar el detalle
    const detalle = await ExamenPacienteDetalle.findByPk(id, {
      include: [
        {
          model: ExamenPaciente,
          as: 'ExamenPaciente',
          include: [{ model: Paciente }]
        },
        {
          model: Examen,
          as: 'Examen'
        }
      ]
    });

    if (!detalle) {
      return res.status(404).json({ message: 'Detalle de examen no encontrado' });
    }

    console.log(`📊 ESTADO ACTUAL DEL DETALLE:`, {
      id: detalle.id,
      resultados_actuales: detalle.resultados,
      estado_actual: detalle.estado,
      laboratorista_original: detalle.laboratoristaId,
      usuario_actual: req.usuario.id
    });

    // Registrar en historial
    await HistorialResultados.create({
  examenPacienteDetalleId: detalle.id,   // 👈 CAMBIADO
  laboratoristaId: req.usuario.id,
  accion: 'edicion',
  resultadosAnteriores: detalle.resultados,
  resultadosNuevos: resultado,
  observacionesAnteriores: detalle.observaciones,
  observacionesNuevas: observaciones,
  cambios: JSON.stringify(
    compararResultados(detalle.resultados, resultado)
  ),
  createdAt: new Date()
});


    console.log('✅ Registro de historial creado');

    // Preparar datos de actualización
    const datosActualizacion = {
      resultados: resultado,
      observaciones: observaciones,
      parametrosResultados: {
        metodo: metodo,
        ultimaEdicionPor: req.usuario.id,
        ultimaEdicionEn: new Date()
      },
      laboratoristaId: req.usuario.id,
      updatedAt: new Date()
    };

    // Si se marca como listo, cambiar estado a completado
    if (marcarComolisto) {
      datosActualizacion.estado = 'completado';
      datosActualizacion.fechaCompletado = new Date();
      
      // ✅ NUEVO: Marcar para generación de PDF
      datosActualizacion.pdfPendiente = true;
      console.log(`📄 Examen marcado como completado - PDF pendiente de generación`);
    }

    // Actualizar el detalle
    await detalle.update(datosActualizacion);

    console.log('🎉 ACTUALIZACIÓN EXITOSA');

    res.json({
      message: 'Resultado actualizado correctamente',
      detalle: {
        id: detalle.id,
        estado: datosActualizacion.estado || detalle.estado,
        resultados: resultado,
        pdfPendiente: datosActualizacion.pdfPendiente || false
      }
    });

  } catch (error) {
    console.error('❌ Error actualizando resultado:', error);
    res.status(500).json({ 
      message: 'Error actualizando resultado', 
      error: error.message 
    });
  }
};







// 📋 OBTENER TIPOS DE EXAMEN - VERSIÓN CORREGIDA
const obtenerTiposExamen = async (req, res) => {
  try {
    console.log('🔍 Obteniendo tipos de examen...');
    
    // ✅ VERIFICAR QUE LOS MODELOS EXISTAN
    if (!db.Examen) {
      throw new Error('Modelo Examen no está definido en db');
    }
    
    const tiposExamen = await db.Examen.findAll({
      attributes: ['id', 'nombre', 'descripcion', 'precio', 'metodo', 'tipoMuestra'],
      include: [
        {
          model: db.Area || db.areas, // ✅ FLEXIBLE
          as: 'Area',
          attributes: ['id', 'nombre'],
          required: false // ✅ EVITA ERROR SI NO HAY ÁREA
        }
      ],
      order: [['nombre', 'ASC']]
    });

    console.log(`✅ Se encontraron ${tiposExamen.length} tipos de examen`);

    res.json({
      success: true,
      data: tiposExamen,
      total: tiposExamen.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo tipos de examen:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener tipos de examen',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
};

// 🎁 OBTENER PROMOCIONES ACTIVAS - VERSIÓN CORREGIDA
const obtenerPromocionesActivas = async (req, res) => {
  try {
    console.log('🔍 Obteniendo promociones activas...');
    
    // ✅ VERIFICAR SI EL MODELO EXISTE
    if (!db.Promocion) {
      console.warn('⚠️ Modelo Promocion no encontrado, retornando array vacío');
      return res.json({
        success: true,
        data: [],
        total: 0,
        message: 'Módulo de promociones no disponible'
      });
    }
    
    const promociones = await db.Promocion.findAll({
      where: {
        estado: 'activa',
        fechaInicio: { [db.Sequelize.Op.lte]: new Date() },
        fechaFin: { [db.Sequelize.Op.gte]: new Date() }
      },
      attributes: ['id', 'nombre', 'descripcion', 'descuento', 'fechaInicio', 'fechaFin', 'estado'],
      order: [['fechaInicio', 'DESC']]
    });

    console.log(`✅ Se encontraron ${promociones.length} promociones activas`);

    res.json({
      success: true,
      data: promociones,
      total: promociones.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo promociones activas:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener promociones',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
};



const firmarExamen = async (req, res) => {
  try {
    const examenId = req.params.id;
    const { pin } = req.body;

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'Debe enviar un archivo .p12 / .pfx'
      });
    }

    const certificadoBuffer = fs.readFileSync(req.file.path);

    console.log("📦 Cargando certificado .p12");
    const p12Asn1 = forge.asn1.fromDer(certificadoBuffer.toString('binary'));
    
    let p12;
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, pin);
    } catch (err) {
      console.error("❌ PIN incorrecto o certificado inválido");
      return res.status(400).json({ 
        success: false, 
        message: 'PIN inválido o certificado corrupto'
      });
    }

    console.log("🔍 Extrayendo clave privada y certificado...");
    let privateKey, certificate;

    const bags = p12.getBags({ 
      bagType: forge.pki.oids.pkcs8ShroudedKeyBag 
    });
    privateKey = bags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key;

    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    certificate = certBags[forge.pki.oids.certBag][0].cert;

    console.log("✔ Firma electrónica cargada correctamente");

    // Obtener el PDF desde la BD
    const detalle = await ExamenPacienteDetalle.findByPk(examenId);

    if (!detalle || !detalle.pdfGenerado) {
      return res.status(400).json({
        success: false,
        message: 'El examen aún no tiene PDF generado'
      });
    }

    const pdfBytes = detalle.pdfGenerado;

    // Firmar el PDF (firma detached PKCS#7)
    console.log("📝 Generando firma PKCS#7");

    const md = forge.md.sha256.create();
    md.update(pdfBytes.toString('binary'));

    const signature = forge.pkcs7.createSignedData();
    signature.content = forge.util.createBuffer(pdfBytes.toString('binary'));

    signature.addCertificate(certificate);
    signature.addSigner({
      key: privateKey,
      certificate,
      digestAlgorithm: forge.pki.oids.sha256
    });

    signature.sign({ detached: true });

    const firmaPkcs7 = forge.asn1.toDer(signature.toAsn1()).getBytes();

    // Guardar hash del PDF
    const hashSHA = crypto.createHash('sha256').update(pdfBytes).digest('hex');

    console.log("🔐 HASH SHA256:", hashSHA);

    // Insertar firma visible al final del PDF
    console.log("🖊 Insertando firma visible en PDF...");

const pdfDoc = await PDFDocument.load(pdfBytes);
const pages = pdfDoc.getPages();
const firstPage = pages[0];

const text = `Firmado electrónicamente por:
${nombreFirmante}
Fecha: ${new Date().toLocaleString('es-EC')}
Certificado válido (EC)`;

// Dibujar recuadro
firstPage.drawRectangle({
  x: 50,
  y: 40,
  width: 300,
  height: 70,
  borderWidth: 1.5,
});

// Dibujar texto
firstPage.drawText(text, {
  x: 55,
  y: 95,
  size: 10,
  lineHeight: 12
});

const pdfFinal = await pdfDoc.save();


    // Guardar en BD
    await detalle.update({
  firmaElectronica: {
    archivo: firmaPkcs7,
    hash: hashSHA,
    firmante: nombreFirmante,
    nombreArchivo: req.file.originalname
  },
  firmaVisual: {
    x: 50,
    y: 40,
    width: 300,
    height: 70,
    fecha: new Date(),
  },
  pdfGenerado: Buffer.from(pdfFinal),
  fechaFirma: new Date(),
  estadoFirma: "firmado",
  laboratoristaFirmaId: req.usuario.id
});


    return res.json({
      success: true,
      message: 'Examen firmado correctamente',
      hash: hashSHA
    });

  } catch (error) {
    console.error("❌ Error firmando examen:", error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno firmando el examen',
      error: error.message 
    });
  }
};


// 🔍 FUNCIONES AUXILIARES PARA DETECTAR RESULTADOS - AGREGAR AQUÍ
const tieneResultadosValidos = (detalle) => {
  if (!detalle) return false;
  
  console.log('🔍 BUSCANDO RESULTADOS EN:', {
    id: detalle.id,
    nombre: detalle.nombreExamen,
    resultados: detalle.resultados,
    parametrosResultados: detalle.parametrosResultados,
    estado: detalle.estado
  });

  // Verificar en diferentes propiedades donde podrían estar los resultados
  const posiblesResultados = [
    detalle.resultados,
    detalle.parametrosResultados
  ];
  
  for (const resultado of posiblesResultados) {
    if (resultado) {
      if (typeof resultado === 'object' && Object.keys(resultado).length > 0) {
        console.log('✅ RESULTADOS ENCONTRADOS en propiedad objeto:', Object.keys(resultado));
        return true;
      }
      if (typeof resultado === 'string' && resultado.trim().length > 0) {
        console.log('✅ RESULTADOS ENCONTRADOS en propiedad string');
        return true;
      }
    }
  }
  
  console.log('❌ NO SE ENCONTRARON RESULTADOS VÁLIDOS');
  return false;
};

const obtenerResultados = (detalle) => {
  if (!detalle) return null;
  
  // Buscar en diferentes propiedades
  if (detalle.resultados && typeof detalle.resultados === 'object' && Object.keys(detalle.resultados).length > 0) {
    return detalle.resultados;
  }
  if (detalle.parametrosResultados) {
    return detalle.parametrosResultados;
  }
  
  return null;
};


// 🔍 FUNCIÓN PARA VERIFICAR SI PUEDE GENERAR PDF
const puedeGenerarPDF = (detalle) => {
  if (!detalle) return false;
  
  console.log('🔍 VERIFICANDO SI PUEDE GENERAR PDF:', {
    id: detalle.id,
    nombre: detalle.nombreExamen,
    estado: detalle.estado,
    tieneResultados: tieneResultadosValidos(detalle),
    pdfPendiente: detalle.pdfPendiente,
    pdfGenerado: !!detalle.pdfGenerado
  });

  // ✅ CONDICIONES PARA GENERAR PDF:
  // 1. El examen debe estar completado
  // 2. Debe tener resultados válidos
  // 3. No debe tener PDF ya generado o estar pendiente de generación
  
  const condiciones = [
    detalle.estado === 'completado',
    tieneResultadosValidos(detalle),
    !detalle.pdfGenerado || detalle.pdfPendiente === true
  ];

  const puedeGenerar = condiciones.every(cond => cond === true);
  
  console.log(`📊 RESULTADO VERIFICACIÓN PDF: ${puedeGenerar ? '✅ SÍ' : '❌ NO'}`);
  console.log(`   - Estado completado: ${detalle.estado === 'completado'}`);
  console.log(`   - Tiene resultados: ${tieneResultadosValidos(detalle)}`);
  console.log(`   - PDF pendiente/generado: ${!detalle.pdfGenerado || detalle.pdfPendiente === true}`);
  
  return puedeGenerar;
};



const obtenerResumenExamenesPaciente = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('📊 Obteniendo resumen de exámenes para paciente ID:', id);

    const examenes = await db.ExamenPaciente.findAll({
      where: { pacienteId: id },
      include: [
        {
          model: db.ExamenPacienteDetalle,
          as: 'Detalles',
          attributes: ['id', 'nombreExamen', 'precioFinal', 'estado', 'esSubexamen', 'examenId', 'subexamenId', 'resultados', 'observaciones', 'fechaRealizacion'],
          required: false,
          include: [
            { 
              model: db.Examen, 
              as: 'Examen',
              attributes: ['id', 'nombre'],
              required: false
            },
            { 
              model: db.Subexamen, 
              as: 'Subexamen',
              attributes: ['id', 'nombre'],
              required: false
            }
          ]
        },
        { 
          model: db.Laboratorista, 
          as: 'Laboratorista',
          attributes: ['id', 'nombres', 'apellidos'],
          required: false
        }
      ],
      order: [['fechaAsignacion', 'DESC']]
    });

    console.log(`✅ Se encontraron ${examenes.length} registros para el paciente`);

    // ✅ PROCESAMIENTO SEGURO CON DETECCIÓN DE RESULTADOS
    const resumen = examenes.map(examen => {
      const detallesProcesados = (examen.Detalles || []).map(detalle => {
        // Obtener nombre del examen de manera segura
        let nombreExamen = detalle.nombreExamen || 'Examen sin nombre';
        if (!nombreExamen || nombreExamen === 'Examen sin nombre') {
          if (detalle.Examen) {
            nombreExamen = detalle.Examen.nombre;
          } else if (detalle.Subexamen) {
            nombreExamen = detalle.Subexamen.nombre;
          }
        }

        // ✅ USAR FUNCIONES AUXILIARES PARA DETECTAR RESULTADOS (AHORA DEFINIDAS)
        const tieneResultados = tieneResultadosValidos(detalle);
        const resultados = obtenerResultados(detalle);

        return {
          id: detalle.id,
          nombre: nombreExamen,
          precioFinal: detalle.precioFinal || 0,
          estado: detalle.estado || 'pendiente',
          tipo: detalle.esSubexamen ? 'subexamen' : 'examen',
          resultados: resultados,
          tieneResultados: tieneResultados,
          
          observaciones: detalle.observaciones,
          fechaRealizacion: detalle.fechaRealizacion,
          
        };
      });

      return {
        id: examen.id,
        fechaAsignacion: examen.fechaAsignacion,
        estadoPago: examen.estadoPago || 'pendiente',
        total: examen.total || 0,
        abono: examen.abono || 0,
        saldoPendiente: examen.saldoPendiente || examen.total || 0,
        cantidadExamenes: examen.cantidadExamenes || detallesProcesados.length,
        laboratorista: examen.Laboratorista ? 
          `${examen.Laboratorista.nombres} ${examen.Laboratorista.apellidos}` : 
          'No asignado',
        detalles: detallesProcesados
      };
    });

    res.json({
      success: true,
      data: resumen,
      total: resumen.length,
      pacienteId: parseInt(id)
    });

  } catch (error) {
    console.error('❌ Error obteniendo resumen de exámenes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al obtener resumen',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
};

// En controllers/examenes.controller.js

// 🔹 Método para cambiar estado
const cambiarEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    console.log('🔄 SOLICITUD CAMBIO DE ESTADO:', { id, estado });

    if (!estado) {
      return res.status(400).json({
        success: false,
        mensaje: 'Estado no proporcionado'
      });
    }

    // Buscar el detalle del examen
    const detalle = await db.ExamenPacienteDetalle.findByPk(id);
    if (!detalle) {
      return res.status(404).json({
        success: false,
        mensaje: 'No se encontró el examen'
      });
    }

    // Actualizar estado
    await detalle.update({ estado });

    console.log('✅ ESTADO ACTUALIZADO:', { 
      id, 
      estadoAnterior: detalle.estado, 
      estadoNuevo: estado 
    });

    res.json({
      success: true,
      mensaje: 'Estado actualizado correctamente',
      data: {
        id: detalle.id,
        estado: detalle.estado
      }
    });

  } catch (error) {
    console.error('❌ ERROR CAMBIANDO ESTADO:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno cambiando estado: ' + error.message
    });
  }
};

// 🔹 Método para guardar PDF resultado
const guardarPdfResultado = async (req, res) => {
  try {
    console.log('💾 SOLICITUD GUARDAR PDF RECIBIDA:', {
      detalleId: req.body.detalleId,
      paciente: req.body.paciente?.nombres,
      examen: req.body.examen?.nombre,
      tamañoPdf: req.body.pdfBuffer?.length
    });

    const { detalleId, pdfBuffer, paciente, examen, resultados, fechaGeneracion, metadata } = req.body;

    if (!detalleId || !pdfBuffer) {
      return res.status(400).json({
        success: false,
        mensaje: 'Datos incompletos para guardar PDF'
      });
    }

    // ✅ CONVERTIR BUFFER A BINARIO
    const pdfData = Buffer.from(pdfBuffer);

    // ✅ GUARDAR EN BASE DE DATOS
    const detalle = await db.ExamenPacienteDetalle.findByPk(detalleId);
    if (!detalle) {
      return res.status(404).json({
        success: false,
        mensaje: 'No se encontró el detalle del examen'
      });
    }

    // Actualizar con los campos de PDF
    await detalle.update({
      resultado_pdf: pdfData,
      fecha_generacion_pdf: new Date(),
      pdf_metadata: metadata || {}
    });

    console.log('✅ PDF GUARDADO EN BASE DE DATOS para detalleId:', detalleId);

    res.json({
      success: true,
      mensaje: 'PDF guardado exitosamente en el sistema',
      detalleId: detalleId,
      tamañoPdf: pdfData.length,
      fechaGuardado: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ ERROR GUARDANDO PDF EN BACKEND:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno guardando PDF: ' + error.message
    });
  }
};

// Agrega esta función al controlador de exámenes
const diagnosticarExamenesPaciente = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 DIAGNÓSTICO COMPLETO PARA PACIENTE ID:', id);
    
    // 1. Obtener cabeceras
    const cabeceras = await ExamenPaciente.findAll({
      where: { pacienteId: id },
      include: [
        {
          model: ExamenPacienteDetalle,
          as: 'Detalles',
          include: [
            { model: Examen, as: 'Examen' },
            { model: Subexamen, as: 'Subexamen' }
          ]
        },
        { model: Paciente, as: 'Paciente' }
      ],
      order: [['createdAt', 'DESC']]
    });

    console.log(`📊 CABECERAS ENCONTRADAS: ${cabeceras.length}`);
    
    cabeceras.forEach((cabecera, index) => {
      console.log(`\n📦 CABECERA ${index + 1}:`);
      console.log(`   ID: ${cabecera.id}`);
      console.log(`   Fecha: ${cabecera.fechaAsignacion}`);
      console.log(`   Total: $${cabecera.total}`);
      console.log(`   Estado Pago: ${cabecera.estadoPago}`);
      console.log(`   Detalles: ${cabecera.Detalles?.length || 0}`);
      
      if (cabecera.Detalles && cabecera.Detalles.length > 0) {
        cabecera.Detalles.forEach((detalle, detIndex) => {
          console.log(`   🔍 DETALLE ${detIndex + 1}:`);
          console.log(`      - ID: ${detalle.id}`);
          console.log(`      - Nombre: "${detalle.nombreExamen}"`);
          console.log(`      - Precio Final: $${detalle.precioFinal}`);
          console.log(`      - Estado: ${detalle.estado}`);
          console.log(`      - Examen ID: ${detalle.examenId}`);
          console.log(`      - Subexamen ID: ${detalle.subexamenId}`);
          console.log(`      - Es Subexamen: ${detalle.esSubexamen}`);
          console.log(`      - Tiene Examen: ${!!detalle.Examen}`);
          console.log(`      - Tiene Subexamen: ${!!detalle.Subexamen}`);
          console.log(`      - Registrado Por: "${detalle.registradoPor}"`);
          console.log(`      - Fecha Registro: ${detalle.fechaRegistro}`);
          console.log(`      - Hora Registro: ${detalle.horaRegistro}`);
        });
      }
    });

    res.json({
      success: true,
      pacienteId: id,
      totalCabeceras: cabeceras.length,
      totalDetalles: cabeceras.reduce((total, cab) => total + (cab.Detalles?.length || 0), 0),
      cabeceras: cabeceras.map(cabecera => ({
        id: cabecera.id,
        fechaAsignacion: cabecera.fechaAsignacion,
        total: cabecera.total,
        estadoPago: cabecera.estadoPago,
        detalles: cabecera.Detalles?.map(detalle => ({
          id: detalle.id,
          nombreExamen: detalle.nombreExamen,
          precioFinal: detalle.precioFinal,
          estado: detalle.estado,
          examenId: detalle.examenId,
          subexamenId: detalle.subexamenId,
          esSubexamen: detalle.esSubexamen,
          registradoPor: detalle.registradoPor,
          fechaRegistro: detalle.fechaRegistro,
          horaRegistro: detalle.horaRegistro,
          tieneResultados: !!detalle.resultados,
          tienePDF: !!detalle.pdfGenerado
        })) || []
      }))
    });

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    res.status(500).json({
      success: false,
      message: 'Error en diagnóstico',
      error: error.message
    });
  }
};


// Agrega esta función para reparar datos existentes
const repararNombresExamenes = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔧 REPARANDO NOMBRES DE EXAMENES PARA PACIENTE:', id);
    
    const detalles = await ExamenPacienteDetalle.findAll({
      include: [{
        model: ExamenPaciente,
        as: 'Cabecera',
        where: { pacienteId: id }
      }],
      include: [
        { model: Examen, as: 'Examen' },
        { model: Subexamen, as: 'Subexamen' }
      ]
    });

    console.log(`🔧 DETALLES A REPARAR: ${detalles.length}`);
    
    let reparados = 0;
    
    for (const detalle of detalles) {
      let nombreCorregido = detalle.nombreExamen;
      
      // Si no tiene nombre, intentar obtenerlo de las relaciones
      if (!nombreCorregido || nombreCorregido === 'Examen sin nombre') {
        if (detalle.Examen) {
          nombreCorregido = detalle.Examen.nombre;
        } else if (detalle.Subexamen) {
          nombreCorregido = detalle.Subexamen.nombre;
        } else if (detalle.esSubexamen && detalle.subexamenId) {
          const subexamen = await Subexamen.findByPk(detalle.subexamenId);
          nombreCorregido = subexamen?.nombre || 'Subexamen';
        } else if (detalle.examenId) {
          const examen = await Examen.findByPk(detalle.examenId);
          nombreCorregido = examen?.nombre || 'Examen';
        }
        
        if (nombreCorregido && nombreCorregido !== 'Examen sin nombre') {
          await detalle.update({ nombreExamen: nombreCorregido });
          reparados++;
          console.log(`   ✅ Reparado detalle ${detalle.id}: "${nombreCorregido}"`);
        }
      }
    }

    res.json({
      success: true,
      message: `Se repararon ${reparados} de ${detalles.length} detalles`,
      totalDetalles: detalles.length,
      reparados: reparados
    });

  } catch (error) {
    console.error('❌ Error reparando nombres:', error);
    res.status(500).json({
      success: false,
      message: 'Error reparando nombres',
      error: error.message
    });
  }
};

const obtenerExamenesAgrupadosPorFecha = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('📊 OBTENIENDO EXAMENES AGRUPADOS POR FECHA - Paciente ID:', id);

    const examenes = await ExamenPaciente.findAll({
      where: { pacienteId: id },
      include: [
        {
          model: ExamenPacienteDetalle,
          as: 'Detalles',
          include: [
            { model: Examen, as: 'Examen', attributes: ['id', 'nombre'] },
            { model: Subexamen, as: 'Subexamen', attributes: ['id', 'nombre'] }
          ]
        },
        {
          model: Laboratorista,
          as: 'Laboratorista',
          attributes: ['id', 'nombres', 'apellidos']
        }
      ],
      order: [['fechaAsignacion', 'DESC']]
    });

    if (!examenes.length) {
      return res.json({ success: true, data: [] });
    }

    const gruposPorFecha = new Map();

    examenes.forEach(cabecera => {
      const f = new Date(cabecera.fechaAsignacion);

      // 🚫 NO USAR UTC — Tomar fecha REAL local
      const anio = f.getFullYear();
      const mes = String(f.getMonth() + 1).padStart(2, '0');
      const dia = String(f.getDate()).padStart(2, '0');

      const fechaISO = `${anio}-${mes}-${dia}`;
      const fechaDisplay = f.toLocaleDateString('es-EC', {
        year: "numeric",
        month: "long",
        day: "numeric"
      });

      if (!gruposPorFecha.has(fechaISO)) {
        gruposPorFecha.set(fechaISO, {
          id: `grupo-${fechaISO}`,
          fecha: fechaDisplay,
          fechaISO,
          total: 0,
          estadoPago: cabecera.estadoPago,
          saldoPendiente: cabecera.saldoPendiente,
          examenes: [],
          tieneResultadosDisponibles: false,
          puedeGenerarPDFCompleto: false
        });
      }

      const grupo = gruposPorFecha.get(fechaISO);
      grupo.total += parseFloat(cabecera.total) || 0;

      (cabecera.Detalles || []).forEach(detalle => {
        const examenProcesado = {
          id: detalle.id,
          nombre: detalle.Examen?.nombre || detalle.Subexamen?.nombre,
          estado: detalle.estado,
          precio: detalle.precioFinal,
          resultados: detalle.resultados,
          tieneResultados: !!detalle.resultados,
          puedeGenerarPDF:
            detalle.estado === "completado" &&
            !!detalle.resultados &&
            !!detalle.pdfGenerado
        };

        grupo.examenes.push(examenProcesado);

        if (detalle.estado === 'completado' && detalle.resultados) {
          grupo.tieneResultadosDisponibles = true;
          grupo.puedeGenerarPDFCompleto = true;
        }
      });
    });

    const gruposArray = Array.from(gruposPorFecha.values())
      .sort((a, b) => new Date(b.fechaISO) - new Date(a.fechaISO));

    res.json({
      success: true,
      data: gruposArray,
      totalGrupos: gruposArray.length
    });

  } catch (error) {
    console.error("❌ Error agrupando:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};


// Agrega esta función y ejecútala una vez
const repararDatosExamenes = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔧 REPARANDO DATOS DE EXAMENES PARA PACIENTE:', id);

    const detalles = await ExamenPacienteDetalle.findAll({
      include: [{
        model: ExamenPaciente,
        as: 'Cabecera',
        where: { pacienteId: id }
      }],
      include: [
        { model: Examen, as: 'Examen' },
        { model: Subexamen, as: 'Subexamen' }
      ]
    });

    console.log(`🔧 DETALLES A REPARAR: ${detalles.length}`);
    
    let reparados = 0;

    for (const detalle of detalles) {
      const updates = {};

      // Reparar nombreExamen si está vacío
      if (!detalle.nombreExamen || detalle.nombreExamen === 'Examen sin nombre') {
        if (detalle.Examen) {
          updates.nombreExamen = detalle.Examen.nombre;
        } else if (detalle.Subexamen) {
          updates.nombreExamen = detalle.Subexamen.nombre;
        }
      }

      // Reparar información de registro si está vacía
      if (!detalle.registradoPor) {
        updates.registradoPor = 'Sistema';
      }
      if (!detalle.fechaRegistro) {
        updates.fechaRegistro = detalle.createdAt || new Date();
      }
      if (!detalle.horaRegistro) {
        updates.horaRegistro = (detalle.createdAt || new Date()).toTimeString().split(' ')[0];
      }

      // Aplicar actualizaciones si hay cambios
      if (Object.keys(updates).length > 0) {
        await detalle.update(updates);
        reparados++;
        console.log(`   ✅ Reparado detalle ${detalle.id}:`, updates);
      }
    }

    res.json({
      success: true,
      message: `Se repararon ${reparados} de ${detalles.length} detalles`,
      totalDetalles: detalles.length,
      reparados: reparados
    });

  } catch (error) {
    console.error('❌ Error reparando datos:', error);
    res.status(500).json({
      success: false,
      message: 'Error reparando datos',
      error: error.message
    });
  }
};


/////////////////////////////////////////////////////////


// ✅ FUNCIÓN AUXILIAR CORREGIDA - Calcular saldos y preparar grupos
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
        if (examen.subexamenes && Array.isArray(examen.subexamenes)) {
          examen.subexamenes.sort((a, b) => a.nombre.localeCompare(b.nombre));
        }
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
    console.log(`   Cabeceras: ${grupo.cabeceraIds.length}`);

    return grupo;
  });

  // ORDENAR POR FECHA (más reciente primero)
  return resultadoFinal.sort((a, b) => new Date(b.fechaISO) - new Date(a.fechaISO));
};

// ✅ FUNCIÓN PARA PROCESAR DETALLE EN GRUPO - MEJORADA
const procesarDetalleParaGrupo = (detalle, grupo) => {
  console.log(`      📝 Detalle ${detalle.id}:`, {
    nombre: detalle.nombreExamen,
    precioFinal: detalle.precioFinal,
    examenId: detalle.examenId,
    subexamenId: detalle.subexamenId,
    esSubexamen: detalle.esSubexamen,
    estado: detalle.estado
  });

  // Sanitizar precio
  let precioDetalle = parseFloat(detalle.precioFinal || detalle.precioAplicado || 0);
  if (isNaN(precioDetalle)) precioDetalle = 0;
  grupo.precioTotal += precioDetalle;

  // Información de registro
  const informacionRegistroDetalle = {
    registradoPor: detalle.registradoPor || 'Sistema',
    fechaRegistro: detalle.fechaRegistro || detalle.createdAt,
    horaRegistro: detalle.horaRegistro || (detalle.createdAt ? detalle.createdAt.toTimeString().split(' ')[0] : '00:00:00'),
    laboratorio: detalle.laboratorio || 'Laboratorio Central',
    laboratoristaId: detalle.laboratoristaId
  };

  let area = null;
  let examen = null;

  // Detectar si es subexamen
  const esSubexamen = detalle.subexamenId !== null && detalle.Subexamen;

  if (esSubexamen) {
    // Área del examen padre
    area = detalle.Subexamen?.Examen?.Area;
    const areaNombre = area?.nombre || 'General';

    // Si no existe área la creamos en grupo
    if (!grupo.areas.has(area?.id || areaNombre)) {
      grupo.areas.set(area?.id || areaNombre, {
        id: area?.id || areaNombre,
        nombre: areaNombre,
        precioTotal: 0,
        totalPendiente: 0,
        expanded: false,
        examenes: new Map()
      });
    }

    const areaGrupo = grupo.areas.get(area?.id || areaNombre);

    // Examen padre
    const examenPadre = detalle.Subexamen.Examen;
    if (!areaGrupo.examenes.has(examenPadre.id)) {
      // Crear examen padre
      areaGrupo.examenes.set(examenPadre.id, {
        id: examenPadre.id,
        nombre: examenPadre.nombre,
        tipo: 'examen',
        area: areaNombre,
        precioTotal: 0,
        tieneSubexamenes: true,
        estado: 'pendiente',
        estadoPago: 'pendiente',
        abono: 0,
        subexamenes: [],
        expanded: false,
        detallesEspecificos: detalle.detallesEspecificos,
        descripcion: detalle.descripcion,
        metodo: detalle.metodo,
        tipoMuestra: detalle.tipoMuestra,
        horaEntrega: detalle.horaEntrega,
        tiempoEntrega: detalle.tiempoEntrega,
        tipoTubo: detalle.tipoTubo,
        esPromocion: detalle.esPromocion || false,
        precioDescuento: detalle.precioDescuento || 0,
        examenPacienteDetalleId: detalle.id,
        resultado: detalle.resultados ?? detalle.resultado ?? null,
        informacionRegistro: informacionRegistroDetalle
      });
    }

    // Agregar subexamen
    const examenExistente = areaGrupo.examenes.get(examenPadre.id);
    const subexamen = {
      id: detalle.Subexamen.id,
      nombre: detalle.Subexamen.nombre,
      tipo: 'subexamen',
      precio: precioDetalle,
      estado: detalle.estado || 'pendiente',
      resultado: detalle.resultados ?? detalle.resultado ?? null,
      metodo: detalle.metodo,
      detallesEspecificos: detalle.detallesEspecificos,
      estadoPago: detalle.estadoPago || 'pendiente',
      abono: detalle.abono || 0,
      tipoMuestra: detalle.tipoMuestra,
      horaEntrega: detalle.horaEntrega,
      tiempoEntrega: detalle.tiempoEntrega,
      tipoTubo: detalle.tipoTubo,
      esPromocion: detalle.esPromocion || false,
      precioDescuento: detalle.precioDescuento || 0,
      examenPacienteDetalleId: detalle.id,
      examenPadreId: examenPadre.id,
      informacionRegistro: informacionRegistroDetalle
    };

    examenExistente.subexamenes.push(subexamen);
    examenExistente.precioTotal += precioDetalle;
    areaGrupo.precioTotal += precioDetalle;
    grupo.detallesConteo.subexamenes++;
    
    console.log(`      ✅ Subexamen agregado: ${detalle.Subexamen.nombre} - $${precioDetalle}`);
    return;
  }

  // Si es examen principal
  if (detalle.Examen) {
    area = detalle.Examen.Area;
    const areaNombre = area?.nombre || 'General';

    if (!grupo.areas.has(area?.id || areaNombre)) {
      grupo.areas.set(area?.id || areaNombre, {
        id: area?.id || areaNombre,
        nombre: areaNombre,
        precioTotal: 0,
        totalPendiente: 0,
        expanded: false,
        examenes: new Map()
      });
    }

    const areaGrupo = grupo.areas.get(area?.id || areaNombre);

    // Crear examen principal
    examen = {
      id: detalle.Examen.id,
      nombre: detalle.Examen.nombre,
      tipo: 'examen',
      area: areaNombre,
      precioTotal: precioDetalle,
      tieneSubexamenes: false,
      estado: detalle.estado || 'pendiente',
      estadoPago: detalle.estadoPago || 'pendiente',
      abono: detalle.abono || 0,
      resultado: detalle.resultados ?? detalle.resultado ?? null,
      examenPacienteDetalleId: detalle.id,
      subexamenes: [],
      expanded: false,
      detallesEspecificos: detalle.detallesEspecificos,
      descripcion: detalle.descripcion,
      metodo: detalle.metodo,
      tipoMuestra: detalle.tipoMuestra,
      horaEntrega: detalle.horaEntrega,
      tiempoEntrega: detalle.tiempoEntrega,
      tipoTubo: detalle.tipoTubo,
      esPromocion: detalle.esPromocion || false,
      precioDescuento: detalle.precioDescuento || 0,
      informacionRegistro: informacionRegistroDetalle
    };

    areaGrupo.examenes.set(detalle.Examen.id, examen);
    areaGrupo.precioTotal += precioDetalle;
    grupo.detallesConteo.examenesPrincipales++;
    
    console.log(`      ✅ Examen principal agregado: ${detalle.Examen.nombre} - $${precioDetalle}`);
    return;
  }

  console.warn('      ⚠️ Detalle sin examen o subexamen asociado, ignorado');
};

// ✅ FUNCIÓN PARA CONTAR EXAMENES INDIVIDUALES
const contarExamenesIndividuales = (areas) => {
  return areas.reduce((total, area) => {
    return total + area.examenes.reduce((areaTotal, examen) => {
      if (examen.tieneSubexamenes && examen.subexamenes && examen.subexamenes.length > 0) {
        return areaTotal + examen.subexamenes.length;
      }
      return areaTotal + 1;
    }, 0);
  }, 0);
};


// ✅ DIAGNÓSTICO COMPLETO DE FECHAS - Agregar esto al inicio
const diagnosticarFechasExamenes = (examenes) => {
  console.log('🔍 DIAGNÓSTICO COMPLETO DE FECHAS:');
  examenes.forEach((cabecera, index) => {
    const fechaAsignacion = new Date(cabecera.fechaAsignacion);
    const createdAt = new Date(cabecera.createdAt);
    
    console.log(`📦 Cabecera ${index + 1}:`);
    console.log(`   ID: ${cabecera.id}`);
    console.log(`   Fecha Asignación BD: ${cabecera.fechaAsignacion}`);
    console.log(`   Fecha Asignación JS: ${fechaAsignacion.toLocaleDateString('es-EC')}`);
    console.log(`   CreatedAt BD: ${cabecera.createdAt}`);
    console.log(`   CreatedAt JS: ${createdAt.toLocaleDateString('es-EC')}`);
    console.log(`   Diferencia: ${(createdAt.getTime() - fechaAsignacion.getTime()) / (1000 * 60 * 60)} horas`);
  });
};




/////////////////////////////////////////////////
// ✅ VERSIÓN CORREGIDA - Fechas reales según cada examen
const procesarJerarquiaCompleta = (examenes) => {
  console.log('🎯 INICIANDO PROCESAMIENTO JERÁRQUICO - FECHAS REALES');
  console.log(`📊 Total de cabeceras recibidas: ${examenes.length}`);
  
  const gruposPorFecha = new Map();

  examenes.forEach((cabecera, index) => {
    // ✅ CORREGIDO: Usar la fecha REAL de cada cabecera
    const fechaReal = cabecera.fechaAsignacion || cabecera.createdAt || new Date();
    const fechaCabecera = new Date(fechaReal);
    
    console.log(`\n📦 Procesando cabecera ${index + 1}/${examenes.length}:`);
    console.log(`   ID: ${cabecera.id}`);
    console.log(`   Fecha Asignación: ${cabecera.fechaAsignacion}`);
    console.log(`   Created At: ${cabecera.createdAt}`);
    console.log(`   Fecha Real usada: ${fechaReal}`);

    // ✅ EXTRAER SOLO AÑO, MES, DÍA (ignorar hora para agrupación)
    const year = fechaCabecera.getFullYear();
    const month = String(fechaCabecera.getMonth() + 1).padStart(2, '0');
    const day = String(fechaCabecera.getDate()).padStart(2, '0');
    
    const fechaStr = `${year}-${month}-${day}`;
    
    // FORMATEAR FECHA PARA DISPLAY
    const fechaDisplay = fechaCabecera.toLocaleDateString('es-EC', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    console.log(`   📅 Fecha procesada: ${fechaDisplay} (${fechaStr})`);
    console.log(`   💰 Totales: $${cabecera.total}, Abono: $${cabecera.abono}`);

    // CREAR/OBTENER GRUPO POR FECHA REAL
    if (!gruposPorFecha.has(fechaStr)) {
      gruposPorFecha.set(fechaStr, {
        id: `grupo-${fechaStr}`,
        fecha: new Date(fechaStr),
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
        },
        paciente: cabecera.Paciente ? {
          id: cabecera.Paciente.id,
          nombres: cabecera.Paciente.nombres,
          apellidos: cabecera.Paciente.apellidos,
          cedula: cabecera.Paciente.cedula
        } : null
      });
      
      console.log(`   ✅ NUEVO GRUPO CREADO: ${fechaDisplay}`);
    }

    const grupo = gruposPorFecha.get(fechaStr);
    grupo.cabeceraIds.push(cabecera.id);

    // SUMAR TOTALES
    const totalCabecera = parseFloat(cabecera.total || 0);
    const abonoCabecera = parseFloat(cabecera.abono || 0);
    
    grupo.total += totalCabecera;
    grupo.abono += abonoCabecera;

    console.log(`   💰 Sumando a grupo: total=$${totalCabecera}, abono=$${abonoCabecera}`);

    // PROCESAR DETALLES
    if (cabecera.Detalles && cabecera.Detalles.length > 0) {
      console.log(`   🔍 Procesando ${cabecera.Detalles.length} detalles...`);
      cabecera.Detalles.forEach((detalle) => {
        procesarDetalleParaGrupo(detalle, grupo);
      });
    }
  });

  // CALCULAR SALDOS Y RETORNAR
  const resultadoFinal = calcularSaldosYGrupos(gruposPorFecha);
  
  console.log(`\n🎉 PROCESAMIENTO COMPLETADO - RESUMEN:`);
  resultadoFinal.forEach((grupo, index) => {
    console.log(`   ${index + 1}. ${grupo.fechaStr}: ${grupo.totalExamenes} exámenes, $${grupo.total}, ${grupo.estadoPago}`);
  });
  
  return resultadoFinal;
};



// ✅ DIAGNÓSTICO COMPLETO DE FECHAS
const diagnosticarProblemaFechas = async (req, res) => {
  try {
    const { pacienteId } = req.params;
    
    console.log('🔍 DIAGNÓSTICO COMPLETO DE FECHAS PARA PACIENTE:', pacienteId);

    // Obtener TODOS los exámenes del paciente
    const todosExamenes = await db.ExamenPaciente.findAll({
      where: { pacienteId },
      attributes: ['id', 'fechaAsignacion', 'total', 'abono', 'estadoPago'],
      order: [['fechaAsignacion', 'DESC']],
      raw: true
    });

    // Agrupar por fecha local (sin timezone)
    const agrupacionPorFecha = {};
    todosExamenes.forEach(examen => {
      const fechaLocal = new Date(examen.fechaAsignacion).toLocaleDateString('es-EC');
      const fechaISO = examen.fechaAsignacion.toISOString();
      
      if (!agrupacionPorFecha[fechaLocal]) {
        agrupacionPorFecha[fechaLocal] = [];
      }
      
      agrupacionPorFecha[fechaLocal].push({
        id: examen.id,
        fechaAsignacion: examen.fechaAsignacion,
        fechaISO: fechaISO,
        fechaLocal: fechaLocal,
        total: examen.total,
        abono: examen.abono,
        estadoPago: examen.estadoPago
      });
    });

    res.json({
      success: true,
      diagnostico: {
        pacienteId,
        totalExamenes: todosExamenes.length,
        agrupacionPorFecha,
        fechasUnicas: Object.keys(agrupacionPorFecha),
        examenesRecientes: todosExamenes.slice(0, 5).map(ex => ({
          id: ex.id,
          fechaAsignacion: ex.fechaAsignacion,
          fechaISO: ex.fechaAsignacion.toISOString(),
          fechaLocal: new Date(ex.fechaAsignacion).toLocaleDateString('es-EC'),
          total: ex.total,
          abono: ex.abono
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};


// ✅ FUNCIÓN CORREGIDA PARA BUSCAR POR FECHA
const buscarCabecerasPorFecha = async (pacienteId, fecha) => {
  try {
    console.log('🔍 BÚSQUEDA MEJORADA POR FECHA:', { pacienteId, fecha });
    
    let fechaInicio, fechaFin;

    // ✅ CORREGIDO: Manejar diferentes formatos y zonas horarias
    if (fecha.includes('T')) {
      // Formato ISO (2025-10-28T05:35:22.935Z)
      const fechaObj = new Date(fecha);
      fechaInicio = new Date(fechaObj.getFullYear(), fechaObj.getMonth(), fechaObj.getDate(), 0, 0, 0, 0);
      fechaFin = new Date(fechaObj.getFullYear(), fechaObj.getMonth(), fechaObj.getDate(), 23, 59, 59, 999);
    } else {
      // Formato simple (2025-10-28) - CORREGIDO: usar fecha local
      fechaInicio = new Date(fecha + 'T00:00:00');
      fechaFin = new Date(fecha + 'T23:59:59.999');
    }

    // ✅ AJUSTAR PARA ZONA HORARIA LOCAL (Ecuador)
    const offset = -5 * 60; // UTC-5 para Ecuador
    fechaInicio.setMinutes(fechaInicio.getMinutes() - fechaInicio.getTimezoneOffset() + offset);
    fechaFin.setMinutes(fechaFin.getMinutes() - fechaFin.getTimezoneOffset() + offset);

    console.log('📅 RANGO DE BÚSQUEDA CORREGIDO:', {
      fechaSolicitada: fecha,
      fechaInicio: fechaInicio.toISOString(),
      fechaFin: fechaFin.toISOString(),
      fechaInicioLocal: fechaInicio.toLocaleString('es-EC'),
      fechaFinLocal: fechaFin.toLocaleString('es-EC')
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
    
    // Log detallado de las fechas encontradas
    cabeceras.forEach(cabecera => {
      const fechaBD = new Date(cabecera.fechaAsignacion);
      console.log(`📊 Cabecera ${cabecera.id}:`, {
        fechaBD: cabecera.fechaAsignacion,
        fechaBDLocal: fechaBD.toLocaleString('es-EC'),
        totalBD: cabecera.total,
        detallesCount: cabecera.Detalles?.length || 0
      });
    });

    return cabeceras;
    
  } catch (error) {
    console.error('❌ Error en buscarCabecerasPorFecha:', error);
    throw error;
  }
};


// ✅ FUNCIÓN PARA GENERAR PDF AUTOMÁTICAMENTE
const generarYGuardarPdfAutomatico = async (detalleId) => {
  try {
    console.log(`🤖 GENERANDO PDF AUTOMÁTICO para detalle: ${detalleId}`);
    
    const detalle = await ExamenPacienteDetalle.findByPk(detalleId, {
      include: [
        {
          model: ExamenPaciente,
          as: 'Cabecera',
          include: [{ model: Paciente, as: 'Paciente' }]
        },
        {
          model: Examen,
          as: 'Examen',
          include: [{ model: Area, as: 'Area' }]
        }
      ]
    });

    if (!detalle || detalle.estado !== 'completado') {
      console.log('❌ No se puede generar PDF - examen no completado');
      return;
    }

    // Verificar que tenga resultados
    if (!detalle.resultados || Object.keys(detalle.resultados).length === 0) {
      console.log('❌ No se puede generar PDF - sin resultados');
      return;
    }

    console.log('📊 DATOS PARA PDF AUTOMÁTICO:', {
      paciente: detalle.Cabecera?.Paciente?.nombres,
      examen: detalle.Examen?.nombre,
      resultados: Object.keys(detalle.resultados).length
    });

    // ✅ SIMULAR LLAMADA AL FRONTEND PARA GENERAR PDF
    // En un caso real, aquí llamarías al servicio del frontend
    // Por ahora, creamos un PDF básico directamente en el backend
    
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    
    // Crear buffer para el PDF
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    
    return new Promise((resolve, reject) => {
      doc.on('end', async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);
          
          console.log(`📄 PDF generado automáticamente - Tamaño: ${pdfBuffer.length} bytes`);
          
          // Guardar el PDF en la base de datos
          await detalle.update({
            pdfGenerado: pdfBuffer,
            fechaGeneracionPdf: new Date(),
            pdfPendiente: false
          });
          
          console.log(`✅ PDF guardado automáticamente en BD para detalle ${detalleId}`);
          resolve(true);
        } catch (error) {
          console.error('❌ Error guardando PDF automático:', error);
          reject(error);
        }
      });
      
      doc.on('error', reject);

      // CONTENIDO DEL PDF AUTOMÁTICO
      doc.fontSize(20).text('RESULTADOS DE LABORATORIO', { align: 'center' });
      doc.moveDown();
      
      // Información del paciente
      doc.fontSize(12)
         .text(`Paciente: ${detalle.Cabecera?.Paciente?.nombres || ''} ${detalle.Cabecera?.Paciente?.apellidos || ''}`)
         .text(`Cédula: ${detalle.Cabecera?.Paciente?.cedula || 'No especificada'}`)
         .text(`Edad: ${detalle.Cabecera?.Paciente?.edad || 'No especificada'} | Sexo: ${detalle.Cabecera?.Paciente?.sexo || 'No especificado'}`);
      
      doc.moveDown();
      doc.fontSize(16).text(`Examen: ${detalle.Examen?.nombre || 'Examen no especificado'}`);
      doc.moveDown();
      
      // Resultados
      doc.fontSize(14).text('RESULTADOS:');
      doc.moveDown(0.5);
      
      if (detalle.resultados && typeof detalle.resultados === 'object') {
        Object.keys(detalle.resultados).forEach((key, index) => {
          doc.fontSize(10).text(`${key}: ${detalle.resultados[key]}`, { 
            indent: 20,
            continued: false
          });
        });
      }
      
      doc.moveDown();
      doc.fontSize(10)
         .text(`Fecha de generación: ${new Date().toLocaleString('es-ES')}`)
         .text('Laboratorio Clínico - Sistema de Gestión');

      // Finalizar el PDF
      doc.end();
    });

  } catch (error) {
    console.error('❌ Error en generación automática de PDF:', error);
    throw error;
  }
};


// ✅ MÉTODO PARA GENERAR PDF AUTOMÁTICO - VERSIÓN SIMPLIFICADA
const generarPdfAutomatico = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🤖 SOLICITUD GENERAR PDF AUTOMÁTICO para detalle: ${id}`);

    const detalle = await ExamenPacienteDetalle.findByPk(id, {
      include: [
        {
          model: ExamenPaciente,
          as: 'Cabecera',
          include: [{ model: Paciente, as: 'Paciente' }]
        },
        {
          model: Examen,
          as: 'Examen',
          include: [{ model: Area, as: 'Area' }]
        }
      ]
    });

    if (!detalle) {
      return res.status(404).json({ 
        success: false,
        message: 'Detalle de examen no encontrado' 
      });
    }

    console.log('📊 DATOS DEL EXAMEN:', {
      id: detalle.id,
      nombre: detalle.nombreExamen,
      estado: detalle.estado,
      paciente: detalle.Cabecera?.Paciente?.nombres,
      tieneResultados: !!detalle.resultados && Object.keys(detalle.resultados).length > 0
    });

    // Verificar que el examen esté completado y tenga resultados
    if (detalle.estado !== 'completado') {
      return res.status(400).json({ 
        success: false,
        message: 'El examen no está completado' 
      });
    }

    if (!detalle.resultados || Object.keys(detalle.resultados).length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'El examen no tiene resultados' 
      });
    }

    // ✅ GENERAR PDF CON PDFKIT
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument();
    
    // Crear buffer para el PDF
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    
    return new Promise((resolve, reject) => {
      doc.on('end', async () => {
        try {
          const pdfBuffer = Buffer.concat(chunks);
          
          console.log(`📄 PDF generado - Tamaño: ${pdfBuffer.length} bytes`);

          // ✅ GUARDAR EL PDF EN LA BASE DE DATOS
          await detalle.update({
            pdfGenerado: pdfBuffer,
            fechaGeneracionPdf: new Date(),
            pdfPendiente: false
          });

          console.log(`✅ PDF GUARDADO EN BD para detalle ${id}`);

          res.json({
            success: true,
            message: 'PDF generado y guardado correctamente',
            data: {
              detalleId: detalle.id,
              examen: detalle.nombreExamen,
              tamañoPdf: pdfBuffer.length,
              fechaGeneracion: new Date(),
              tienePdf: true
            }
          });
          resolve(true);
          
        } catch (error) {
          console.error('❌ Error guardando PDF:', error);
          res.status(500).json({ 
            success: false,
            message: 'Error guardando PDF', 
            error: error.message 
          });
          reject(error);
        }
      });
      
      doc.on('error', (error) => {
        console.error('❌ Error generando PDF:', error);
        res.status(500).json({ 
          success: false,
          message: 'Error generando PDF', 
          error: error.message 
        });
        reject(error);
      });

      // ============================================
      // ✅ CONTENIDO DEL PDF - VERSIÓN MEJORADA
      // ============================================
      
      // ENCABEZADO
      doc.fontSize(20).text('LABORATORIO CLÍNICO SALVATORE', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(16).text('RESULTADOS DE EXAMEN', { align: 'center' });
      doc.moveDown();

      // LÍNEA SEPARADORA
      doc.moveTo(50, doc.y)
         .lineTo(550, doc.y)
         .stroke();
      doc.moveDown();

      // INFORMACIÓN DEL PACIENTE
      doc.fontSize(12).text('INFORMACIÓN DEL PACIENTE:', { underline: true });
      doc.moveDown(0.3);
      doc.text(`Nombre: ${detalle.Cabecera?.Paciente?.nombres || ''} ${detalle.Cabecera?.Paciente?.apellidos || ''}`);
      doc.text(`Cédula: ${detalle.Cabecera?.Paciente?.cedula || 'No especificada'}`);
      doc.text(`Edad: ${detalle.Cabecera?.Paciente?.edad || 'No especificada'}`);
      doc.text(`Sexo: ${detalle.Cabecera?.Paciente?.sexo || 'No especificado'}`);
      doc.moveDown();

      // INFORMACIÓN DEL EXAMEN
      doc.text('INFORMACIÓN DEL EXAMEN:', { underline: true });
      doc.moveDown(0.3);
      doc.text(`Examen: ${detalle.Examen?.nombre || detalle.nombreExamen}`);
      doc.text(`Área: ${detalle.Examen?.Area?.nombre || 'No especificada'}`);
      doc.text(`Método: ${detalle.parametrosResultados?.metodo || 'No especificado'}`);
      doc.text(`Fecha de realización: ${detalle.fechaRealizacion ? new Date(detalle.fechaRealizacion).toLocaleDateString('es-EC') : 'No especificada'}`);
      doc.moveDown();

      // LÍNEA SEPARADORA
      doc.moveTo(50, doc.y)
         .lineTo(550, doc.y)
         .stroke();
      doc.moveDown();

      // RESULTADOS
      doc.fontSize(14).text('RESULTADOS OBTENIDOS:', { underline: true });
      doc.moveDown(0.5);

      if (detalle.resultados && typeof detalle.resultados === 'object') {
        Object.keys(detalle.resultados).forEach((key, index) => {
          // Evitar campos técnicos en los resultados
          if (!['metodo', 'observaciones', 'ultimaEdicionPor', 'ultimaEdicionEn'].includes(key)) {
            const valor = detalle.resultados[key];
            doc.fontSize(10).text(`${key.toUpperCase().replace(/_/g, ' ')}: ${valor}`, {
              indent: 20,
              continued: false
            });
          }
        });
      }
      doc.moveDown();

      // OBSERVACIONES
      if (detalle.observaciones) {
        doc.text('OBSERVACIONES:', { underline: true });
        doc.moveDown(0.3);
        doc.fontSize(10).text(detalle.observaciones, { indent: 20 });
        doc.moveDown();
      }

      // LÍNEA SEPARADORA
      doc.moveTo(50, doc.y)
         .lineTo(550, doc.y)
         .stroke();
      doc.moveDown();

      // INFORMACIÓN DE LABORATORIO
      doc.fontSize(9).text('Laboratorio Clínico Salvatore - Sistema de Gestión', { align: 'center' });
      doc.text(`Generado el: ${new Date().toLocaleString('es-EC')}`, { align: 'center' });
      doc.text('Resultados firmados electrónicamente', { align: 'center' });

      // Finalizar el PDF
      doc.end();
    });

  } catch (error) {
    console.error('❌ Error en generarPdfAutomatico:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error generando PDF automático', 
      error: error.message 
    });
  }
};



// ✅ FUNCIÓN PARA FORZAR GENERACIÓN DE PDF
const forzarGeneracionPdf = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🔄 FORZANDO GENERACIÓN PDF para detalle: ${id}`);

    const detalle = await ExamenPacienteDetalle.findByPk(id, {
      include: [
        {
          model: ExamenPaciente,
          as: 'Cabecera',
          include: [{ model: Paciente, as: 'Paciente' }]
        },
        {
          model: Examen,
          as: 'Examen'
        }
      ]
    });

    if (!detalle) {
      return res.status(404).json({
        success: false,
        message: 'Detalle no encontrado'
      });
    }

    console.log('📊 ESTADO ACTUAL:', {
      id: detalle.id,
      nombre: detalle.nombreExamen,
      estado: detalle.estado,
      tieneResultados: !!detalle.resultados,
      tienePdf: !!detalle.pdfGenerado
    });

    // Verificar que tenga resultados
    if (!detalle.resultados || Object.keys(detalle.resultados).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El examen no tiene resultados para generar PDF'
      });
    }

    // Llamar al método de generación automática
    await generarPdfAutomatico({ params: { id } }, {
      json: (data) => {
        if (data.success) {
          console.log('✅ PDF generado exitosamente');
          res.json({
            success: true,
            message: 'PDF generado correctamente',
            data: data.data
          });
        } else {
          res.status(500).json({
            success: false,
            message: data.message
          });
        }
      },
      status: (code) => ({
        json: (data) => {
          if (code >= 400) {
            res.status(code).json(data);
          }
        }
      })
    });

  } catch (error) {
    console.error('❌ Error forzando generación PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Error forzando generación PDF',
      error: error.message
    });
  }
};

// ✅ FUNCIÓN PARA ACTUALIZAR EL ÁREA ESPECIALIZADA
const actualizarAreaEspecializada = async (req, res) => {
  try {
    const { id } = req.params;
    const { area } = req.body;

    console.log(`🔄 Actualizando área para detalle ${id}: ${area}`);

    const detalle = await ExamenPacienteDetalle.findByPk(id);
    
    if (!detalle) {
      return res.status(404).json({
        success: false,
        message: 'Detalle no encontrado'
      });
    }

    // Actualizar el campo laboratorio con el área especializada
    await detalle.update({
      laboratorio: area
    });

    console.log(`✅ Área actualizada a: ${area}`);

    res.json({
      success: true,
      message: 'Área especializada actualizada correctamente',
      data: {
        id: detalle.id,
        area: area
      }
    });

  } catch (error) {
    console.error('❌ Error actualizando área:', error);
    res.status(500).json({
      success: false,
      message: 'Error actualizando área especializada',
      error: error.message
    });
  }
};



const firmarYCompletarExamen = async (req, res) => {
  try {
    const { detalleId, laboratoristaId, pdfNombre } = req.body;
    const pdfBytes = req.body.pdfBytes;

    if (!detalleId || !pdfBytes) {
      return res.status(400).json({
        success: false,
        mensaje: 'Faltan datos para guardar el PDF firmado'
      });
    }

    const buffer = Buffer.from(pdfBytes);

    const nombreArchivo = pdfNombre || `detalle_${detalleId}_firmado.pdf`;

    const rutaCarpeta = path.join(__dirname, '../uploads/examenes_firmados');
    const rutaArchivo = path.join(rutaCarpeta, nombreArchivo);

    if (!fs.existsSync(rutaCarpeta)) {
      fs.mkdirSync(rutaCarpeta, { recursive: true });
    }

    fs.writeFileSync(rutaArchivo, buffer);

    await ExamenPacienteDetalle.update(
      {
        firmado: true,
        pdfFirmado: nombreArchivo,
        laboratoristaFirmaId: laboratoristaId || null,
        fechaFirma: new Date(),
        estadoFirma: 'firmado'
      },
      { where: { id: detalleId } }
    );

    return res.json({
      success: true,
      mensaje: 'PDF firmado guardado con éxito',
      archivo: nombreArchivo
    });

  } catch (error) {
    console.error('❌ Error al guardar PDF firmado:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error procesando firma electrónica',
      error: error.message
    });
  }
};


const descargarPdfFirmado = async (req, res) => {
  try {
    const { detalleId } = req.params;

    const detalle = await ExamenPacienteDetalle.findByPk(detalleId);

    if (!detalle || !detalle.pdfFirmado) {
      return res.status(404).send('PDF aún no está firmado o no existe');
    }

    const rutaArchivo = path.join(
      __dirname,
      '../uploads/examenes_firmados',
      detalle.pdfFirmado
    );

    if (!fs.existsSync(rutaArchivo)) {
      return res.status(404).send('Archivo PDF no encontrado');
    }

    return res.download(rutaArchivo, detalle.pdfFirmado);

  } catch (error) {
    console.error('❌ Error descargando PDF firmado:', error);
    res.status(500).send('Error interno en el servidor');
  }
};


// En controllers/examenes.controller.js - CORREGIR la parte del estado
const actualizarResultadoExamen = async (req, res) => {
  try {
    const { id } = req.params;
    const { resultado, metodo, observaciones, marcarComolisto, enviarEstado } = req.body;
    
    console.log(`🎯 ========== ACTUALIZANDO RESULTADO ==========`);
    console.log(`📦 BODY recibido:`, { 
      resultado, 
      metodo, 
      observaciones, 
      marcarComolisto,  // ✅ ESTE DEBE SER false CUANDO SOLO SE GUARDAN RESULTADOS
      enviarEstado 
    });

    // ✅ CORREGIDO: Obtener el ID del laboratorista
    const laboratoristaId = parseInt(req.usuario?.id);

    // Buscar el detalle
    const detalle = await ExamenPacienteDetalle.findByPk(id, {
      include: [
        {
          model: ExamenPaciente,
          as: 'Cabecera',
          include: [{ 
            model: Paciente,
            as: 'Paciente'
          }]
        },
        {
          model: Examen,
          as: 'Examen'
        }
      ]
    });

    if (!detalle) {
      return res.status(404).json({ 
        success: false,
        message: 'Detalle de examen no encontrado' 
      });
    }

    // Registrar en historial
    await HistorialResultados.create({
      examenPacienteDetalleId: parseInt(id),
      laboratoristaId: laboratoristaId,
      accion: 'edicion',
      resultadosAnteriores: detalle.resultados,
      resultadosNuevos: resultado,
      observacionesAnteriores: detalle.observaciones,
      observacionesNuevas: observaciones,
      cambios: JSON.stringify(['Resultados actualizados']),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log('✅ Registro de historial creado correctamente');

    // ✅ CORREGIDO: Preparar datos de actualización - SOLO CAMBIAR ESTADO SI marcarComolisto ES true
    const datosActualizacion = {
      resultados: resultado,
      observaciones: observaciones,
      parametrosResultados: {
        metodo: metodo,
        ultimaEdicionPor: laboratoristaId,
        ultimaEdicionEn: new Date()
      },
      laboratoristaId: laboratoristaId,
      updatedAt: new Date()
    };

    // ✅ CRÍTICO: SOLO cambiar estado si explícitamente se solicita
    if (marcarComolisto === true) {
      datosActualizacion.estado = 'completado';
      datosActualizacion.fechaCompletado = new Date();
      datosActualizacion.pdfPendiente = true;
      console.log(`📄 Examen marcado como completado - PDF pendiente de generación`);
    } else {
      console.log(`📝 Examen actualizado sin cambiar estado - manteniendo: ${detalle.estado}`);
    }

    // Actualizar el detalle
    await detalle.update(datosActualizacion);

    console.log('🎉 ACTUALIZACIÓN EXITOSA - Estado final:', datosActualizacion.estado || detalle.estado);

    res.json({
      success: true,
      message: marcarComolisto ? 
        'Resultados guardados y examen marcado como completado' : 
        'Resultados guardados correctamente',
      detalle: {
        id: detalle.id,
        estado: datosActualizacion.estado || detalle.estado, // ✅ Mantener estado anterior si no se cambia
        resultados: resultado,
        pdfPendiente: datosActualizacion.pdfPendiente || false
      }
    });

  } catch (error) {
    console.error('❌ Error actualizando resultado:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error actualizando resultado', 
      error: error.message 
    });
  }
};

// ✅ MÉTODO PARA OBTENER TODOS LOS EXAMENES PENDIENTES CON FILTROS
const getExamenesPendientes = async (req, res) => {
  try {
    const { 
      sucursal, 
      usuario, 
      estado = 'pendiente',
      fechaDesde,
      fechaHasta,
      orden = 'fechaRegistro',
      direccion = 'DESC'
    } = req.query;

    console.log('🔍 FILTROS SOLICITADOS:', {
      sucursal,
      usuario,
      estado,
      fechaDesde,
      fechaHasta,
      orden,
      direccion
    });

    const whereClause = {};
    
    // ✅ Filtrar por estado (pendiente, en_proceso, completado, todos)
    if (estado && estado !== 'todos') {
      whereClause.estado = estado;
    }

    // ✅ Filtrar por sucursal (usando sucursalId de ExamenPacienteDetalle)
    if (sucursal && sucursal !== '0' && sucursal !== 'todos') {
      whereClause.sucursalId = parseInt(sucursal);
    }

    // ✅ Filtrar por usuario que registró (registradoPor o asignadoPor)
    if (usuario && usuario.trim() !== '') {
      whereClause[Op.or] = [
        { registradoPor: { [Op.like]: `%${usuario}%` } },
        { '$Cabecera.asignadoPor$': { [Op.like]: `%${usuario}%` } }
      ];
    }

    // ✅ Filtrar por rango de fechas (fechaRegistro o createdAt)
    if (fechaDesde || fechaHasta) {
      whereClause[Op.or] = [
        { fechaRegistro: {} },
        { createdAt: {} }
      ];
      
      if (fechaDesde) {
        const fechaDesdeObj = new Date(fechaDesde);
        fechaDesdeObj.setHours(0, 0, 0, 0);
        
        if (whereClause[Op.or][0].fechaRegistro) {
          whereClause[Op.or][0].fechaRegistro[Op.gte] = fechaDesdeObj;
        }
        if (whereClause[Op.or][1].createdAt) {
          whereClause[Op.or][1].createdAt[Op.gte] = fechaDesdeObj;
        }
      }
      
      if (fechaHasta) {
        const fechaHastaObj = new Date(fechaHasta);
        fechaHastaObj.setHours(23, 59, 59, 999);
        
        if (whereClause[Op.or][0].fechaRegistro) {
          whereClause[Op.or][0].fechaRegistro[Op.lte] = fechaHastaObj;
        }
        if (whereClause[Op.or][1].createdAt) {
          whereClause[Op.or][1].createdAt[Op.lte] = fechaHastaObj;
        }
      }
    }

    console.log('🔧 WHERE CLAUSE GENERADO:', JSON.stringify(whereClause, null, 2));

    // ✅ Construir opciones de ordenamiento
    let orderClause;
    switch (orden) {
      case 'paciente':
        orderClause = [[{ model: db.ExamenPaciente, as: 'Cabecera' }, { model: db.Paciente, as: 'Paciente' }, 'nombres', direccion]];
        break;
      case 'usuarioAsignador':
        orderClause = [[{ model: db.ExamenPaciente, as: 'Cabecera' }, 'asignadoPor', direccion]];
        break;
      case 'sucursal':
        orderClause = [[{ model: db.Sucursal, as: 'Sucursal' }, 'nombre', direccion]];
        break;
      case 'horaRegistro':
        orderClause = [['horaRegistro', direccion]];
        break;
      case 'fechaRegistro':
      default:
        orderClause = [['fechaRegistro', direccion], ['createdAt', direccion]];
        break;
    }

    // ✅ Consulta principal con todas las relaciones necesarias
    const examenes = await db.ExamenPacienteDetalle.findAll({
      where: whereClause,
      include: [
        {
          model: db.ExamenPaciente,
          as: 'Cabecera',
          include: [
            {
              model: db.Paciente,
              as: 'Paciente',
              attributes: ['id', 'nombres', 'apellidos', 'cedula', 'telefono']
            }
          ]
        },
        {
          model: db.Sucursal,
          as: 'Sucursal',
          attributes: ['id', 'nombre', 'direccion']
        },
        {
          model: db.Laboratorista,
          as: 'Laboratorista',
          attributes: ['id', 'nombres', 'apellidos', 'usuario']
        },
        {
          model: db.Examen,
          as: 'Examen',
          attributes: ['id', 'nombre', 'descripcion']
        },
        {
          model: db.Subexamen,
          as: 'Subexamen',
          attributes: ['id', 'nombre', 'descripcion'],
          include: [{
            model: db.Examen,
            as: 'Examen',
            attributes: ['nombre']
          }]
        }
      ],
      order: orderClause,
      limit: 200 // ✅ Aumentado para más resultados
    });

    console.log(`✅ Se encontraron ${examenes.length} exámenes con los filtros aplicados`);

    // ✅ Procesar resultados para el frontend
    const examenesProcesados = examenes.map(examen => ({
      // IDs
      detalleId: examen.id,
      examenPacienteId: examen.examenPacienteId,
      pacienteId: examen.Cabecera?.Paciente?.id,
      
      // Información del examen
      nombre: examen.nombreExamen || 
             (examen.Examen?.nombre) || 
             (examen.Subexamen?.nombre) || 
             'Examen sin nombre',
      estado: examen.estado || 'pendiente',
      
      // Información del paciente
      paciente: examen.Cabecera?.Paciente ? 
               `${examen.Cabecera.Paciente.nombres || ''} ${examen.Cabecera.Paciente.apellidos || ''}`.trim() : 
               'Paciente no disponible',
      cedula: examen.Cabecera?.Paciente?.cedula || '',
      telefono: examen.Cabecera?.Paciente?.telefono || '',
      
      // Información del usuario que registró
      usuarioAsignador: examen.registradoPor || 
                       examen.Cabecera?.asignadoPor || 
                       (examen.Laboratorista ? 
                         `${examen.Laboratorista.nombres} ${examen.Laboratorista.apellidos}` : 
                         'No especificado'),
      usuarioId: examen.Cabecera?.usuarioAsignadorId || examen.laboratoristaId,
      tipoUsuario: examen.Cabecera?.tipoUsuarioAsignador || 'laboratorista',
      
      // Información de sucursal
      sucursal: examen.Sucursal?.nombre || 'Sin sucursal',
      sucursalId: examen.sucursalId,
      
      // Fechas y horas
      fechaAsignacion: examen.Cabecera?.fechaAsignacion,
      fechaRegistro: examen.fechaRegistro || examen.createdAt,
      horaRegistro: examen.horaRegistro || 
                   (examen.createdAt ? 
                     examen.createdAt.toTimeString().split(' ')[0] : 
                     '00:00:00'),
      laboratorio: examen.laboratorio || 'Laboratorio Central',
      
      // Datos adicionales
      medicoSolicitante: examen.medicoSolicitanteDetalle || examen.Cabecera?.medicoSolicitante || '',
      observaciones: examen.observaciones || '',
      resultados: examen.resultados,
      precioFinal: examen.precioFinal || 0
    }));

    res.json({
      success: true,
      data: examenesProcesados,
      total: examenesProcesados.length,
      filtrosAplicados: {
        sucursal: sucursal || 'Todas',
        usuario: usuario || 'Todos',
        estado: estado || 'Todos',
        fechaDesde,
        fechaHasta,
        orden,
        direccion
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo exámenes pendientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener exámenes pendientes',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
    });
  }
};


// ✅ MÉTODO PARA OBTENER LISTA DE SUCURSALES (para el filtro)
const getSucursales = async (req, res) => {
  try {
    const sucursales = await db.Sucursal.findAll({
      attributes: ['id', 'nombre', 'direccion', 'telefono', 'activo'],
      where: { activo: true },
      order: [['nombre', 'ASC']]
    });

    res.json({
      success: true,
      data: sucursales,
      total: sucursales.length
    });
  } catch (error) {
    console.error('❌ Error obteniendo sucursales:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener sucursales'
    });
  }
};


const obtenerDetalleExamen = async (req, res) => {
  try {
    const { detalleId } = req.params;

    const detalle = await db.ExamenPacienteDetalle.findByPk(detalleId, {
      include: [
        { model: db.ExamenPaciente, as: 'Cabecera' },
        { model: db.Examen, as: 'Examen', include: [{ model: db.Area, as: 'Area', required: false }], required: false },
        { model: db.Subexamen, as: 'Subexamen', required: false },
        { model: db.Sucursal, as: 'Sucursal', required: false },
        { model: db.Laboratorista, as: 'Laboratorista', required: false }
      ]
    });

    if (!detalle) {
      return res.status(404).json({ success: false, message: 'Detalle no encontrado' });
    }

    // ✅ Nombre examen
    const nombre =
      detalle.nombreExamen ||
      detalle.Examen?.nombre ||
      detalle.Subexamen?.nombre ||
      'Examen';

    // ✅ Área (puede venir del Examen -> Area)
    const area =
      detalle.Examen?.Area?.nombre ||
      detalle.Examen?.area?.nombre || // por si tu Area se llama distinto
      'No especificado';

    // ✅ Precio real: usa precioFinal o precioAplicado (TU MODELO SÍ TIENE)
    const precio =
      Number(detalle.precioFinal ?? detalle.precioAplicado ?? 0);

    return res.json({
  success: true,
  data: {
    // ===============================
    // DATOS PRINCIPALES
    // ===============================
    nombre: detalle.nombreExamen,
    area: detalle.Examen?.Area?.nombre || 'No especificado',

    // 👇 AQUÍ ESTÁ TU PRECIO REAL
    precio: Number(detalle.precioFinal || detalle.precioAplicado || 0),

    estado: detalle.estado || 'pendiente',
    estadoPago: detalle.Cabecera?.estadoPago || 'pendiente',
    saldoPendiente: detalle.Cabecera?.saldoPendiente || 0,

    // ===============================
    // INFORMACIÓN TÉCNICA
    // (si no existe en BD → No especificado)
    // ===============================
    informacionTecnica: {
      tipoMuestra: detalle.Examen?.tipoMuestra || 'No especificado',
      horaEntrega: detalle.Examen?.horaEntrega || 'No especificado',
      tipoTubo: detalle.Examen?.tipoTubo || 'No especificado',
      metodo: detalle.Examen?.metodo || 'No especificado',
      detallesEspecificos: detalle.Examen?.observaciones || 'No especificado'
    },

    // ===============================
    // INFORMACIÓN DE REGISTRO
    // (ESTO SÍ ESTÁ EN TU MODELO)
    // ===============================
    informacionRegistro: {
      registradoPor: detalle.registradoPor || 'No especificado',
      fechaRegistro: detalle.fechaRegistro || 'No especificado',
      horaRegistro: detalle.horaRegistro || 'No especificado',
      laboratorio: detalle.laboratorio || 'No especificado'
    }
  }
});


  } catch (error) {
    console.error('❌ Error obtenerDetalleExamen:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};





// ✅ DETALLE COMPLETO PARA PDF (AREA + EXAMEN/SUBEXAMEN + LABORATORISTA + PACIENTE)
// ✅ DETALLE COMPLETO PARA PDF (PACIENTE + MEDICO + LABORATORISTA + AREA + EXAMEN/SUBEXAMEN)

// ✅ DETALLE COMPLETO PARA PDF (PACIENTE + MEDICO + LABORATORISTA + AREA + EXAMEN/SUBEXAMEN)
async function getDetalleParaPdf(req, res) {
  try {
    const detalleId = req.params.detalleId || req.params.id;

    console.log('📄 getDetalleParaPdf -> detalleId:', detalleId);

    const detalle = await db.ExamenPacienteDetalle.findByPk(detalleId, {
      include: [
        // =========================
        // CABECERA + PACIENTE + LAB (cabecera)
        // =========================
        {
          model: db.ExamenPaciente,
          as: 'Cabecera', // ⚠️ Debe existir este alias en tu associate
          attributes: ['id', 'fechaAsignacion', 'estadoPago', 'total', 'saldoPendiente', 'medicoSolicitante', 'asignadoPor'],
          required: false,
          include: [
            {
              model: db.Paciente,
              as: 'Paciente',
              attributes: ['id', 'nombres', 'apellidos', 'cedula', 'edad', 'sexo'],
              required: false
            },
            {
              model: db.Laboratorista,
              as: 'Laboratorista',
              attributes: ['id', 'nombres', 'apellidos', 'usuario'],
              required: false
            },
            {
              model: db.Sucursal,
              as: 'Sucursal',
              attributes: ['id', 'nombre'],
              required: false
            }
          ]
        },

        // =========================
        // EXAMEN + AREA
        // =========================
        {
          model: db.Examen,
          as: 'Examen', // ⚠️ Debe existir este alias
          attributes: ['id', 'nombre', 'tipoMuestra', 'tipoTubo', 'metodo', 'observaciones'],
          required: false,
          include: [
            {
              model: db.Area,
              as: 'Area', // ⚠️ Debe existir este alias
              attributes: ['id', 'nombre'],
              required: false
            }
          ]
        },

        // =========================
        // SUBEXAMEN + EXAMEN PADRE + AREA
        // =========================
        {
          model: db.Subexamen,
          as: 'Subexamen', // ⚠️ Debe existir este alias
          attributes: ['id', 'nombre'],
          required: false,
          include: [
            {
              model: db.Examen,
              as: 'Examen', // ⚠️ alias del subexamen -> Examen padre
              attributes: ['id', 'nombre', 'tipoMuestra', 'tipoTubo', 'metodo', 'observaciones'],
              required: false,
              include: [
                {
                  model: db.Area,
                  as: 'Area',
                  attributes: ['id', 'nombre'],
                  required: false
                }
              ]
            }
          ]
        },

        // =========================
        // LABORATORISTA DEL DETALLE (quien editó/completó)
        // =========================
        {
          model: db.Laboratorista,
          as: 'Laboratorista',
          attributes: ['id', 'nombres', 'apellidos', 'usuario'],
          required: false
        },

        // =========================
        // SUCURSAL DIRECTA EN DETALLE
        // =========================
        {
          model: db.Sucursal,
          as: 'Sucursal',
          attributes: ['id', 'nombre'],
          required: false
        }
      ]
    });

    if (!detalle) {
      return res.status(404).json({ success: false, mensaje: 'No se encontró el detalle' });
    }

    // 🔎 LOG CLAVE
    console.log('🔎 IDS en detalle:', {
      id: detalle.id,
      examenId: detalle.examenId,
      subexamenId: detalle.subexamenId,
      esSubexamen: detalle.esSubexamen,
      nombreExamenPlano: detalle.nombreExamen,
      medicoSolicitanteDetalle: detalle.medicoSolicitanteDetalle,
      medicoCabecera: detalle?.Cabecera?.medicoSolicitante,
      areaExamen: detalle?.Examen?.Area?.nombre,
      areaSub: detalle?.Subexamen?.Examen?.Area?.nombre,
      laboratoristaDetalle: detalle?.Laboratorista ? `${detalle.Laboratorista.nombres} ${detalle.Laboratorista.apellidos}` : null,
      laboratoristaCabecera: detalle?.Cabecera?.Laboratorista ? `${detalle.Cabecera.Laboratorista.nombres} ${detalle.Cabecera.Laboratorista.apellidos}` : null,
      sucursalDetalle: detalle?.Sucursal?.nombre,
      sucursalCabecera: detalle?.Cabecera?.Sucursal?.nombre
    });

    // =========================
    // NOMBRE EXAMEN / SUBEXAMEN
    // =========================
    const esSub = !!detalle.esSubexamen || (!!detalle.subexamenId && !!detalle.Subexamen);

    const nombreExamen =
      detalle.nombreExamen ||
      (esSub ? detalle?.Subexamen?.nombre : detalle?.Examen?.nombre) ||
      (detalle?.Subexamen?.Examen?.nombre ? `${detalle.Subexamen.Examen.nombre} - ${detalle.Subexamen.nombre}` : null) ||
      'Examen';

    // =========================
    // ÁREA
    // =========================
    const areaNombre =
      detalle?.Examen?.Area?.nombre ||
      detalle?.Subexamen?.Examen?.Area?.nombre ||
      'No especificado';

    // =========================
    // MÉDICO SOLICITANTE
    // =========================
    const medicoSolicitante =
      detalle.medicoSolicitanteDetalle ||
      detalle?.Cabecera?.medicoSolicitante ||
      '';

    // =========================
    // LABORATORISTA (prioridad: quien editó/completó el detalle)
    // =========================
    const laboratorista =
      detalle?.Laboratorista
        ? {
            id: detalle.Laboratorista.id,
            nombres: detalle.Laboratorista.nombres,
            apellidos: detalle.Laboratorista.apellidos,
            usuario: detalle.Laboratorista.usuario
          }
        : (detalle?.Cabecera?.Laboratorista
            ? {
                id: detalle.Cabecera.Laboratorista.id,
                nombres: detalle.Cabecera.Laboratorista.nombres,
                apellidos: detalle.Cabecera.Laboratorista.apellidos,
                usuario: detalle.Cabecera.Laboratorista.usuario
              }
            : null);

    // =========================
    // SUCURSAL (prioridad: detalle -> cabecera)
    // =========================
    const sucursal =
      detalle?.Sucursal?.nombre ||
      detalle?.Cabecera?.Sucursal?.nombre ||
      'Sin sucursal';

    // =========================
    // PRECIO REAL
    // =========================
    const precio = Number(detalle.precioFinal ?? detalle.precioAplicado ?? 0);

    // =========================
    // RESULTADOS (por si vienen en resultados o parametrosResultados)
    // =========================
    const resultados =
      (detalle.resultados && (typeof detalle.resultados === 'object' ? detalle.resultados : detalle.resultados)) ||
      (detalle.parametrosResultados && detalle.parametrosResultados) ||
      null;

    return res.json({
      success: true,
      data: {
        // =========================
        // PACIENTE
        // =========================
        paciente: detalle?.Cabecera?.Paciente
          ? {
              id: detalle.Cabecera.Paciente.id,
              nombres: detalle.Cabecera.Paciente.nombres,
              apellidos: detalle.Cabecera.Paciente.apellidos,
              cedula: detalle.Cabecera.Paciente.cedula,
              edad: detalle.Cabecera.Paciente.edad,
              sexo: detalle.Cabecera.Paciente.sexo
            }
          : null,

        // =========================
        // CABECERA
        // =========================
        cabecera: detalle?.Cabecera
          ? {
              id: detalle.Cabecera.id,
              fechaAsignacion: detalle.Cabecera.fechaAsignacion,
              estadoPago: detalle.Cabecera.estadoPago,
              total: detalle.Cabecera.total,
              saldoPendiente: detalle.Cabecera.saldoPendiente,
              asignadoPor: detalle.Cabecera.asignadoPor
            }
          : null,

        // =========================
        // MÉDICO
        // =========================
        medicoSolicitante,

        // =========================
        // EXAMEN / SUBEXAMEN
        // =========================
        examen: {
          id: esSub ? detalle?.Subexamen?.id : detalle?.Examen?.id,
          nombre: nombreExamen,
          esSubexamen: esSub,
          area: areaNombre
        },

        // =========================
        // INFO TÉCNICA (del examen padre)
        // =========================
        informacionTecnica: {
          tipoMuestra: detalle?.Examen?.tipoMuestra || detalle?.Subexamen?.Examen?.tipoMuestra || 'No especificado',
          tipoTubo: detalle?.Examen?.tipoTubo || detalle?.Subexamen?.Examen?.tipoTubo || 'No especificado',
          metodo: detalle?.Examen?.metodo || detalle?.Subexamen?.Examen?.metodo || 'No especificado',
          observacionesExamen: detalle?.Examen?.observaciones || detalle?.Subexamen?.Examen?.observaciones || 'No especificado'
        },

        // =========================
        // DETALLE (precio/estado/resultados)
        // =========================
        detalle: {
          id: detalle.id,
          estado: detalle.estado || 'pendiente',
          precio,
          resultados,
          observaciones: detalle.observaciones || ''
        },

        // =========================
        // LABORATORISTA + SUCURSAL
        // =========================
        laboratorista,
        sucursal,

        // =========================
        // INFO REGISTRO (lo que tú guardas)
        // =========================
        informacionRegistro: {
          registradoPor: detalle.registradoPor || detalle?.Cabecera?.asignadoPor || 'No especificado',
          fechaRegistro: detalle.fechaRegistro || detalle.createdAt || null,
          horaRegistro:
            detalle.horaRegistro ||
            (detalle.createdAt ? detalle.createdAt.toTimeString().split(' ')[0] : null),
          laboratorio: detalle.laboratorio || sucursal
        }
      }
    });
  } catch (error) {
    console.error('❌ Error en getDetalleParaPdf:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno en getDetalleParaPdf',
      error: error.message
    });
  }
}















const obtenerHistorialPorDetalle = async (req, res) => {
  try {
    const pacienteId = Number(req.params.pacienteId);
    const detalleId = Number(req.params.detalleId);

    console.log('🧪 [HISTORIAL] Params recibidos:', { pacienteId, detalleId });

    if (!pacienteId || !detalleId) {
      console.log('❌ [HISTORIAL] IDs inválidos');
      return res.status(400).json({
        success: false,
        mensaje: 'pacienteId o detalleId inválido'
      });
    }

    // 1) Buscar el detalle para obtener el nombre real (incluye Examen/Subexamen)
    const detalle = await db.ExamenPacienteDetalle.findByPk(detalleId, {
      attributes: ['id', 'nombreExamen', 'examenId', 'subexamenId'],
      include: [
        { model: db.Examen, as: 'Examen', attributes: ['id', 'nombre'], required: false },
        { model: db.Subexamen, as: 'Subexamen', attributes: ['id', 'nombre'], required: false }
      ]
    });

    if (!detalle) {
      console.log('❌ [HISTORIAL] No existe detalle');
      return res.status(404).json({
        success: false,
        mensaje: 'No se encontró el detalle del examen'
      });
    }

    // ✅ Nombre final con prioridad + normalización (trim + colapsa espacios)
    const normalizar = (s) => String(s || '').trim().replace(/\s+/g, ' ');

    const nombreFinal =
      normalizar(detalle.nombreExamen) ||
      normalizar(detalle.Subexamen?.nombre) ||
      normalizar(detalle.Examen?.nombre);

    console.log('✅ [HISTORIAL] nombreFinal calculado:', nombreFinal);

    if (!nombreFinal) {
      console.log('❌ [HISTORIAL] No se pudo determinar nombreFinal');
      return res.status(400).json({
        success: false,
        mensaje: 'No se pudo determinar el nombre del examen/subexamen'
      });
    }

    // 2) Buscar historial por nombreExamen del MISMO paciente
    // ✅ Opción recomendada: LIKE flexible para evitar diferencias pequeñas
    const historial = await db.ExamenPacienteDetalle.findAll({
      where: {
        nombreExamen: { [Op.iLike]: `%${nombreFinal}%` }
        // Si quieres exacto estricto (pero puede fallar por espacios):
        // nombreExamen: { [Op.iLike]: nombreFinal }
        // o exacto total:
        // nombreExamen: { [Op.eq]: nombreFinal }
      },
      include: [
        {
          model: db.ExamenPaciente,
          as: 'Cabecera',
          required: true,
          attributes: ['id', 'pacienteId', 'fechaAsignacion'],
          where: { pacienteId }
        }
      ],
      attributes: [
        'id',
        'examenPacienteId',
        'examenId',
        'subexamenId',
        'nombreExamen',
        'estado',
        'resultados',
        'parametrosResultados',
        'createdAt'
      ],
      order: [[{ model: db.ExamenPaciente, as: 'Cabecera' }, 'fechaAsignacion', 'ASC']]
    });

    console.log(`✅ [HISTORIAL] Registros encontrados: ${historial.length}`);

    // Debug rápido: muestra 3 primeras filas
    console.log(
      '🔎 [HISTORIAL] Primeros registros:',
      historial.slice(0, 3).map(h => ({
        id: h.id,
        nombreExamen: h.nombreExamen,
        fechaAsignacion: h.Cabecera?.fechaAsignacion
      }))
    );

    const payload = {
      success: true,
      nombreExamen: nombreFinal,
      total: historial.length,
      historial: historial.map(h => ({
        id: h.id,
        examenPacienteId: h.examenPacienteId,
        examenId: h.examenId,
        subexamenId: h.subexamenId,
        nombreExamen: h.nombreExamen,
        estado: h.estado,
        resultados: h.resultados,
        parametrosResultados: h.parametrosResultados,
        fechaAsignacion: h.Cabecera?.fechaAsignacion || null,
        createdAt: h.createdAt
      }))
    };

    console.log('📦 [HISTORIAL] Respuesta enviada:', {
      success: payload.success,
      nombreExamen: payload.nombreExamen,
      total: payload.total
    });

    return res.json(payload);

  } catch (error) {
    console.error('❌ [HISTORIAL] Error:', error);
    return res.status(500).json({
      success: false,
      mensaje: 'Error interno obteniendo historial',
      error: error.message
    });
  }
};




module.exports = {
  // 🩺 PRINCIPALES
  asignarExamenes,
  obtenerExamenesConArea,
  obtenerResumenExamenesPaciente,
  obtenerExamenesAgrupadosPorFecha,
  obtenerExamenesConPreciosSeparados,

  // 🔄 ESTADOS / RESULTADOS
  actualizarEstadoExamen,
  subirResultadoExamen,
  actualizarResultadoExamen,        // versión nueva
  actualizarResultado: actualizarResultadoExamen, // alias por si las rutas usan el nombre viejo

  // 📄 PDF (individual y completo)
  generarPDFResultados,
 
  guardarPdfResultado,
    // (si esta función es la "oficial" que quieres usar)
  generarPdfAutomatico,
  forzarGeneracionPdf,

  // 📊 AGRUPACIÓN / JERARQUÍA
  calcularPreciosExamenCorregido,
  extraerPreciosConcatenados,
  procesarJerarquiaCompleta,
  buscarCabecerasPorFecha,
  procesarDetalleParaGrupo,

  // 🔍 DETALLES E HISTORIAL
  obtenerInformacionRegistroDetalle,
  obtenerDetalleCompleto,
  obtenerHistorialResultados,
  compararResultados,
  registrarEnHistorial,
  completarExamen,

  // 📚 CATÁLOGOS
  obtenerTiposExamen,
  obtenerPromocionesActivas,

  // 🔐 FIRMA
  firmarExamen,
  firmarYCompletarExamen,
  descargarPdfFirmado,

  // 🧰 UTILIDADES DE REPARACIÓN / DIAGNÓSTICO
  diagnosticarExamenesPaciente,
  repararNombresExamenes,
  repararDatosExamenes,
  diagnosticarProblemaFechas,

  // 🔧 OTROS ENDPOINTS
  cambiarEstado,
  actualizarAreaEspecializada,
    getExamenesPendientes, // ✅ NUEVO - AGREGAR ESTA LÍNEA
getSucursales,
   obtenerDetalleExamen,  // ESTA ERA LA FALTANTE
  obtenerHistorialPorDetalle,
  getExamenesPendientes,
  getDetalleParaPdf 
};

console.log('✅ Controlador de exámenes exportado correctamente con todas las funciones');
