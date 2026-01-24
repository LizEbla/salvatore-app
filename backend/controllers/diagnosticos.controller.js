// diagnosticos.controller.js - CONTROLADOR PARA DIAGNÓSTICOS
const db = require('../models');
const { Op, Sequelize } = require('sequelize');

// Modelos
const { ExamenPaciente, ExamenPacienteDetalle, Examen, Paciente, Area, Subexamen } = db;

// 🩺 DIAGNÓSTICO DE PRECIOS
const diagnosticarPrecios = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🔍 DIAGNÓSTICO DE PRECIOS - Paciente ID:', id);

    const examenes = await ExamenPaciente.findAll({
      where: { pacienteId: id },
      include: [
        {
          model: ExamenPacienteDetalle,
          as: 'Detalles',
          include: [
            { model: Examen, as: 'Examen' },
            { model: Subexamen, as: 'Subexamen' }
          ]
        }
      ]
    });

    const diagnostico = examenes.map(examen => ({
      id: examen.id,
      fecha: examen.fechaAsignacion,
      detalles: examen.Detalles ? examen.Detalles.map(detalle => ({
        id: detalle.id,
        precioFinal: detalle.precioFinal,
        tipo: typeof detalle.precioFinal,
        esSubexamen: detalle.esSubexamen,
        nombre: detalle.nombreExamen,
        preciosExtraidos: detalle.precioFinal && typeof detalle.precioFinal === 'string' ? 
          extraerPreciosConcatenados(detalle.precioFinal) : [detalle.precioFinal]
      })) : []
    }));

    res.json({
      pacienteId: id,
      totalRegistros: examenes.length,
      diagnostico: diagnostico,
      resumen: {
        totalDetalles: diagnostico.reduce((sum, exam) => sum + exam.detalles.length, 0),
        preciosConcatenados: diagnostico.filter(exam => 
          exam.detalles.some(det => 
            det.precioFinal && typeof det.precioFinal === 'string' && 
            det.precioFinal.split('.').length > 2
          )
        ).length
      }
    });

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    res.status(500).json({ error: error.message });
  }
};

// 🔧 REPARAR PRECIOS MASIVO
const repararPreciosMasivo = async (req, res) => {
  try {
    console.log('🔧 INICIANDO REPARACIÓN MASIVA DE PRECIOS');
    
    const examenesPaciente = await ExamenPaciente.findAll({
      where: { precio: 0 },
      include: [{
        model: Examen,
        attributes: ['id', 'nombre', 'precio']
      }]
    });

    console.log(`📊 Encontrados ${examenesPaciente.length} exámenes con precio 0`);

    let reparados = 0;
    let errores = 0;

    for (const examenPaciente of examenesPaciente) {
      if (examenPaciente.Examen && examenPaciente.Examen.precio > 0) {
        try {
          await examenPaciente.update({
            precio: examenPaciente.Examen.precio
          });
          console.log(`✅ Reparado: ${examenPaciente.Examen.nombre} - ${examenPaciente.Examen.precio}`);
          reparados++;
        } catch (error) {
          console.error(`❌ Error reparando examen ${examenPaciente.id}:`, error);
          errores++;
        }
      }
    }

    res.json({
      success: true,
      message: `Reparación completada: ${reparados} reparados, ${errores} errores`,
      reparados,
      errores
    });

  } catch (error) {
    console.error('❌ Error en reparación masiva:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error en reparación masiva',
      error: error.message 
    });
  }
};

// 🔧 REPARAR PRECIO INDIVIDUAL
const repararPrecioExamen = async (req, res) => {
  try {
    const { examenPacienteId } = req.params;
    const { precio } = req.body;

    console.log('🔧 Reparando precio para examen:', examenPacienteId, precio);

    const examenPaciente = await ExamenPaciente.findByPk(examenPacienteId, {
      include: [{ model: Examen }]
    });

    if (!examenPaciente) {
      return res.status(404).json({ error: 'Examen no encontrado' });
    }

    const precioFinal = precio || examenPaciente.Examen?.precio || 0;

    await examenPaciente.update({ precio: precioFinal });

    res.json({
      success: true,
      message: 'Precio reparado correctamente',
      examen: examenPaciente
    });

  } catch (error) {
    console.error('❌ Error al reparar precio:', error);
    res.status(500).json({ 
      success: false,
      mensaje: 'Error al reparar precio',
      error: error.message 
    });
  }
};

