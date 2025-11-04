// server.js
const express = require('express');
const cors = require('cors');
const db = require('./models');
const path = require('path');

const app = express();

// Agregar esto después de const app = express();
app.use((req, res, next) => {
  if (req.originalUrl.includes('asignar-examenes')) {
    console.log('🔍 SOLICITUD DETECTADA PARA ASIGNAR-EXAMENES:');
    console.log('   URL:', req.originalUrl);
    console.log('   Método:', req.method);
    console.log('   Headers:', req.headers);
  }
  next();
});

// ========================
// 1. IMPORTAR TODAS LAS RUTAS
// ========================
const tipoExamenRoutes = require('./routes/tipoexamen.routes');
const pacienteRoutes = require('./routes/paciente.routes');
const authRoutes = require('./routes/auth.routes');
const laboratoristaRoutes = require('./routes/laboratoristas.routes');
const sucursalRoutes = require('./routes/sucursal.routes');
const promocionRoutes = require('./routes/promocion.routes');

// RUTAS MODULARES
const examenRoutes = require('./routes/examen.routes');
const pagoRoutes = require('./routes/pago.routes');
const resultadoRoutes = require('./routes/resultado.routes');
const diagnosticoRoutes = require('./routes/diagnostico.routes');

// ========================
// 2. MIDDLEWARES
// ========================
app.use(cors({
  origin: ['http://localhost:4200', 'http://127.0.0.1:4200'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.options('*', cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========================
// 3. MIDDLEWARE DE LOGS MEJORADO
// ========================
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
  next();
});

// ========================
// 4. USAR TODAS LAS RUTAS (CORREGIDO - SIN DUPLICADOS)
// ========================
app.use('/api/tipoexamenes', tipoExamenRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/laboratoristas', laboratoristaRoutes);
app.use('/api/sucursales', sucursalRoutes);
app.use('/api/promociones', promocionRoutes);

// ✅ CORREGIDO: Solo una instancia de rutas de exámenes
app.use('/api/examenes', examenRoutes);
app.use('/api/pagos', pagoRoutes);
app.use('/api/resultados', resultadoRoutes);
app.use('/api/diagnosticos', diagnosticoRoutes);


// 🆕 AGREGAR ENDPOINT DE DIAGNÓSTICO PARA RUTAS
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  
  function extractRoutesFromStack(stack, prefix = '') {
    stack.forEach((middleware) => {
      if (middleware.route) {
        // Rutas directas
        routes.push({
          path: prefix + middleware.route.path,
          methods: Object.keys(middleware.route.methods)
        });
      } else if (middleware.name === 'router' && middleware.handle.stack) {
        // Rutas de router
        const routerPrefix = middleware.regexp.toString()
          .replace(/^\/\^/, '')
          .replace(/\\\?\(\?=\\\/\|\$\)\/\$/g, '')
          .replace(/\\/g, '')
          .replace(/\//g, '')
          .replace(/\^/g, '')
          .replace(/\$/g, '');
        
        extractRoutesFromStack(middleware.handle.stack, prefix + '/' + routerPrefix);
      }
    });
  }
  
  extractRoutesFromStack(app._router.stack);
  
  res.json({
    message: 'Rutas disponibles en el sistema',
    totalRoutes: routes.length,
    routes: routes.filter(route => 
      route.path.includes('examenes') || 
      route.path.includes('asignar') ||
      route.path.includes('pacientes')
    ).map(route => ({
      path: route.path,
      methods: route.methods
    }))
  });
});

console.log("✅ TODAS LAS RUTAS CARGADAS:");
console.log("   📋 /api/tipoexamenes");
console.log("   🔐 /api/auth");
console.log("   👤 /api/pacientes");
console.log("   👨‍🔬 /api/laboratoristas");
console.log("   🏢 /api/sucursales");
console.log("   🎯 /api/promociones");
console.log("   🧪 /api/examenes (Gestión completa de exámenes)");
console.log("   💰 /api/pagos (Gestión de pagos)");
console.log("   📄 /api/resultados (Resultados y PDFs)");
console.log("   🩺 /api/diagnosticos (Diagnósticos y reparaciones)");

// ========================
// 5. ENDPOINTS ESPECIALES
// ========================

// Endpoint de salud MEJORADO
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: '🚀 Servidor funcionando correctamente',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    modulos: {
      pacientes: '✅ Activo',
      examenes: '✅ Activo',
      pagos: '✅ Activo',
      resultados: '✅ Activo',
      laboratoristas: '✅ Activo',
      diagnosticos: '✅ Activo',
      tipoExamenes: '✅ Activo',
      auth: '✅ Activo',
      sucursales: '✅ Activo',
      promociones: '✅ Activo'
    },
    endpoints: {
      asignarExamenes: 'POST /api/examenes/pacientes/:id/asignar-examenes',
      resumenExamenes: 'GET /api/examenes/pacientes/:id/resumen-examenes',
      examenesConArea: 'GET /api/examenes/examenes-con-area'
    }
  });
});

