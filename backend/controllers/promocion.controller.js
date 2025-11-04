// controllers/promocion.controller.js
const db = require('../models');
const { Op } = require('sequelize');

// Función para ajustar fechas
const ajustarFechas = (fechaInicio, fechaFin) => {
  const inicio = new Date(fechaInicio);
  inicio.setHours(0, 0, 0, 0);
  
  const fin = new Date(fechaFin);
  fin.setHours(23, 59, 59, 999);

  return { inicio, fin };
};

// ✅ FUNCIÓN CORREGIDA: Calcular precios de promoción
const calcularPreciosPromocion = (tipo, valor, examenesDetalles) => {
  let precioTotalIndividual = 0;
  let precioTotalPromocion = 0;
  let ahorroTotal = 0;

  if (!examenesDetalles || !Array.isArray(examenesDetalles)) {
    return { precioTotalIndividual, precioTotalPromocion, ahorroTotal };
  }

  // Calcular precio total individual
  precioTotalIndividual = examenesDetalles.reduce((total, detalle) => 
    total + parseFloat(detalle.precioIndividual || 0), 0
  );

  // Calcular según el tipo de promoción
  switch(tipo) {
    case 'porcentaje':
      const descuentoPorcentaje = parseFloat(valor) || 0;
      precioTotalPromocion = precioTotalIndividual * (1 - descuentoPorcentaje / 100);
      ahorroTotal = precioTotalIndividual - precioTotalPromocion;
      break;

    case 'monto':
      precioTotalPromocion = parseFloat(valor) || 0;
      ahorroTotal = precioTotalIndividual - precioTotalPromocion;
      break;

    case 'combo':
      precioTotalPromocion = parseFloat(valor) || 0;
      ahorroTotal = precioTotalIndividual - precioTotalPromocion;
      break;

    default:
      precioTotalPromocion = precioTotalIndividual;
      ahorroTotal = 0;
  }

  // Asegurar que no haya precios negativos
  if (precioTotalPromocion < 0) precioTotalPromocion = 0;
  if (ahorroTotal < 0) ahorroTotal = 0;

  return {
    precioTotalIndividual: parseFloat(precioTotalIndividual.toFixed(2)),
    precioTotalPromocion: parseFloat(precioTotalPromocion.toFixed(2)),
    ahorroTotal: parseFloat(ahorroTotal.toFixed(2))
  };
};

// ✅ FUNCIÓN CORREGIDA: Calcular precio por examen individual
const calcularPrecioExamen = (tipo, valor, examenDetalle, todosExamenesDetalles) => {
  const precioIndividual = parseFloat(examenDetalle.precioIndividual) || 0;
  let precioDescuento = precioIndividual;
  let ahorro = 0;

  if (!todosExamenesDetalles || !Array.isArray(todosExamenesDetalles)) {
    return { precioDescuento, ahorro };
  }

  const precioTotalIndividual = todosExamenesDetalles.reduce((total, det) => 
    total + parseFloat(det.precioIndividual || 0), 0
  );

  switch(tipo) {
    case 'porcentaje':
      const porcentaje = parseFloat(valor) || 0;
      precioDescuento = precioIndividual * (1 - porcentaje / 100);
      ahorro = precioIndividual - precioDescuento;
      break;

    case 'monto':
      const precioPromocionalTotal = parseFloat(valor) || 0;
      if (precioTotalIndividual > 0) {
        const proporcion = precioIndividual / precioTotalIndividual;
        precioDescuento = precioPromocionalTotal * proporcion;
      } else {
        precioDescuento = precioPromocionalTotal / todosExamenesDetalles.length;
      }
      ahorro = precioIndividual - precioDescuento;
      break;

    case 'combo':
      const precioComboTotal = parseFloat(valor) || 0;
      if (precioTotalIndividual > 0) {
        const proporcion = precioIndividual / precioTotalIndividual;
        precioDescuento = precioComboTotal * proporcion;
      } else {
        precioDescuento = precioComboTotal / todosExamenesDetalles.length;
      }
      ahorro = precioIndividual - precioDescuento;
      break;

    default:
      precioDescuento = precioIndividual;
      ahorro = 0;
  }

  // Asegurar que no haya precios negativos
  if (precioDescuento < 0) precioDescuento = 0;
  if (ahorro < 0) ahorro = 0;

  return {
    precioDescuento: parseFloat(precioDescuento.toFixed(2)),
    ahorro: parseFloat(ahorro.toFixed(2))
  };
};