// 🩺 DIAGNÓSTICO DE CABECERAS
const diagnosticarCabecerasPaciente = async (req, res) => {
  try {
    const { pacienteId } = req.params;

    console.log('🔍 DIAGNÓSTICO CABECERAS - Paciente ID:', pacienteId);

    const cabeceras = await ExamenPaciente.findAll({
      where: { pacienteId },
      include: [{
        model: ExamenPacienteDetalle,
        as: 'Detalles',
        attributes: ['id', 'precioAplicado', 'precioFinal', 'descuentoAplicado']
      }],
      order: [['fechaAsignacion', 'DESC']],
      attributes: ['id', 'fechaAsignacion', 'total', 'abono', 'saldoPendiente', 'cantidadExamenes']
    });

    const diagnostico = cabeceras.map(cabecera => {
      const totalDetalles = cabecera.Detalles.reduce((sum, detalle) => {
        return sum + parseFloat(detalle.precioFinal || detalle.precioAplicado || 0);
      }, 0);

      return {
        cabeceraId: cabecera.id,
        fecha: cabecera.fechaAsignacion,
        totalBD: cabecera.total,
        abonoBD: cabecera.abono,
        saldoPendienteBD: cabecera.saldoPendiente,
        cantidadExamenesBD: cabecera.cantidadExamenes,
        detalles: {
          count: cabecera.Detalles.length,
          totalCalculado: totalDetalles,
          diferencia: totalDetalles - parseFloat(cabecera.total || 0)
        },
        necesitaReparacion: Math.abs(totalDetalles - parseFloat(cabecera.total || 0)) > 0.01
      };
    });

    res.json({
      success: true,
      pacienteId,
      totalCabeceras: cabeceras.length,
      diagnostico,
      resumen: {
        cabecerasConProblemas: diagnostico.filter(d => d.necesitaReparacion).length,
        diferenciaTotal: diagnostico.reduce((sum, d) => sum + d.detalles.diferencia, 0)
      }
    });

  } catch (error) {
    console.error('❌ Error en diagnóstico cabeceras:', error);
    res.status(500).json({ error: error.message });
  }
};