// Endpoint para verificar conexión a base de datos
app.get('/api/db-status', async (req, res) => {
  try {
    await db.sequelize.authenticate();
    res.json({
      status: 'OK',
      message: 'Conexión a la base de datos establecida correctamente',
      database: db.sequelize.config.database,
      dialect: db.sequelize.config.dialect,
      modelos: Object.keys(db).filter(key => 
        typeof db[key] === 'object' && db[key].name
      )
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Error conectando a la base de datos',
      error: error.message
    });
  }
});

// Endpoint de información del sistema
app.get('/api/system-info', (req, res) => {
  res.json({
    sistema: 'Laboratorio Clínico Especializado',
    version: '2.0.0',
    arquitectura: 'Modular - Controladores Separados',
    desarrolladoPor: 'Tu Equipo',
    endpoints: {
      pacientes: '/api/pacientes',
      examenes: '/api/examenes',
      pagos: '/api/pagos',
      resultados: '/api/resultados',
      laboratoristas: '/api/laboratoristas',
      diagnosticos: '/api/diagnosticos',
      tipoExamenes: '/api/tipoexamenes',
      auth: '/api/auth',
      sucursales: '/api/sucursales',
      promociones: '/api/promociones'
    }
  });
});

// ========================
// 6. ENDPOINT DE INFORMACIÓN DE REGISTRO
// ========================
app.get('/api/examenes/detalle/:detalleId/informacion-registro', async (req, res) => {
  try {
    const { detalleId } = req.params;

    if (db.ExamenPacienteDetalle) {
      const detalle = await db.ExamenPacienteDetalle.findByPk(detalleId, {
        include: [
          {
            model: db.Laboratorio || db.Sucursal,
            as: 'Laboratorio',
            attributes: ['id', 'nombre']
          },
          {
            model: db.Usuario || db.Laboratorista,
            as: 'UsuarioRegistro',
            attributes: ['id', 'nombre', 'apellido']
          }
        ]
      });

      if (!detalle) {
        return res.status(404).json({
          success: false,
          mensaje: 'No se encontró información de registro para este examen'
        });
      }

      res.json({
        success: true,
        data: {
          registradoPor: detalle.UsuarioRegistro ? 
            `${detalle.UsuarioRegistro.nombre} ${detalle.UsuarioRegistro.apellido}` : 'Sistema',
          fechaRegistro: detalle.fecha_registro ? 
            new Date(detalle.fecha_registro).toLocaleDateString('es-ES') :
            new Date().toLocaleDateString('es-ES'),
          horaRegistro: detalle.hora_registro ||
            new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          laboratorio: detalle.Laboratorio ? detalle.Laboratorio.nombre : 'Laboratorio Central',
          laboratoristaId: detalle.usuario_registro_id
        }
      });
    } else {
      // Fallback a query directo
      const query = `
        SELECT 
          epd.fecha_registro as "fechaRegistro",
          epd.hora_registro as "horaRegistro",
          l.nombre as laboratorio,
          u.nombre || ' ' || u.apellido as "registradoPor",
          u.id as "laboratoristaId"
        FROM examen_paciente_detalle epd
        LEFT JOIN laboratorios l ON epd.laboratorio_id = l.id
        LEFT JOIN usuarios u ON epd.usuario_registro_id = u.id
        WHERE epd.id = $1
      `;

      const result = await db.sequelize.query(query, {
        replacements: [detalleId],
        type: db.sequelize.QueryTypes.SELECT
      });

      if (result.length === 0) {
        return res.status(404).json({
          success: false,
          mensaje: 'No se encontró información de registro para este examen'
        });
      }

      const registro = result[0];

      res.json({
        success: true,
        data: {
          registradoPor: registro.registradoPor || 'Sistema',
          fechaRegistro: registro.fechaRegistro ?
            new Date(registro.fechaRegistro).toLocaleDateString('es-ES') :
            new Date().toLocaleDateString('es-ES'),
          horaRegistro: registro.horaRegistro ||
            new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          laboratorio: registro.laboratorio || 'Laboratorio Central',
          laboratoristaId: registro.laboratoristaId
        }
      });
    }

  } catch (error) {
    console.error('❌ Error obteniendo información de registro:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor',
      detalle: error.message
    });
  }
});

