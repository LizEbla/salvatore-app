const express = require('express');
const router = express.Router();
const laboratoristasController = require('../controllers/laboratoristas.controller');

// =======================
// 🏥 RUTAS DE SUCURSALES
// =======================
router.get('/sucursales/listar', laboratoristasController.obtenerSucursales);
router.get('/sucursales/estadisticas', laboratoristasController.obtenerSucursalesConEstadisticas);
router.post('/sucursales/crear', laboratoristasController.crearSucursal);
router.put('/sucursales/:id/actualizar', laboratoristasController.actualizarSucursal);
router.delete('/sucursales/:id/eliminar', laboratoristasController.eliminarSucursal);

// =======================
// 👨‍🔬 RUTAS DE LABORATORISTAS
// =======================
router.get('/laboratoristas/listar', laboratoristasController.obtenerLaboratoristas);
router.get('/sucursales/:sucursalId/laboratoristas', laboratoristasController.obtenerLaboratoristasPorSucursal);
router.get('/laboratoristas/:id', laboratoristasController.obtenerLaboratoristaPorId);
router.post('/laboratoristas/crear', laboratoristasController.crearLaboratorista);
router.put('/laboratoristas/:id/actualizar', laboratoristasController.actualizarLaboratorista);

// =======================
// 📝 RUTAS DE ASIGNACIÓN
// =======================
router.post('/detalle-examen/:detalleId/asignar-laboratorista', laboratoristasController.asignarLaboratorista);
router.get('/detalle-examen/:detalleId/informacion-registro', laboratoristasController.obtenerInformacionRegistro);
router.get('/paciente/:id/detalles-con-laboratorista', laboratoristasController.obtenerDetallesConLaboratoristaPorPaciente);

// =======================
// 📊 RUTAS DE ESTADÍSTICAS
// =======================
router.get('/laboratoristas/estadisticas', laboratoristasController.obtenerEstadisticasLaboratoristas);

// =======================
// 🔧 RUTAS DE MIGRACIÓN
// =======================
router.get('/diagnostico/sucursales', laboratoristasController.diagnosticarSucursales);
router.post('/migrar/laboratoristas-sucursales', laboratoristasController.migrarLaboratoristasASucursales);

module.exports = router;