// 🔧 REPARAR PRECIOS DE CABECERAS
const repararPreciosCabeceras = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const { pacienteId } = req.params;
    
    console.log('🔧 REPARANDO PRECIOS DE CABECERAS - Paciente ID:', pacienteId);

    const cabeceras = await ExamenPaciente.findAll({
      where: { pacienteId },
      include: [{
        model: ExamenPacienteDetalle,
        as: 'Detalles'
      }],
      transaction: t
    });

    console.log(`📊 Encontradas ${cabeceras.length} cabeceras para reparar`);

    let cabecerasReparadas = 0;
    let errores = 0;

    for (const cabecera of cabeceras) {
      try {
        let totalCalculado = 0;
        
        if (cabecera.Detalles && cabecera.Detalles.length > 0) {
          totalCalculado = cabecera.Detalles.reduce((total, detalle) => {
            return total + parseFloat(detalle.precioFinal || detalle.precioAplicado || 0);
          }, 0);
        }

        const totalActual = parseFloat(cabecera.total || 0);
        
        if (Math.abs(totalActual - totalCalculado) > 0.01) {
          await cabecera.update({
            total: totalCalculado,
            saldoPendiente: Math.max(0, totalCalculado - parseFloat(cabecera.abono || 0))
          }, { transaction: t });

          console.log(`✅ Cabecera ${cabecera.id} reparada: $${totalActual} -> $${totalCalculado}`);
          cabecerasReparadas++;
        }
      } catch (error) {
        console.error(`❌ Error reparando cabecera ${cabecera.id}:`, error);
        errores++;
      }
    }

    await t.commit();

    res.json({
      success: true,
      message: `Reparación completada: ${cabecerasReparadas} cabeceras reparadas, ${errores} errores`,
      cabecerasReparadas,
      errores
    });

  } catch (error) {
    await t.rollback();
    console.error('❌ Error en reparación de cabeceras:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// 🩺 DIAGNÓSTICO DE GRUPOS
const diagnosticarGruposExamenes = async (req, res) => {
  try {
    const { pacienteId } = req.params;
    
    console.log('🔍 DIAGNÓSTICO GRUPOS EXAMENES - Paciente ID:', pacienteId);

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
              include: [{ model: Area, as: 'Area' }]
            },
            {
              model: Subexamen,
              as: 'Subexamen',
              include: [
                {
                  model: Examen,
                  as: 'Examen',
                  include: [{ model: Area, as: 'Area' }]
                }
              ]
            }
          ]
        }
      ],
      order: [['fechaAsignacion', 'DESC']]
    });

    res.json({
      success: true,
      diagnostico: {
        totalCabeceras: examenes.length,
        cabeceras: examenes.map(cab => ({
          id: cab.id,
          fechaAsignacion: cab.fechaAsignacion,
          fechaUTC: new Date(cab.fechaAsignacion).toISOString(),
          fechaLocal: new Date(cab.fechaAsignacion).toLocaleDateString('es-EC'),
          precioTotal: cab.precioTotal,
          total: cab.total,
          abono: cab.abono,
          detallesCount: cab.Detalles?.length || 0,
          detalles: cab.Detalles?.map(det => ({
            id: det.id,
            nombreExamen: det.nombreExamen,
            examenId: det.examenId,
            subexamenId: det.subexamenId,
            precioAplicado: det.precioAplicado,
            precioFinal: det.precioFinal,
            examen: det.Examen?.nombre,
            subexamen: det.Subexamen?.nombre,
            area: det.Examen?.Area?.nombre || det.Subexamen?.Examen?.Area?.nombre
          }))
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error en diagnóstico grupos:', error);
    res.status(500).json({ error: error.message });
  }
};

// 🩺 DIAGNÓSTICO DE ESTRUCTURA
const diagnosticarEstructuraExamenes = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🔍 DIAGNÓSTICO ESTRUCTURA - Paciente ID:', id);

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
              include: [{ model: Area, as: 'Area' }]
            },
            {
              model: Examen,
              as: 'ExamenPadre',
              include: [{ model: Area, as: 'Area' }]
            }
          ]
        }
      ],
      order: [['fechaAsignacion', 'DESC']]
    });

    const diagnostico = examenes.map(examen => ({
      id: examen.id,
      fecha: examen.fechaAsignacion,
      detalles: examen.Detalles ? examen.Detalles.map(detalle => {
        const info = extraerInfoBasica(detalle);
        return {
          detalleId: detalle.id,
          nombreOriginal: detalle.nombreExamen,
          esSubexamenBD: detalle.esSubexamen,
          esSubexamenDetectado: info.esSubexamen,
          examenPadreDetectado: info.examenNombre,
          area: info.areaNombre,
          precio: info.precio,
          examenAsociado: detalle.Examen?.nombre,
          examenPadreAsociado: detalle.ExamenPadre?.nombre
        };
      }) : []
    }));

    res.json({
      pacienteId: id,
      diagnostico: diagnostico,
      resumen: {
        totalCabeceras: examenes.length,
        totalDetalles: diagnostico.reduce((sum, exam) => sum + exam.detalles.length, 0),
        subexamenesDetectados: diagnostico.reduce((sum, exam) => 
          sum + exam.detalles.filter(det => det.esSubexamenDetectado).length, 0
        )
      }
    });

  } catch (error) {
    console.error('❌ Error en diagnóstico de estructura:', error);
    res.status(500).json({ error: error.message });
  }
};