// ✅ FUNCIÓN AUXILIAR CORREGIDA: Obtener promoción completa
const obtenerPromocionCompleta = async (id) => {
  return await db.Promocion.findByPk(id, {
    include: [
      { 
        model: db.Examen, 
        as: 'Examenes', 
        attributes: ['id', 'nombre', 'precio'] 
      },
      { 
        model: db.PromocionExamen, 
        as: 'DetallesExamenes',
        include: [
          {
            model: db.Examen,
            as: 'Examen',
            attributes: ['id', 'nombre', 'precio']
          },
          {
            model: db.Subexamen,
            as: 'Subexamen',
            attributes: ['id', 'nombre', 'precio']
          }
        ]
      },
      {
        model: db.Examen,
        as: 'ExamenPrincipal',
        attributes: ['id', 'nombre']
      }
    ]
  });
};

// ✅ CONTROLADOR CORREGIDO: Crear promoción
exports.crear = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const { examenesDetalles, ...datosPromocion } = req.body;

    console.log('🎯 CREANDO PROMOCIÓN OPTIMIZADA:', {
      tipo: datosPromocion.tipo,
      valor: datosPromocion.valor,
      examenes: examenesDetalles?.length || 0
    });

    // ✅ VALIDAR DATOS REQUERIDOS
    if (!examenesDetalles || !Array.isArray(examenesDetalles) || examenesDetalles.length === 0) {
      await t.rollback();
      return res.status(400).json({ 
        mensaje: 'Debe incluir al menos un examen en la promoción' 
      });
    }

    // ✅ CALCULAR PRECIOS TOTALES
    const { precioTotalIndividual, precioTotalPromocion, ahorroTotal } = 
      calcularPreciosPromocion(datosPromocion.tipo, datosPromocion.valor, examenesDetalles);

    // ✅ AJUSTAR FECHAS
    const { inicio: fechaInicio, fin: fechaFin } = ajustarFechas(
      datosPromocion.fechaInicio, 
      datosPromocion.fechaFin
    );

    // 1) CREAR PROMOCIÓN PRINCIPAL
    const promo = await db.Promocion.create({
      nombre: datosPromocion.nombre,
      descripcion: datosPromocion.descripcion,
      tipo: datosPromocion.tipo,
      valor: parseFloat(datosPromocion.valor) || 0,
      fechaInicio,
      fechaFin,
      examenPrincipalId: datosPromocion.examenPrincipalId || null,
      precioTotalIndividual,
      precioTotalPromocion,
      ahorroTotal,
      activa: true
    }, { transaction: t });

    console.log('✅ PROMOCIÓN CREADA - ID:', promo.id);

    // 2) CREAR DETALLES DE EXAMENES CON CÁLCULOS CORRECTOS
    const detallesParaCrear = examenesDetalles.map(detalle => {
      const precioIndividual = parseFloat(detalle.precioIndividual) || 0;
      
      const { precioDescuento, ahorro } = calcularPrecioExamen(
        datosPromocion.tipo,
        datosPromocion.valor,
        detalle,
        examenesDetalles
      );

      return {
        promocionId: promo.id,
        examenId: detalle.examenId,
        subexamenId: detalle.subexamenId || null,
        precioIndividual,
        precioDescuento,
        ahorro,
        descripcion: `${detalle.nombreExamen || 'Examen'} - Precio promocional`,
        esPrincipal: detalle.esPrincipal || false
      };
    });

    await db.PromocionExamen.bulkCreate(detallesParaCrear, { transaction: t });
    console.log(`✅ ${detallesParaCrear.length} detalles creados correctamente`);

    // 3) ASOCIAR EXAMENES (para mantener la relación N:M básica)
    const examenesIds = examenesDetalles.map(detalle => detalle.examenId).filter(id => id);
    if (examenesIds.length > 0) {
      await promo.setExamenes(examenesIds, { transaction: t });
      console.log(`✅ ${examenesIds.length} exámenes asociados`);
    }

    // ✅ COMMIT EXITOSO
    await t.commit();
    console.log('✅ TRANSACCIÓN COMMITEADA EXITOSAMENTE');

    // OBTENER PROMOCIÓN COMPLETA
    const promoCompleta = await obtenerPromocionCompleta(promo.id);
    
    console.log('🎉 PROMOCIÓN CREADA EXITOSAMENTE');
    res.status(201).json(promoCompleta);

  } catch (error) {
    // ✅ ROLLBACK EN CASO DE ERROR
    if (!t.finished) {
      await t.rollback();
      console.error('💥 Error - Transacción revertida:', error.message);
    }
    
    res.status(500).json({ 
      mensaje: 'Error al crear promoción', 
      detalle: error.message 
    });
  }
};

