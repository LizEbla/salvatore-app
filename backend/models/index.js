const Sequelize = require('sequelize');
const dbConfig = require('../config/db.config');

const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
  host: dbConfig.HOST,
  port: dbConfig.PORT,
  dialect: dbConfig.dialect,
  logging: false,
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// ==========================
// 📌 IMPORTACIÓN DE MODELOS
// ==========================
db.Laboratorista = require('./Laboratorista.js')(sequelize, Sequelize.DataTypes);
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
db.Sucursal = require('./sucursal.model.js')(sequelize, Sequelize.DataTypes);

// ==========================
// 📌 EJECUTAR ASOCIACIONES UNA SOLA VEZ
// ==========================
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

console.log('✅ Todas las asociaciones configuradas correctamente');

module.exports = db;
