// routes/pacientes.js - SOLO RUTAS DE PACIENTES, NO EXÁMENES
const express = require('express');
const router = express.Router();
const pacienteController = require('../controllers/paciente.controller'); // 👈 CAMBIAR A .controller
const verificarAuth = require('../middleware/auth');

// 🔐 PROTEGER TODAS LAS RUTAS
router.use(verificarAuth);

// CRUD BÁSICO DE PACIENTES
router.post('/', pacienteController.crearPaciente);
router.get('/', pacienteController.obtenerPacientes);
router.get('/:id', pacienteController.obtenerPacientePorId);
router.put('/:id', pacienteController.actualizarPaciente);
router.delete('/:id', pacienteController.eliminarPaciente);

// BÚSQUEDAS DE PACIENTES
router.get('/buscar/buscar', pacienteController.buscarPacientes);
router.get('/buscar/filtros', pacienteController.buscarConFiltros);
router.get('/verificar/existencia', pacienteController.verificarExistencia);

// DIAGNÓSTICOS
router.get('/diagnostico/fechas', pacienteController.diagnosticoFechas);
router.get('/debug/fecha', pacienteController.debugPacientesPorFecha);
router.get('/debug/datos', pacienteController.debugDatosRecibidos);

// DEBUG
router.get('/debug/auth', pacienteController.debugUserInfo);


// ============================================
// ✅ RUTA DE HEALTH CHECK
// ============================================

router.get('/health/check', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Módulo de pacientes funcionando correctamente',
    timestamp: new Date().toISOString(),
    rutas: {
      crud: [
        'GET /',
        'POST /',
        'GET /:id', 
        'PUT /:id',
        'DELETE /:id'
      ],
      busquedas: [
        'GET /buscar/cedula-nombre',
        'GET /buscar/filtros',
        'GET /verificar-existencia'
      ],
      diagnosticos: [
        'GET /diagnostico/fechas',
        'GET /debug/fecha',
        'GET /debug/datos'
      ]
    }
  });
});

console.log('✅ Rutas de pacientes configuradas correctamente:');
console.log('   📋 CRUD: 5 rutas');
console.log('   🔍 Búsquedas: 3 rutas');
console.log('   🩺 Diagnósticos: 3 rutas');
console.log('   🔧 Total: 11 rutas activas');

module.exports = router;