// ✅ CONTROLADOR CORREGIDO: Actualizar promoción
exports.actualizar = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const { id } = req.params;
    const { examenesDetalles, ...datosPromocion } = req.body;

    const promo = await db.Promocion.findByPk(id, { transaction: t });

    if (!promo) {
      await t.rollback();
      return res.status(404).json({ mensaje: 'Promoción no encontrada' });
    }

    // ✅ VALIDAR DATOS REQUERIDOS
    if (!examenesDetalles || !Array.isArray(examenesDetalles) || examenesDetalles.length === 0) {
      await t.rollback();
      return res.status(400).json({ 
        mensaje: 'Debe incluir al menos un examen en la promoción' 
      });
    }

    // ✅ CALCULAR NUEVOS PRECIOS
    const { precioTotalIndividual, precioTotalPromocion, ahorroTotal } = 
      calcularPreciosPromocion(datosPromocion.tipo, datosPromocion.valor, examenesDetalles);

    // ✅ AJUSTAR FECHAS
    const { inicio: fechaInicio, fin: fechaFin } = ajustarFechas(
      datosPromocion.fechaInicio, 
      datosPromocion.fechaFin
    );

    // 1) ACTUALIZAR PROMOCIÓN
    await promo.update({
      nombre: datosPromocion.nombre,
      descripcion: datosPromocion.descripcion,
      tipo: datosPromocion.tipo,
      valor: parseFloat(datosPromocion.valor) || 0,
      fechaInicio,
      fechaFin,
      examenPrincipalId: datosPromocion.examenPrincipalId || null,
      precioTotalIndividual,
      precioTotalPromocion,
      ahorroTotal
    }, { transaction: t });

    // 2) ELIMINAR DETALLES EXISTENTES Y CREAR NUEVOS
    await db.PromocionExamen.destroy({
      where: { promocionId: id },
      transaction: t
    });

    const detallesParaCrear = examenesDetalles.map(detalle => {
      const precioIndividual = parseFloat(detalle.precioIndividual) || 0;
      
      const { precioDescuento, ahorro } = calcularPrecioExamen(
        datosPromocion.tipo,
        datosPromocion.valor,
        detalle,
        examenesDetalles
      );

      return {
        promocionId: id,
        examenId: detalle.examenId,
        subexamenId: detalle.subexamenId || null,
        precioIndividual,
        precioDescuento,
        ahorro,
        descripcion: `${detalle.nombreExamen || 'Examen'} - Precio promocional`,
        esPrincipal: detalle.esPrincipal || false
      };
    });

    await db.PromocionExamen.bulkCreate(detallesParaCrear, { transaction: t });
    console.log(`✅ ${detallesParaCrear.length} detalles actualizados`);

    // 3) ACTUALIZAR ASOCIACIÓN DE EXAMENES
    const examenesIds = examenesDetalles.map(detalle => detalle.examenId).filter(id => id);
    if (examenesIds.length > 0) {
      await promo.setExamenes(examenesIds, { transaction: t });
    }

    await t.commit();

    // OBTENER PROMOCIÓN ACTUALIZADA
    const promoActualizada = await obtenerPromocionCompleta(id);
    res.json(promoActualizada);

  } catch (error) {
    await t.rollback();
    console.error('💥 Error al actualizar promoción:', error);
    res.status(500).json({ 
      mensaje: 'Error al actualizar promoción', 
      detalle: error.message 
    });
  }
};

