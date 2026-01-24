// controllers/dashboardAdmin.controller.js - VERSIÓN CORREGIDA
const { Op, Sequelize } = require("sequelize");
const db = require("../models");
const { QueryTypes } = require('sequelize');

// ✅ IMPORTAR MODELOS NECESARIOS
const ExamenPaciente = db.ExamenPaciente;
const Sucursal = db.Sucursal;
const Laboratorista = db.Laboratorista;
const Paciente = db.Paciente;
const ExamenPacienteDetalle = db.ExamenPacienteDetalle;
const Pago = db.Pago;
const sequelize = db.sequelize; // ✅ Asegurar que sequelize esté disponible

exports.getDashboardAdmin = async (req, res) => {
  try {
    return res.json({
      message: "Dashboard admin endpoint base - Usar endpoints específicos"
    });
  } catch (error) {
    console.error("❌ Error dashboard admin:", error);
    return res.status(500).json({ message: "Error al obtener el dashboard." });
  }
};

exports.getEstadisticasDashboard = async (req, res) => {
  try {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy);
    manana.setDate(manana.getDate() + 1);
    
    const sieteDiasAtras = new Date();
    sieteDiasAtras.setDate(sieteDiasAtras.getDate() - 7);
    
    const treintaDiasAtras = new Date();
    treintaDiasAtras.setDate(treintaDiasAtras.getDate() - 30);

    // ✅ 1. Tendencia de exámenes (últimos 7 días)
    const examsTrend = await ExamenPacienteDetalle.findAll({
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('createdAt')), 'fecha'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'cantidad']
      ],
      where: {
        createdAt: {
          [Op.gte]: sieteDiasAtras
        }
      },
      group: [Sequelize.fn('DATE', Sequelize.col('createdAt'))],
      order: [[Sequelize.fn('DATE', Sequelize.col('createdAt')), 'ASC']],
      raw: true
    });

    // ✅ 2. Top 5 exámenes más solicitados
    const topExams = await ExamenPacienteDetalle.findAll({
      attributes: [
        'nombreExamen',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'cantidad']
      ],
      where: {
        createdAt: {
          [Op.gte]: treintaDiasAtras
        }
      },
      group: ['nombreExamen'],
      order: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'DESC']],
      limit: 5,
      raw: true
    });

    // ✅ 3. DISTRIBUCIÓN POR SUCURSAL - Versión mejorada
    console.log("📊 Calculando distribución por sucursal...");
    
    // Obtener todas las sucursales
    const todasSucursales = await Sucursal.findAll({
      attributes: ['id', 'nombre'],
      raw: true
    });
    
    console.log(`🏢 Sucursales en sistema: ${todasSucursales.map(s => s.nombre).join(', ')}`);
    
    // Contar exámenes por sucursal directamente desde ExamenPacienteDetalle
    // En getEstadisticasDashboard, en la parte de distributionByBranch:
