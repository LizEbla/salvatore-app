// server.js - VERSIÓN SIMPLIFICADA Y FUNCIONAL
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

// ========================
// 1. CONFIGURACIÓN BÁSICA
// ========================
app.use(cors({
  origin: ['http://localhost:4200', 'http://127.0.0.1:4200'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware de logging
app.use((req, res, next) => {
  console.log(`📨 [${new Date().toISOString().split('T')[1].split('.')[0]}] ${req.method} ${req.originalUrl}`);
  next();
});

// ========================
// 2. CARGAR RUTAS DINÁMICAMENTE
// ========================
console.log('\n🔍 Cargando rutas...');

// Función para cargar rutas de forma segura
function cargarRuta(nombreArchivo, rutaApi) {
  const rutaCompleta = path.join(__dirname, 'routes', nombreArchivo);
  
  if (fs.existsSync(rutaCompleta)) {
    try {
      const ruta = require(rutaCompleta);
      app.use(rutaApi, ruta);
      console.log(`✅ ${rutaApi} -> ${nombreArchivo}`);
      return true;
    } catch (error) {
      console.log(`❌ ${rutaApi} -> ERROR: ${error.message}`);
      return false;
    }
  } else {
    console.log(`⚠️  ${rutaApi} -> ${nombreArchivo} NO EXISTE`);
    return false;
  }
}

console.log('📌 __dirname:', __dirname);
console.log('📌 routes folder:', path.join(__dirname, 'routes'));


// Cargar todas las rutas
cargarRuta('tipoexamen.routes.js', '/api/tipoexamenes');
cargarRuta('paciente.routes.js', '/api/pacientes');
cargarRuta('auth.routes.js', '/api/auth');
cargarRuta('laboratoristas.routes.js', '/api/laboratoristas');
cargarRuta('sucursal.routes.js', '/api/sucursales');
cargarRuta('promocion.routes.js', '/api/promociones');
cargarRuta('examen.routes.js', '/api/examenes');
cargarRuta('pago.routes.js', '/api/pagos');
cargarRuta('resultado.routes.js', '/api/resultados');
cargarRuta('diagnostico.routes.js', '/api/diagnosticos');
cargarRuta('vista-paciente.routes.js', '/api/vista-paciente');
cargarRuta('usuario.routes.js', '/api/usuarios');
cargarRuta('firma.routes.js', '/api/firma');
cargarRuta('dashboardAdmin.routes.js', '/api/dashboard-admin');

// ========================
// 3. RUTAS BÁSICAS DE FALLBACK
// ========================

// Ruta de salud básica
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Servidor funcionando',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: 'POST /api/auth/login',
      pacientes: 'GET /api/pacientes',
      examenes: 'GET /api/examenes',
      firma: 'POST /api/firma/firmar-pdf'
    }
  });
});

// Ruta de diagnóstico
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    }
  });
  
  res.json({
    totalRoutes: routes.length,
    routes: routes.slice(0, 20) // Mostrar solo las primeras 20
  });
});

// ========================
// 4. MANEJO DE ERRORES
// ========================
app.use('*', (req, res) => {
  console.log(`❌ Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method,
    sugerencias: [
      'Verifique la URL completa',
      'Consulte GET /api/health para endpoints disponibles',
      'Verifique que el backend esté ejecutándose'
    ]
  });
});

app.use((error, req, res, next) => {
  console.error('💥 Error:', error);
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    message: error.message
  });
});


// ========================
// 5. INICIAR SERVIDOR
// ========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 BACKEND DE LABORATORIO CLÍNICO');
  console.log('='.repeat(60));
  console.log(`📍 URL: http://localhost:${PORT}`);
  console.log('='.repeat(60));
  console.log('🎯 ENDPOINTS CLAVE:');
  console.log('   POST /api/auth/login');
  console.log('   GET  /api/sucursales');
  console.log('   GET  /api/pacientes');
  console.log('   POST /api/firma/firmar-pdf');
  console.log('   GET  /api/health');
  console.log('='.repeat(60));
  console.log('🔍 DIAGNÓSTICO: GET /api/debug/routes');
  console.log('='.repeat(60));
});


module.exports = app;