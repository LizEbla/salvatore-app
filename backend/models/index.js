// models/index.js - VERSIÓN CORREGIDA

const Sequelize = require('sequelize');
const dbConfig = require('../config/db.config');

// ============================
// 📌 CONEXIÓN CON BASE DE DATOS
// ============================
const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
  host: dbConfig.HOST,
  port: dbConfig.PORT,
  dialect: dbConfig.dialect,
  logging: false,
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// ============================
// 📌 IMPORTACIÓN DE MODELOS
// ============================
console.log('📦 Cargando modelos...');

db.Laboratorista = require('./Laboratorista.js')(sequelize, Sequelize.DataTypes);
console.log('   ✅ Laboratorista cargado');

db.Sucursal = require('./sucursal.model.js')(sequelize, Sequelize.DataTypes);
console.log('   ✅ Sucursal cargado');

db.Usuario = require('./usuario.js')(sequelize, Sequelize.DataTypes);


// Cargar otros modelos...
db.Paciente = require('./paciente.model.js')(sequelize, Sequelize.DataTypes);
db.Area = require('./area.model.js')(sequelize, Sequelize.DataTypes);
db.Examen = require('./examen.model.js')(sequelize, Sequelize.DataTypes);
db.Subexamen = require('./subexamen.model.js')(sequelize, Sequelize.DataTypes);
db.TipoExamen = require('./tipoexamen.model.js')(sequelize, Sequelize.DataTypes);
db.HistorialImportacion = require('./historialimportacion.js')(sequelize, Sequelize.DataTypes);
db.Promocion = require('./promocion.model.js')(sequelize, Sequelize.DataTypes);
db.PromocionExamen = require('./promocionExamen.model.js')(sequelize, Sequelize.DataTypes);
db.ExamenPaciente = require('./examenPaciente.model.js')(sequelize, Sequelize.DataTypes);
db.ExamenPacienteDetalle = require('./examenPacienteDetalles.js')(sequelize, Sequelize.DataTypes);

// ============================
// 📌 IMPORTAR MODELO PAGO
// ============================
try {
  db.Pago = require('./pago.js')(sequelize, Sequelize.DataTypes);
  console.log('💰 Modelo Pago cargado correctamente');
} catch (error) {
  console.warn('⚠️ Modelo Pago no encontrado. Crear el archivo models/pago.js');
  db.Pago = null;
}

// ============================
// 📌 IMPORTAR HISTORIAL DE RESULTADOS
// ============================
try {
  db.HistorialResultados = require('./historialresultados.js')(sequelize, Sequelize.DataTypes);
  console.log('📘 Modelo HistorialResultados cargado correctamente');
} catch (error) {
  console.warn('⚠️ Modelo HistorialResultados no encontrado.');
  db.HistorialResultados = null;
}

// ============================
// 📌 EJECUTAR TODAS LAS ASOCIACIONES
// ============================
console.log('🔗 Ejecutando asociaciones...');

Object.keys(db).forEach(modelName => {
  if (db[modelName] && typeof db[modelName].associate === 'function') {
    console.log(`   🔄 Ejecutando associate para ${modelName}...`);
    try {
      db[modelName].associate(db);
      console.log(`   ✅ Associate de ${modelName} ejecutado`);
    } catch (error) {
      console.error(`   ❌ Error en associate de ${modelName}:`, error.message);
    }
  }
});

// ============================
// 📌 CONFIGURACIÓN MANUAL DE ASOCIACIONES CRÍTICAS
// ============================
console.log('🔧 Configurando asociaciones manualmente...');

// 1. Configurar Laboratorista -> Sucursal (SI NO EXISTE)
if (db.Laboratorista && db.Sucursal) {
  if (!db.Laboratorista.associations || !db.Laboratorista.associations.Sucursal) {
    console.log('   🔧 Configurando manualmente Laboratorista -> Sucursal');
    db.Laboratorista.belongsTo(db.Sucursal, {
      foreignKey: 'sucursalId',
      as: 'Sucursal'
    });
  }
}

// 2. Configurar Sucursal -> Laboratorista (SI NO EXISTE)
if (db.Sucursal && db.Laboratorista) {
  if (!db.Sucursal.associations || !db.Sucursal.associations.Laboratoristas) {
    console.log('   🔧 Configurando manualmente Sucursal -> Laboratoristas');
    db.Sucursal.hasMany(db.Laboratorista, {
      foreignKey: 'sucursalId',
      as: 'Laboratoristas'
    });
  }
}

// ============================
// 📌 VERIFICACIÓN FINAL
// ============================
console.log('🔍 Verificación final de asociaciones:');

if (db.Laboratorista && db.Laboratorista.associations) {
  console.log('   Laboratorista.associations:', Object.keys(db.Laboratorista.associations));
} else {
  console.log('   ❌ Laboratorista no tiene asociaciones');
}

if (db.Sucursal && db.Sucursal.associations) {
  console.log('   Sucursal.associations:', Object.keys(db.Sucursal.associations));
} else {
  console.log('   ❌ Sucursal no tiene asociaciones');
}

console.log('✅ Todas las asociaciones configuradas correctamente');

module.exports = db;