const distributionByBranch = await Promise.all(
  todasSucursales.map(async (sucursal) => {
    const cantidad = await ExamenPacienteDetalle.count({
      where: {
        sucursalId: sucursal.id, // ✅ Usar sucursalId directamente
        createdAt: {
          [Op.gte]: treintaDiasAtras
        }
      }
    });
    
    return {
      sucursal: sucursal.nombre,
      cantidad: cantidad || 0,
      sucursalId: sucursal.id
    };
  })
);
    
    // Ordenar por cantidad descendente
    distributionByBranch.sort((a, b) => b.cantidad - a.cantidad);
    
    console.log("📊 Distribución por sucursal:", distributionByBranch);

    // ✅ 4. Datos KPI del día
    const [
      pacientesNuevosHoy,
      examenesAsignadosHoy,
      pendientesHoy, 
      entregadosHoy, 
      totalCobradoHoy, 
      promocionesActivas,
      sucursalesActivasHoy
    ] = await Promise.all([
      // Pacientes nuevos hoy
      Paciente.count({
        where: {
          createdAt: {
            [Op.gte]: hoy,
            [Op.lt]: manana,
          },
        },
      }),
      // Exámenes asignados hoy (detalles de exámenes)
      ExamenPacienteDetalle.count({
        where: {
          createdAt: {
            [Op.gte]: hoy,
            [Op.lt]: manana,
          },
        },
      }),
      // Pendientes hoy
      ExamenPacienteDetalle.count({
        where: {
          estado: "pendiente",
          createdAt: {
            [Op.gte]: hoy,
            [Op.lt]: manana,
          },
        },
      }),
      // Entregados hoy
      ExamenPacienteDetalle.count({
        where: {
          estado: "completado",
          createdAt: {
            [Op.gte]: hoy,
            [Op.lt]: manana,
          },
        },
      }),
      // Total cobrado hoy
      Pago.sum("monto", {
        where: {
          estado: 'completado',
          createdAt: {
            [Op.gte]: hoy,
            [Op.lt]: manana,
          },
        },
      }),
      // Promociones activas
      db.Promocion.count({
        where: {
          activa: true,
          fechaInicio: { [Op.lte]: hoy },
          fechaFin: { [Op.gte]: hoy }
        }
      }),
      // Sucursales con actividad hoy
      ExamenPacienteDetalle.count({
        distinct: true,
        col: 'sucursalId',
        where: {
          createdAt: {
            [Op.gte]: hoy,
            [Op.lt]: manana,
          },
        },
      })
    ]);

    // ✅ 5. Pendientes recientes
    const pendientes = await ExamenPacienteDetalle.findAll({
      where: { estado: "pendiente" },
      include: [
        {
          model: ExamenPaciente,
          as: "Cabecera",
          include: [
            { 
              model: Paciente, 
              as: "Paciente", 
              attributes: ["id", "nombres", "apellidos"] 
            },
          ],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: 10,
    });

    const pendientesFormateados = pendientes.map((d) => {
      const paciente = d?.Cabecera?.Paciente
        ? `${d.Cabecera.Paciente.nombres} ${d.Cabecera.Paciente.apellidos}`
        : "Paciente";

      const hora = d.createdAt
        ? new Date(d.createdAt).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })
        : "--:--";

      return {
        paciente,
        examen: d.nombreExamen || "Examen",
        hora,
        estado: (d.estado || "pendiente").toUpperCase(),
        idPaciente: d?.Cabecera?.Paciente?.id || null,
      };
    });

    return res.json({
      success: true,
      stats: {
        pacientesHoy: pacientesNuevosHoy,
        examenesAsignadosHoy: examenesAsignadosHoy,
        sucursalesActivasHoy: sucursalesActivasHoy,
        pendientesHoy: pendientesHoy,
        entregadosHoy: entregadosHoy,
        totalCobradoHoy: Number(totalCobradoHoy || 0),
        promocionesActivas: promocionesActivas,
      },
      charts: {
        examsTrend: {
          labels: examsTrend.map(item => {
            const fecha = new Date(item.fecha);
            return fecha.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
          }),
          values: examsTrend.map(item => parseInt(item.cantidad || 0))
        },
        topExams: {
          labels: topExams.map(item => item.nombreExamen),
          values: topExams.map(item => parseInt(item.cantidad || 0))
        },
        patientsByBranch: {
          labels: distributionByBranch.map(item => item.sucursal || 'Sin sucursal'),
          values: distributionByBranch.map(item => item.cantidad),
          sucursales: distributionByBranch.map(item => ({ 
            id: item.sucursalId, 
            nombre: item.sucursal 
          }))
        }
      },
      pendientes: pendientesFormateados
    });

  } catch (error) {
    console.error("❌ Error en estadísticas dashboard:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Error al obtener estadísticas del dashboard.",
      error: error.message 
    });
  }
};