// ✅ MANTENER LOS DEMÁS MÉTODOS SIN CAMBIOS (listar, obtenerPorId, eliminar, activas, etc.)
exports.listar = async (_req, res) => {
  try {
    const promos = await db.Promocion.findAll({
      include: [
        { 
          model: db.Examen, 
          as: 'Examenes', 
          attributes: ['id', 'nombre', 'precio'] 
        },
        { 
          model: db.PromocionExamen, 
          as: 'DetallesExamenes',
          include: [
            {
              model: db.Examen,
              as: 'Examen',
              attributes: ['id', 'nombre', 'precio']
            },
            {
              model: db.Subexamen,
              as: 'Subexamen',
              attributes: ['id', 'nombre', 'precio']
            }
          ]
        },
        {
          model: db.Examen,
          as: 'ExamenPrincipal',
          attributes: ['id', 'nombre']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    console.log(`📊 Listadas ${promos.length} promociones`);
    res.json(promos);

  } catch (error) {
    console.error('💥 Error al listar promociones:', error);
    res.status(500).json({ 
      mensaje: 'Error al listar promociones', 
      detalle: error.message 
    });
  }
};

exports.obtenerPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const promo = await obtenerPromocionCompleta(id);

    if (!promo) {
      return res.status(404).json({ mensaje: 'Promoción no encontrada' });
    }

    res.json(promo);

  } catch (error) {
    console.error('💥 Error al obtener promoción por ID:', error);
    res.status(500).json({ 
      mensaje: 'Error al obtener promoción', 
      detalle: error.message 
    });
  }
};

exports.eliminar = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const { id } = req.params;
    const promo = await db.Promocion.findByPk(id, { transaction: t });

    if (!promo) {
      await t.rollback();
      return res.status(404).json({ mensaje: 'Promoción no encontrada' });
    }

    await db.PromocionExamen.destroy({
      where: { promocionId: id },
      transaction: t
    });

    await promo.destroy({ transaction: t });
    await t.commit();

    res.json({ mensaje: 'Promoción eliminada correctamente' });

  } catch (error) {
    await t.rollback();
    console.error('💥 Error al eliminar promoción:', error);
    res.status(500).json({ 
      mensaje: 'Error al eliminar promoción', 
      detalle: error.message 
    });
  }
};

exports.activas = async (_req, res) => {
  try {
    const hoy = new Date();

    const promos = await db.Promocion.findAll({
      where: {
        activa: true,
        fechaInicio: { [Op.lte]: hoy },
        fechaFin: { [Op.gte]: hoy }
      },
      include: [
        { 
          model: db.Examen, 
          as: 'Examenes', 
          attributes: ['id', 'nombre', 'precio'] 
        },
        { 
          model: db.PromocionExamen, 
          as: 'DetallesExamenes',
          include: [
            {
              model: db.Examen,
              as: 'Examen',
              attributes: ['id', 'nombre', 'precio']
            },
            {
              model: db.Subexamen,
              as: 'Subexamen',
              attributes: ['id', 'nombre', 'precio']
            }
          ]
        },
        {
          model: db.Examen,
          as: 'ExamenPrincipal',
          attributes: ['id', 'nombre']
        }
      ]
    });

    console.log(`🟢 ${promos.length} promociones activas`);
    res.json(promos);

  } catch (error) {
    console.error('💥 Error al obtener promociones activas:', error);
    res.status(500).json({ 
      mensaje: 'Error al obtener promociones activas', 
      detalle: error.message 
    });
  }
};

exports.actualizarEstadoPromociones = async () => {
  try {
    const hoy = new Date();
    
    const resultado = await db.Promocion.update(
      { activa: false },
      {
        where: {
          fechaFin: { [Op.lt]: hoy },
          activa: true
        }
      }
    );

    if (resultado[0] > 0) {
      console.log(`🔄 ${resultado[0]} promociones desactivadas por fecha expirada`);
    }

    return resultado[0];
  } catch (error) {
    console.error('💥 Error al actualizar estado de promociones:', error);
    return 0;
  }
};