// ========================
// 7. MANEJO DE ERRORES
// ========================

// Middleware para rutas no encontradas MEJORADO
app.use('*', (req, res) => {
  console.warn(`❌ Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  
  // Si es una ruta de API, dar sugerencias específicas
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ 
      success: false,
      error: 'Ruta de API no encontrada',
      path: req.originalUrl,
      method: req.method,
      sugerencias: [
        'Verifique la URL completa',
        'Consulte /api/health para ver los endpoints disponibles',
        'Verifique /api/debug/routes para ver todas las rutas'
      ],
      endpointsRecomendados: {
        asignarExamenes: 'POST /api/examenes/pacientes/:id/asignar-examenes',
        salud: 'GET /api/health',
        debugRutas: 'GET /api/debug/routes'
      }
    });
  }
  
  // Para rutas no-API
  res.status(404).json({ 
    success: false,
    error: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

// Middleware global de manejo de errores
app.use((error, req, res, next) => {
  console.error('💥 Error del servidor:', error);
  
  // Si el error es de validación de Sequelize
  if (error.name === 'SequelizeValidationError') {
    const errores = error.errors.map(err => ({
      campo: err.path,
      mensaje: err.message,
      valor: err.value
    }));
    
    return res.status(400).json({
      success: false,
      error: 'Error de validación',
      detalles: errores
    });
  }
  
  // Si el error es de duplicado en Sequelize
  if (error.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      success: false,
      error: 'Registro duplicado',
      detalle: 'Ya existe un registro con estos datos'
    });
  }
  
  // Si el error es de conexión a la base de datos
  if (error.name === 'SequelizeConnectionError') {
    return res.status(503).json({
      success: false,
      error: 'Error de conexión a la base de datos',
      detalle: 'No se pudo conectar a la base de datos'
    });
  }
  
  // Error genérico del servidor
  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    detalle: process.env.NODE_ENV === 'development' ? error.message : 'Contacte al administrador'
  });
});

// ========================
// 8. INICIAR SERVIDOR MEJORADO
// ========================
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Sincronizar base de datos
    await db.sequelize.sync({ alter: true });
    console.log('✅ Base de datos sincronizada');
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log('=================================');
      console.log('🚀 SISTEMA DE LABORATORIO CLÍNICO');
      console.log('=================================');
      console.log(`📍 Servidor corriendo en: http://localhost:${PORT}`);
      console.log('📊 Módulos cargados:');
      console.log('   👤  /api/pacientes (CRUD básico)');
      console.log('   🧪  /api/examenes (Asignación y gestión)');
      console.log('   💰  /api/pagos (Pagos individuales y grupales)');
      console.log('   📄  /api/resultados (Resultados y PDFs)');
      console.log('   👨‍🔬 /api/laboratoristas (Gestión de personal)');
      console.log('   🩺  /api/diagnosticos (Diagnósticos y reparaciones)');
      console.log('   🔬  /api/tipoexamenes (Catálogo de exámenes)');
      console.log('   🔐  /api/auth (Autenticación)');
      console.log('   🏢  /api/sucursales (Gestión de sucursales)');
      console.log('   🎯  /api/promociones (Promociones y descuentos)');
      console.log('   🔍  /api/health (Estado del sistema)');
      console.log('   🔍  /api/db-status (Estado de BD)');
      console.log('   🔍  /api/system-info (Información del sistema)');
      console.log('   🔍  /api/debug/routes (Diagnóstico de rutas)');
      console.log('=================================');
      console.log('\n🌐 Frontend Angular esperado en: http://localhost:4200');
      console.log('\n🎯 ENDPOINT CLAVE PARA ASIGNAR EXÁMENES:');
      console.log('   POST /api/examenes/pacientes/:id/asignar-examenes');
      console.log('=================================');
    });
    
  } catch (error) {
    console.error('❌ Error iniciando el servidor:', error);
    process.exit(1);
  }
};

// ========================
// 9. MANEJO GRACEFUL DE CIERRE
// ========================
process.on('SIGINT', async () => {
  console.log('\n🛑 Cerrando servidor gracefulmente...');
  try {
    await db.sequelize.close();
    console.log('✅ Conexión a la base de datos cerrada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cerrando conexión a BD:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('🛑 Servidor recibió SIGTERM, cerrando...');
  try {
    await db.sequelize.close();
    console.log('✅ Conexión a la base de datos cerrada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cerrando conexión a BD:', error);
    process.exit(1);
  }
});

// Iniciar servidor
startServer();

module.exports = app;