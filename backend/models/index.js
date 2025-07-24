const Sequelize = require('sequelize');
const dbConfig = require('../config/db.config');

const sequelize = new Sequelize(dbConfig.DB, dbConfig.USER, dbConfig.PASSWORD, {
  host: dbConfig.HOST,
  port: dbConfig.PORT,
  dialect: dbConfig.dialect,
  logging: false,
});

const db = {}; // ✅ Solo esta línea para declarar db

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Importar modelos
db.Laboratorista = require('./Laboratorista.js')(sequelize, Sequelize.DataTypes);
db.Paciente = require('./paciente.model.js')(sequelize, Sequelize.DataTypes);

// Definir relaciones
db.Laboratorista.hasMany(db.Paciente, { foreignKey: 'laboratoristaId' });
db.Paciente.belongsTo(db.Laboratorista, { foreignKey: 'laboratoristaId' });

module.exports = db;