// ✅ Análisis Predictivo
exports.getAnalisisPredictivo = async (req, res) => {
  try {
    const hoy = new Date();
    
    // 1. Próxima demanda
    const unaSemanaAtras = new Date();
    unaSemanaAtras.setDate(unaSemanaAtras.getDate() - 7);
    
    const dosSemanasAtras = new Date();
    dosSemanasAtras.setDate(dosSemanasAtras.getDate() - 14);
    
    const examenesEstaSemana = await ExamenPacienteDetalle.count({
      where: {
        createdAt: {
          [Op.gte]: unaSemanaAtras,
          [Op.lte]: hoy
        }
      }
    });
    
    const examenesSemanaPasada = await ExamenPacienteDetalle.count({
      where: {
        createdAt: {
          [Op.gte]: dosSemanasAtras,
          [Op.lt]: unaSemanaAtras
        }
      }
    });
    
    let cambioPorcentaje = 0;
    if (examenesSemanaPasada > 0) {
      cambioPorcentaje = ((examenesEstaSemana - examenesSemanaPasada) / examenesSemanaPasada) * 100;
    }
    
    // 2. Pico de horario
    const picoHorario = await ExamenPacienteDetalle.findAll({
      attributes: [
        [Sequelize.fn('EXTRACT', Sequelize.literal('HOUR FROM "createdAt"')), 'hora'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'cantidad']
      ],
      where: {
        createdAt: {
          [Op.gte]: unaSemanaAtras
        }
      },
      group: [Sequelize.fn('EXTRACT', Sequelize.literal('HOUR FROM "createdAt"'))],
      order: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'DESC']],
      limit: 1,
      raw: true
    });
    
    let horaPico = "9:00 - 11:00 AM";
    if (picoHorario.length > 0) {
      const hora = parseInt(picoHorario[0].hora);
      horaPico = `${hora}:00 - ${hora + 2}:00`;
    }
    
    // 3. Examen en tendencia
    const examenTendencia = await ExamenPacienteDetalle.findAll({
      attributes: [
        'nombreExamen',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'cantidad']
      ],
      where: {
        createdAt: {
          [Op.gte]: unaSemanaAtras
        }
      },
      group: ['nombreExamen'],
      order: [[Sequelize.fn('COUNT', Sequelize.col('id')), 'DESC']],
      limit: 1,
      raw: true
    });
    
    let examenPopular = "Hemograma Completo";
    let porcentajeAumento = "22%";
    if (examenTendencia.length > 0) {
      examenPopular = examenTendencia[0].nombreExamen;
      
      const examenEstaSemana = await ExamenPacienteDetalle.count({
        where: {
          nombreExamen: examenPopular,
          createdAt: {
            [Op.gte]: unaSemanaAtras,
            [Op.lte]: hoy
          }
        }
      });
      
      const examenSemanaPasada = await ExamenPacienteDetalle.count({
        where: {
          nombreExamen: examenPopular,
          createdAt: {
            [Op.gte]: dosSemanasAtras,
            [Op.lt]: unaSemanaAtras
          }
        }
      });
      
      if (examenSemanaPasada > 0) {
        const crecimiento = ((examenEstaSemana - examenSemanaPasada) / examenSemanaPasada) * 100;
        porcentajeAumento = `${Math.round(crecimiento)}%`;
      }
    }
    
    res.json({
      success: true,
      proximaDemanda: {
        porcentaje: Math.round(cambioPorcentaje),
        descripcion: cambioPorcentaje > 0 ? 
          `Se espera aumento para la próxima semana (+${Math.round(cambioPorcentaje)}%)` : 
          cambioPorcentaje < 0 ?
          `Se espera disminución para la próxima semana (${Math.round(cambioPorcentaje)}%)` :
          `Se espera estabilidad para la próxima semana`
      },
      picoHorario: {
        horario: horaPico,
        descripcion: `Mayor afluencia de pacientes`
      },
      examenTendencia: {
        nombre: examenPopular,
        porcentaje: porcentajeAumento,
        descripcion: porcentajeAumento.includes('-') ? 
          `Disminución de ${porcentajeAumento.replace('-', '')} en solicitudes` :
          `Aumento de ${porcentajeAumento} en solicitudes`
      }
    });
    
  } catch (error) {
    console.error("❌ Error en análisis predictivo:", error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// ✅ Tendencia de exámenes con filtros
// ✅ Tendencia de exámenes con filtros - VERSIÓN CORREGIDA
exports.getExamsTrend = async (req, res) => {
  try {
    const { dateFrom, dateTo, branchId } = req.query;
    
    const whereConditions = {};
    
    if (dateFrom && dateTo) {
      const startDate = new Date(dateFrom);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      
      whereConditions['$ExamenPacienteDetalle.createdAt$'] = { // ✅ Usar nombre completo
        [Op.between]: [startDate, endDate]
      };
    } else {
      const sieteDiasAtras = new Date();
      sieteDiasAtras.setDate(sieteDiasAtras.getDate() - 7);
      whereConditions['$ExamenPacienteDetalle.createdAt$'] = { // ✅ Usar nombre completo
        [Op.gte]: sieteDiasAtras
      };
    }
    
    const queryOptions = {
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('ExamenPacienteDetalle.createdAt')), 'fecha'], // ✅ Especificar tabla
        [Sequelize.fn('COUNT', Sequelize.col('ExamenPacienteDetalle.id')), 'cantidad'] // ✅ Especificar tabla
      ],
      where: whereConditions,
      group: [Sequelize.fn('DATE', Sequelize.col('ExamenPacienteDetalle.createdAt'))], // ✅ Especificar tabla
      order: [[Sequelize.fn('DATE', Sequelize.col('ExamenPacienteDetalle.createdAt')), 'ASC']], // ✅ Especificar tabla
      raw: true
    };
    
    // Filtrar por sucursal si se especifica
    if (branchId && branchId !== '0' && branchId !== 'all') {
      queryOptions.include = [{
        model: Sucursal,
        as: 'Sucursal',
        where: { id: branchId },
        attributes: [],
        required: true
      }];
    }
    
    const examsTrend = await ExamenPacienteDetalle.findAll(queryOptions);
    
    res.json({
      success: true,
      labels: examsTrend.map(item => {
        const fecha = new Date(item.fecha);
        return fecha.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
      }),
      values: examsTrend.map(item => parseInt(item.cantidad || 0))
    });
    
  } catch (error) {
    console.error("❌ Error en getExamsTrend:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ Top exámenes con filtros
// ✅ Top exámenes con filtros - VERSIÓN CORREGIDA
exports.getTopExams = async (req, res) => {
  try {
    const { limit = 5, branchId, days = 30 } = req.query;
    const limitNum = parseInt(limit);
    const dias = parseInt(days);
    
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - dias);
    
    const whereConditions = {
      createdAt: {
        [Op.gte]: fechaInicio
      }
    };
    
    const queryOptions = {
      attributes: [
        'nombreExamen',
        [Sequelize.fn('COUNT', Sequelize.col('ExamenPacienteDetalle.id')), 'cantidad'] // ✅ Especificar tabla
      ],
      where: whereConditions,
      group: ['nombreExamen'],
      order: [[Sequelize.fn('COUNT', Sequelize.col('ExamenPacienteDetalle.id')), 'DESC']], // ✅ Especificar tabla
      limit: limitNum,
      raw: true
    };
    
    // Filtrar por sucursal si se especifica
    if (branchId && branchId !== '0' && branchId !== 'all') {
      queryOptions.include = [{
        model: Sucursal,
        as: 'Sucursal',
        where: { id: branchId },
        attributes: []
      }];
      
      // ✅ Ajustar el COUNT para evitar ambigüedad cuando hay JOIN
      queryOptions.attributes[1] = [Sequelize.fn('COUNT', Sequelize.col('ExamenPacienteDetalle.id')), 'cantidad'];
    }
    
    const topExams = await ExamenPacienteDetalle.findAll(queryOptions);
    
    res.json({
      success: true,
      labels: topExams.map(item => item.nombreExamen || 'Sin nombre'),
      values: topExams.map(item => parseInt(item.cantidad || 0))
    });
    
  } catch (error) {
    console.error("❌ Error en getTopExams:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ DISTRIBUCIÓN DE PACIENTES POR SUCURSAL - VERSIÓN CORREGIDA
// ✅ DISTRIBUCIÓN DE PACIENTES POR SUCURSAL - VERSIÓN CORREGIDA DEFINITIVA
exports.getPatientsByBranch = async (req, res) => {
  try {
    const { dateFrom, dateTo, branchId } = req.query;
    console.log('📊 getPatientsByBranch - Parámetros:', { dateFrom, dateTo, branchId });
    
    // Construir condiciones WHERE
    const whereConditions = {};
    
    // Filtro por fecha
    if (dateFrom && dateTo) {
      const startDate = new Date(dateFrom);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      
      whereConditions.createdAt = {
        [Op.between]: [startDate, endDate]
      };
    }
    
    // Primero obtener todas las sucursales
    const sucursales = await Sucursal.findAll({
      attributes: ['id', 'nombre'],
      raw: true
    });
    
    let resultados = [];
    
    // Si hay filtro de sucursal específica
    if (branchId && branchId !== 'all' && branchId !== '0') {
      const sucursal = sucursales.find(s => s.id == branchId);
      if (sucursal) {
        const cantidad = await ExamenPacienteDetalle.count({
          where: {
            sucursalId: sucursal.id,
            ...whereConditions
          }
        });
        
        resultados = [{
          sucursal: sucursal.nombre,
          total: cantidad,
          sucursalId: sucursal.id
        }];
      }
    } else {
      // Para todas las sucursales
      resultados = await Promise.all(
        sucursales.map(async (sucursal) => {
          const cantidad = await ExamenPacienteDetalle.count({
            where: {
              sucursalId: sucursal.id,
              ...whereConditions
            }
          });
          
          return {
            sucursal: sucursal.nombre,
            total: cantidad,
            sucursalId: sucursal.id
          };
        })
      );
      
      // Ordenar por total descendente
      resultados.sort((a, b) => b.total - a.total);
    }
    
    console.log('📊 Resultados getPatientsByBranch:', resultados);
    
    return res.json({
      success: true,
      data: resultados,
      message: 'Distribución de exámenes por sucursal obtenida correctamente'
    });
    
  } catch (error) {
    console.error('❌ Error en getPatientsByBranch:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener distribución por sucursal',
      error: error.message
    });
  }
};

// ✅ Heatmap de carga de trabajo
exports.getWorkloadHeatmap = async (req, res) => {
  try {
    const { branchId } = req.query;
    
    const ultimaSemana = new Date();
    ultimaSemana.setDate(ultimaSemana.getDate() - 7);
    
    const whereConditions = {
      createdAt: {
        [Op.gte]: ultimaSemana
      }
    };
    
    // Filtrar por sucursal
    if (branchId && branchId !== '0' && branchId !== 'all') {
      whereConditions.sucursalId = branchId;
    }
    
    // Obtener exámenes por día y hora
    const workloadData = await ExamenPacienteDetalle.findAll({
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('createdAt')), 'fecha'],
        [Sequelize.fn('EXTRACT', Sequelize.literal('HOUR FROM "createdAt"')), 'hora'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'cantidad']
      ],
      where: whereConditions,
      group: [
        Sequelize.fn('DATE', Sequelize.col('createdAt')),
        Sequelize.fn('EXTRACT', Sequelize.literal('HOUR FROM "createdAt"'))
      ],
      order: [
        [Sequelize.fn('DATE', Sequelize.col('createdAt')), 'ASC'],
        [Sequelize.fn('EXTRACT', Sequelize.literal('HOUR FROM "createdAt"')), 'ASC']
      ],
      raw: true
    });
    
    // Formatear datos para heatmap
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const horas = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM a 7 PM
    
    const heatmapData = horas.map(hora => {
      const horaData = { hora: `${hora}:00` };
      
      dias.forEach((dia, diaIndex) => {
        const dataPoint = workloadData.find(item => {
          const fecha = new Date(item.fecha);
          return fecha.getDay() === diaIndex && parseInt(item.hora) === hora;
        });
        
        horaData[dia] = dataPoint ? parseInt(dataPoint.cantidad) : 0;
      });
      
      return horaData;
    });
    
    res.json({
      success: true,
      dias,
      horas: horas.map(h => `${h}:00`),
      data: heatmapData
    });
    
  } catch (error) {
    console.error("❌ Error en getWorkloadHeatmap:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ Tendencia de ingresos
exports.getRevenueTrend = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const dias = parseInt(days);
    
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - dias);
    fechaInicio.setHours(0, 0, 0, 0);
    
    const revenueTrend = await Pago.findAll({
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('createdAt')), 'fecha'],
        [Sequelize.fn('SUM', Sequelize.col('monto')), 'total']
      ],
      where: {
        estado: 'completado',
        createdAt: {
          [Op.gte]: fechaInicio
        }
      },
      group: [Sequelize.fn('DATE', Sequelize.col('createdAt'))],
      order: [[Sequelize.fn('DATE', Sequelize.col('createdAt')), 'ASC']],
      raw: true
    });
    
    if (revenueTrend.length === 0) {
      const labels = [];
      const values = [];
      
      for (let i = dias - 1; i >= 0; i--) {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() - i);
        labels.push(fecha.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' }));
        values.push(0);
      }
      
      return res.json({
        success: true,
        labels,
        values
      });
    }
    
    res.json({
      success: true,
      labels: revenueTrend.map(item => {
        const fecha = new Date(item.fecha);
        return fecha.toLocaleDateString('es-EC', { day: '2-digit', month: 'short' });
      }),
      values: revenueTrend.map(item => parseFloat(item.total || 0))
    });
    
  } catch (error) {
    console.error("❌ Error en getRevenueTrend:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ Datos demográficos
exports.getDemographics = async (req, res) => {
  try {
    // Distribución por género
    const genderDistribution = await Paciente.findAll({
      attributes: [
        'sexo',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'cantidad']
      ],
      group: ['sexo'],
      raw: true
    });
    
    // Distribución por grupos de edad
    const ageDistribution = await Paciente.findAll({
      attributes: [
        [Sequelize.literal(`
          CASE 
            WHEN fecha_nacimiento IS NULL THEN 'Sin fecha'
            WHEN EXTRACT(YEAR FROM AGE(fecha_nacimiento)) < 18 THEN '0-17'
            WHEN EXTRACT(YEAR FROM AGE(fecha_nacimiento)) BETWEEN 18 AND 30 THEN '18-30'
            WHEN EXTRACT(YEAR FROM AGE(fecha_nacimiento)) BETWEEN 31 AND 50 THEN '31-50'
            WHEN EXTRACT(YEAR FROM AGE(fecha_nacimiento)) BETWEEN 51 AND 65 THEN '51-65'
            ELSE '65+'
          END
        `), 'grupo_edad'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'cantidad']
      ],
      group: [Sequelize.literal(`
        CASE 
          WHEN fecha_nacimiento IS NULL THEN 'Sin fecha'
          WHEN EXTRACT(YEAR FROM AGE(fecha_nacimiento)) < 18 THEN '0-17'
          WHEN EXTRACT(YEAR FROM AGE(fecha_nacimiento)) BETWEEN 18 AND 30 THEN '18-30'
          WHEN EXTRACT(YEAR FROM AGE(fecha_nacimiento)) BETWEEN 31 AND 50 THEN '31-50'
          WHEN EXTRACT(YEAR FROM AGE(fecha_nacimiento)) BETWEEN 51 AND 65 THEN '51-65'
          ELSE '65+'
        END
      `)],
      order: [[Sequelize.literal('grupo_edad'), 'ASC']],
      raw: true
    });
    
    res.json({
      success: true,
      gender: genderDistribution.map(item => ({
        label: item.sexo || 'No especificado',
        value: parseInt(item.cantidad || 0)
      })),
      age: ageDistribution.map(item => ({
        label: item.grupo_edad,
        value: parseInt(item.cantidad || 0)
      }))
    });
    
  } catch (error) {
    console.error("❌ Error en getDemographics:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ INGRESOS POR SUCURSAL - VERSIÓN CORREGIDA
exports.getIngresosPorSucursal = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    // Usar consulta SQL corregida
    const resultados = await sequelize.query(`
      SELECT
        COALESCE(s.nombre, 'Sin sucursal') AS sucursal,
        COALESCE(SUM(p.monto), 0) AS total
      FROM "Pagos" p
      LEFT JOIN "ExamenPacientes" ep ON ep."pacienteId" = p."pacienteId"
      LEFT JOIN "Sucursales" s ON s.id = ep."sucursalId"
      WHERE p."createdAt" BETWEEN :dateFrom AND :dateTo
        AND (p.estado ILIKE 'completado' OR p.estado ILIKE 'pagado' OR p.estado ILIKE 'aprobado')
        AND p.monto > 0
      GROUP BY s.id, s.nombre
      ORDER BY total DESC;
    `, {
      replacements: { 
        dateFrom: dateFrom || '2026-01-01', 
        dateTo: dateTo || new Date().toISOString().split('T')[0] 
      },
      type: QueryTypes.SELECT
    });
    
    // Si no hay resultados, retornar sucursales con 0
    if (resultados.length === 0) {
      const sucursales = await Sucursal.findAll({
        attributes: ['id', 'nombre'],
        raw: true
      });
      
      const data = sucursales.map(s => ({
        sucursal: s.nombre,
        total: 0,
        sucursalId: s.id
      }));
      
      return res.json({
        success: true,
        data
      });
    }
    
    return res.json({ 
      success: true, 
      data: resultados 
    });
    
  } catch (error) {
    console.error('❌ Error getIngresosPorSucursal:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al calcular ingresos por sucursal',
      error: error.message 
    });
  }
};

// ✅ Estado del proceso
// ✅ Estado del proceso - VERSIÓN CORREGIDA
exports.getProcessStatus = async (req, res) => {
  try {
    const { days = 30, branchId = 0 } = req.query;
    const dias = parseInt(days);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dias);
    startDate.setHours(0,0,0,0);

    const whereConditions = {
      createdAt: { [Op.gte]: startDate }
    };

    // Filtrar por sucursal si se especifica
    if (branchId && branchId !== '0' && branchId !== 'all') {
      whereConditions.sucursalId = branchId; // ✅ Usar sucursalId directamente
    }

    const rows = await ExamenPacienteDetalle.findAll({
      attributes: [
        'estado',
        [Sequelize.fn('COUNT', Sequelize.col('ExamenPacienteDetalle.id')), 'cantidad'] // ✅ Especificar tabla
      ],
      where: whereConditions,
      group: ['estado'],
      raw: true
    });

    // Normaliza estados
    const estados = ['pendiente', 'procesando', 'completado', 'cancelado'];
    const mapa = Object.fromEntries(estados.map(e => [e, 0]));
    rows.forEach(r => { 
      const estado = (r.estado || '').toLowerCase();
      if (mapa.hasOwnProperty(estado)) {
        mapa[estado] = parseInt(r.cantidad || 0);
      }
    });

    res.json({
      success: true,
      labels: estados.map(e => e.toUpperCase()),
      values: estados.map(e => mapa[e] || 0)
    });

  } catch (error) {
    console.error("❌ Error getProcessStatus:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ Tiempo de procesamiento
exports.getTurnaroundTime = async (req, res) => {
  try {
    const { days = 30, branchId = 0 } = req.query;
    const dias = parseInt(days);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - dias);
    startDate.setHours(0,0,0,0);

    const whereConditions = {
      createdAt: { [Op.gte]: startDate },
      estado: 'completado'
    };

    // Filtrar por sucursal si se especifica
    if (branchId && branchId !== '0' && branchId !== 'all') {
      whereConditions.sucursalId = branchId;
    }

    const row = await ExamenPacienteDetalle.findAll({
      attributes: [
        [Sequelize.literal(`AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")))`), 'avg_seconds'],
        [Sequelize.literal(`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")))`), 'p95_seconds'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'total']
      ],
      where: whereConditions,
      raw: true
    });

    const data = row?.[0] || {};
    const avgSec = Number(data.avg_seconds || 0);
    const p95Sec = Number(data.p95_seconds || 0);

    res.json({
      success: true,
      total: parseInt(data.total || 0),
      avgMinutes: +(avgSec / 60).toFixed(1),
      p95Minutes: +(p95Sec / 60).toFixed(1)
    });

  } catch (error) {
    console.error("❌ Error getTurnaroundTime:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ✅ Función para debug de sucursales
exports.checkExamenPacienteData = async (req, res) => {
  try {
    const totalExamenes = await ExamenPaciente.count();
    const conSucursal = await ExamenPaciente.count({
      where: { sucursalId: { [Op.not]: null } }
    });
    
    const muestras = await ExamenPaciente.findAll({
      attributes: ['id', 'sucursalId', 'laboratoristaId', 'createdAt'],
      include: [
        {
          model: Sucursal,
          as: 'Sucursal',
          attributes: ['id', 'nombre']
        },
        {
          model: Laboratorista,
          as: 'Laboratorista',
          attributes: ['id', 'nombres', 'apellidos', 'sucursalId'],
          include: [{
            model: Sucursal,
            as: 'Sucursal',
            attributes: ['id', 'nombre']
          }]
        }
      ],
      limit: 10
    });
    
    res.json({
      success: true,
      totalExamenes,
      conSucursal,
      sinSucursal: totalExamenes - conSucursal,
      muestras: muestras.map(m => ({
        id: m.id,
        sucursalId: m.sucursalId,
        sucursalDirecta: m.Sucursal?.nombre,
        laboratoristaId: m.laboratoristaId,
        laboratorista: m.Laboratorista ? `${m.Laboratorista.nombres} ${m.Laboratorista.apellidos}` : null,
        sucursalLaboratorista: m.Laboratorista?.Sucursal?.nombre,
        createdAt: m.createdAt
      }))
    });
    
  } catch (error) {
    console.error("❌ Error en checkExamenPacienteData:", error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// ✅ Debug de laboratoristas
exports.checkLaboratoristasData = async (req, res) => {
  try {
    const laboratoristas = await Laboratorista.findAll({
      attributes: ['id', 'nombres', 'apellidos', 'sucursalId'],
      include: [{
        model: Sucursal,
        as: 'Sucursal',
        attributes: ['id', 'nombre']
      }]
    });
    
    const examenesConLaboratorista = await ExamenPaciente.findAll({
      attributes: ['id', 'laboratoristaId', 'sucursalId', 'createdAt'],
      include: [
        {
          model: Laboratorista,
          as: 'Laboratorista',
          attributes: ['id', 'nombres', 'apellidos', 'sucursalId'],
          include: [{
            model: Sucursal,
            as: 'Sucursal',
            attributes: ['id', 'nombre']
          }]
        },
        {
          model: Sucursal,
          as: 'Sucursal',
          attributes: ['id', 'nombre']
        }
      ],
      limit: 20
    });
    
    const examenesFormateados = examenesConLaboratorista.map(ep => ({
      id: ep.id,
      laboratoristaId: ep.laboratoristaId,
      laboratorista: ep.Laboratorista ? {
        id: ep.Laboratorista.id,
        nombre: `${ep.Laboratorista.nombres} ${ep.Laboratorista.apellidos}`,
        sucursalId: ep.Laboratorista.sucursalId,
        sucursal: ep.Laboratorista.Sucursal?.nombre
      } : null,
      sucursalId: ep.sucursalId,
      sucursalDirecta: ep.Sucursal?.nombre,
      createdAt: ep.createdAt
    }));
    
    res.json({
      success: true,
      laboratoristas: laboratoristas.map(l => ({
        id: l.id,
        nombre: `${l.nombres} ${l.apellidos}`,
        sucursalId: l.sucursalId,
        sucursal: l.Sucursal?.nombre
      })),
      examenesConLaboratorista: examenesFormateados,
      totalLaboratoristas: laboratoristas.length,
      totalExamenes: examenesConLaboratorista.length
    });
    
  } catch (error) {
    console.error("❌ Error en checkLaboratoristasData:", error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// ✅ Debug completo
exports.debugSucursales = async (req, res) => {
  try {
    console.log("🔍 DEBUG: Verificando datos de sucursales y exámenes");
    
    const sucursales = await Sucursal.findAll({
      attributes: ['id', 'nombre']
    });
    
    console.log("📌 Sucursales en el sistema:", sucursales.map(s => s.nombre));
    
    const laboratoristas = await Laboratorista.findAll({
      attributes: ['id', 'nombres', 'apellidos', 'sucursalId'],
      include: [{
        model: Sucursal,
        as: 'Sucursal',
        attributes: ['id', 'nombre']
      }]
    });
    
    console.log("👨‍🔬 Laboratoristas y sus sucursales:");
    laboratoristas.forEach(lab => {
      console.log(`  - ${lab.nombres} ${lab.apellidos}: ${lab.Sucursal?.nombre || 'Sin sucursal'}`);
    });
    
    // Contar exámenes por sucursal desde ExamenPacienteDetalle
    const examenesPorSucursal = await ExamenPacienteDetalle.findAll({
      attributes: [
        'sucursalId',
        [Sequelize.col('Sucursal.nombre'), 'sucursal_nombre'],
        [Sequelize.fn('COUNT', Sequelize.col('ExamenPacienteDetalle.id')), 'cantidad']
      ],
      include: [{
        model: Sucursal,
        as: 'Sucursal',
        attributes: []
      }],
      group: ['sucursalId', 'Sucursal.id'],
      raw: true
    });
    
    console.log("📊 Exámenes por sucursal:");
    examenesPorSucursal.forEach(item => {
      console.log(`  - ${item.sucursal_nombre}: ${item.cantidad} exámenes`);
    });
    
    res.json({
      success: true,
      sucursales: sucursales.map(s => ({ id: s.id, nombre: s.nombre })),
      laboratoristas: laboratoristas.map(lab => ({
        id: lab.id,
        nombre: `${lab.nombres} ${lab.apellidos}`,
        sucursal: lab.Sucursal?.nombre || 'Sin sucursal'
      })),
      examenesPorSucursal
    });
    
  } catch (error) {
    console.error("❌ Error en debugSucursales:", error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};