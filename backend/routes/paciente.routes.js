// routes/paciente.routes.js
const express = require('express');
const router = express.Router();
const pacienteController = require('../controllers/paciente.controller');
const verificarAuth = require('../middleware/auth');
const { Op, Sequelize } = require('sequelize');

router.use(verificarAuth);

// ============================
// RUTAS ESPECÍFICAS PRIMERO
// ============================
router.get('/buscar/buscar', pacienteController.buscarPacientes);
router.get('/buscar/filtros', pacienteController.buscarConFiltros);
router.get('/verificar/existencia', pacienteController.verificarExistencia);
router.get('/examenes-pendientes', pacienteController.getExamenesPendientes);

router.get('/dashboard/estadisticas', async (req, res) => {
  try {
    const db = require('../models');
    const { Paciente, ExamenPaciente, ExamenPacienteDetalle } = db;

    const hoy = new Date();
    const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const finHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);

    // ✅ Detectar alias real de ExamenPaciente -> Paciente
    const epAssociations = ExamenPaciente.associations || {};
    const aliasPacienteEnCabecera =
      Object.keys(epAssociations).find(k => epAssociations[k]?.target?.name === 'Paciente')
      || 'Paciente'; // fallback

    // 1) Total pacientes
    const totalPacientes = await Paciente.count();

    // 2) Nuevos hoy
    const nuevosHoy = await Paciente.count({
      where: { createdAt: { [Op.between]: [inicioHoy, finHoy] } }
    });

    // 3) Pendientes HOY (detalle pendiente + cabecera con fechaAsignacion hoy)
    const pendientesHoyDetalles = await ExamenPacienteDetalle.findAll({
      where: { estado: 'pendiente' },
      attributes: ['id', 'examenPacienteId', 'nombreExamen', 'estado', 'createdAt'],
      include: [
        {
          model: ExamenPaciente,
          as: 'Cabecera',           // ✅ este alias debe existir en ExamenPacienteDetalle.associate
          required: true,
          attributes: ['id', 'fechaAsignacion', 'pacienteId'],
          where: {
            fechaAsignacion: { [Op.between]: [inicioHoy, finHoy] }
          },
          include: [
            {
              model: Paciente,
              as: aliasPacienteEnCabecera, // ✅ AQUI ESTÁ LA CLAVE
              required: true,
              attributes: ['id', 'nombres', 'apellidos', 'cedula']
            }
          ]
        }
      ],
      order: [[Sequelize.col('Cabecera.fechaAsignacion'), 'DESC']]
    });

    const pendientesExamen = pendientesHoyDetalles.length;

    // 4) Completados hoy (por updatedAt del detalle)
    const completadosHoy = await ExamenPacienteDetalle.count({
      where: {
        estado: 'completado',
        updatedAt: { [Op.between]: [inicioHoy, finHoy] }
      }
    });

    // 5) Edad promedio
    const edades = await Paciente.findAll({ attributes: ['edad'] });
    const edadesArray = edades.map(p => Number(p.edad || 0));
    const edadPromedio = edadesArray.length
      ? (edadesArray.reduce((a, b) => a + b, 0) / edadesArray.length)
      : 0;

    return res.json({
      success: true,
      message: 'Dashboard cargado correctamente',
      data: {
        metricas: {
          totalPacientes: Number(totalPacientes || 0),
          nuevosHoy: Number(nuevosHoy || 0),
          pendientesExamen: Number(pendientesExamen || 0),
          edadPromedio: Number(edadPromedio.toFixed(1)),
          completadosHoy: Number(completadosHoy || 0),
          tasaCrecimiento: 0
        },
        pendientesHoy: pendientesHoyDetalles.map(d => ({
          detalleId: d.id,
          examenPacienteId: d.examenPacienteId,
          pacienteId: d.Cabecera?.pacienteId ?? null,
          nombreExamen: d.nombreExamen,
          estado: d.estado,
          fechaAsignacion: d.Cabecera?.fechaAsignacion ?? null,
          paciente: `${d.Cabecera?.[aliasPacienteEnCabecera]?.nombres || ''} ${d.Cabecera?.[aliasPacienteEnCabecera]?.apellidos || ''}`.trim(),
          cedula: d.Cabecera?.[aliasPacienteEnCabecera]?.cedula || ''
        }))
      }
    });
  } catch (error) {
    console.error('❌ Error dashboard:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ============================
// CRUD (/:id SIEMPRE AL FINAL)
// ============================
router.post('/', pacienteController.crearPaciente);
router.get('/', pacienteController.obtenerPacientes);
router.put('/:id', pacienteController.actualizarPaciente);
router.delete('/:id', pacienteController.eliminarPaciente);
router.get('/:id', pacienteController.obtenerPacientePorId);

router.get('/debug/asociaciones', pacienteController.debugAsociaciones);

router.get('/debug/asociaciones-examen-detalle', pacienteController.debugAsociacionesExamenDetalle);

module.exports = router;