// 🩺 DIAGNÓSTICO DE MODELO
const diagnosticarModelo = async (req, res) => {
  try {
    console.log('🔍 DIAGNÓSTICO DE MODELO ExamenPaciente');
    
    const resultado = await db.sequelize.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'examen_pacientes' 
      ORDER BY ordinal_position;
    `);
    
    console.log('📊 ESTRUCTURA DE TABLA examen_pacientes:');
    resultado[0].forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    
    res.json({
      success: true,
      estructuraTabla: resultado[0],
      modeloDefinido: Object.keys(db.ExamenPaciente.rawAttributes)
    });
    
  } catch (error) {
    console.error('❌ Error en diagnóstico de modelo:', error);
    res.status(500).json({ error: error.message });
  }
};

// 🩺 DIAGNÓSTICO BASE DE DATOS
const diagnosticarBaseDatos = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 DIAGNÓSTICO BASE DE DATOS - Paciente ID:', id);
    
    const examenesPaciente = await ExamenPaciente.findAll({
      where: { pacienteId: id },
      include: [{
        model: ExamenPacienteDetalle,
        as: 'Detalles'
      }],
      raw: true,
      nest: true
    });

    console.log('📊 DATOS CRUDOS EN BD:', JSON.stringify(examenesPaciente, null, 2));

    res.json({
      success: true,
      datos: examenesPaciente,
      mensaje: 'Diagnóstico completado'
    });

  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    res.status(500).json({ error: error.message });
  }
};

// 🔧 FUNCIONES AUXILIARES
function extraerPreciosConcatenados(precioStr) {
  if (!precioStr || typeof precioStr !== 'string') {
    return [0];
  }

  const cleaned = precioStr.replace(/[^\d.]/g, '');
  
  if (!cleaned) {
    return [0];
  }

  const regexPrecios = /\b\d{1,3}\.\d{2}\b/g;
  const matches = cleaned.match(regexPrecios);
  
  if (matches && matches.length > 0) {
    const preciosValidos = matches.map(match => {
      const precio = parseFloat(match);
      return !isNaN(precio) && precio > 0 ? precio : 0;
    }).filter(precio => precio > 0);
    
    if (preciosValidos.length > 0) {
      return preciosValidos;
    }
  }

  const precioDirecto = parseFloat(cleaned);
  if (!isNaN(precioDirecto) && precioDirecto > 0) {
    return [precioDirecto];
  }

  return [0];
}

function extraerInfoBasica(detalle) {
  let esSubexamen = detalle.esSubexamen || false;
  let examenNombre = detalle.nombreExamen || 'Examen no identificado';
  let areaNombre = 'General';
  let precio = parseFloat(detalle.precioFinal) || 0;

  const nombreLower = (detalle.nombreExamen || '').toLowerCase();
  
  const patronesSubexamen = [
    'igg', 'igm', 'iga', 'elisa', 'eclia', 'quimioluminiscencia', 
    'flujo lateral', 'inmunocromatografía', 'cuantitativo', 'cualitativo',
    'p24', 'antígeno', 'anticuerpo', 'serología'
  ];

  const esSubexamenPorNombre = patronesSubexamen.some(patron => 
    nombreLower.includes(patron)
  );

  if (detalle.Examen) {
    examenNombre = detalle.Examen.nombre;
    areaNombre = detalle.Examen.Area?.nombre || 'General';
    
    if (esSubexamenPorNombre && !esSubexamen) {
      if (areaNombre === 'HORMONAS' || areaNombre === 'SEROLOGÍA') {
        esSubexamen = true;
        examenNombre = 'Perfil Hormonal';
      }
    }
  } else if (detalle.ExamenPadre) {
    esSubexamen = true;
    examenNombre = detalle.ExamenPadre.nombre;
    areaNombre = detalle.ExamenPadre.Area?.nombre || 'General';
  } else {
    if (esSubexamenPorNombre) {
      esSubexamen = true;
    }
    
    if (nombreLower.includes('serolog') || nombreLower.includes('hepatitis') || 
        nombreLower.includes('hiv') || nombreLower.includes('toxoplasma') ||
        nombreLower.includes('h. pylori') || nombreLower.includes('eclia') ||
        nombreLower.includes('elisa')) {
      areaNombre = 'Serología';
    } else if (nombreLower.includes('hormon') || nombreLower.includes('eclia') ||
             nombreLower.includes('amh') || nombreLower.includes('tsh') ||
             nombreLower.includes('t3') || nombreLower.includes('t4')) {
      areaNombre = 'Hormonas';
    } else if (nombreLower.includes('hematolog') || nombreLower.includes('sanguíneo') || 
             nombreLower.includes('coombs') || nombreLower.includes('grupo')) {
      areaNombre = 'Hematología';
    } else if (nombreLower.includes('bioquim') || nombreLower.includes('glucosa') || 
             nombreLower.includes('colesterol') || nombreLower.includes('quimica')) {
      areaNombre = 'Bioquímica';
    }
  }

  return {
    esSubexamen,
    examenNombre,
    areaNombre,
    precio
  };
}

module.exports = {
  diagnosticarPrecios,
  repararPreciosMasivo,
  repararPrecioExamen,
  diagnosticarCabecerasPaciente,
  repararPreciosCabeceras,
  diagnosticarGruposExamenes,
  diagnosticarEstructuraExamenes,
  diagnosticarModelo,
  diagnosticarBaseDatos
};