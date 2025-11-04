const express = require('express');
const cors = require('cors');
const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Para manejar PDFs grandes
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Importar todas las rutas
const pacienteRoutes = require('./routes/paciente.routes');
const examenRoutes = require('./routes/examen.routes');
const pagoRoutes = require('./routes/pago.routes');
const resultadoRoutes = require('./routes/resultado.routes');
const laboratoristaRoutes = require('./routes/laboratorista.routes');
const diagnosticoRoutes = require('./routes/diagnostico.routes');

// =======================
// 🔗 MONTAR TODAS LAS RUTAS
// =======================
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/examenes', examenRoutes);
app.use('/api/pagos', pagoRoutes);
app.use('/api/resultados', resultadoRoutes);
app.use('/api/laboratoristas', laboratoristaRoutes);
app.use('/api/diagnosticos', diagnosticoRoutes);


// =======================
// 🏠 RUTAS DE SALUD Y ESTADO
// =======================
app.get('/api/salud', (req, res) => {
  res.json({ 
    mensaje: '🚀 Sistema de Laboratorio Clínico funcionando correctamente',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    modulos: {
      pacientes: '✅ Activo',
      examenes: '✅ Activo', 
      pagos: '✅ Activo',
      resultados: '✅ Activo',
      laboratoristas: '✅ Activo',
      diagnosticos: '✅ Activo'
    }
  });
});

// Ruta de información del sistema
app.get('/api/info', (req, res) => {
  res.json({
    sistema: 'Laboratorio Clínico Especializado',
    version: '1.0.0',
    estructura: 'Arquitectura Modular',
    desarrolladoPor: 'Tu Equipo',
    endpoints: {
      pacientes: '/api/pacientes',
      examenes: '/api/examenes',
      pagos: '/api/pagos',
      resultados: '/api/resultados',
      laboratoristas: '/api/laboratoristas',
      diagnosticos: '/api/diagnosticos'
    }
  });
});

// =======================
// 🛡️ MANEJO DE ERRORES GLOBAL
// =======================

// Ruta no encontrada (404)
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    mensaje: `Ruta no encontrada: ${req.originalUrl}`,
    sugerencia: 'Verifique la documentación de la API'
  });
});

// Manejo de errores global
app.use((error, req, res, next) => {
  console.error('❌ Error global:', error);
  
  res.status(500).json({
    success: false,
    mensaje: 'Error interno del servidor',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Contacte al administrador'
  });
});

// =======================
// 🚀 INICIAR SERVIDOR
// =======================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('=================================');
  console.log('🚀 SERVICIO DE LABORATORIO CLÍNICO');
  console.log('=================================');
  console.log(`📍 Servidor corriendo en: http://localhost:${PORT}`);
  console.log('📋 Módulos cargados:');
  console.log('   ✅ /api/pacientes');
  console.log('   ✅ /api/examenes');
  console.log('   ✅ /api/pagos');
  console.log('   ✅ /api/resultados');
  console.log('   ✅ /api/laboratoristas');
  console.log('   ✅ /api/diagnosticos');
  console.log('   ✅ /api/salud (Estado del sistema)');
  console.log('   ✅ /api/info (Información del sistema)');
  console.log('=================================');
});