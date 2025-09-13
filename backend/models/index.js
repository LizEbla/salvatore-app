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

// Importar modelos (orden importante)
db.Laboratorista = require('./Laboratorista.js')(sequelize, Sequelize.DataTypes);
db.Paciente = require('./paciente.model.js')(sequelize, Sequelize.DataTypes);
db.Area = require('./area.model.js')(sequelize, Sequelize.DataTypes);
db.Examen = require('./examen.model.js')(sequelize, Sequelize.DataTypes);
db.Subexamen = require('./subexamen.model.js')(sequelize, Sequelize.DataTypes);

// Definir relaciones
db.Laboratorista.hasMany(db.Paciente, { foreignKey: 'laboratoristaId' });
db.Paciente.belongsTo(db.Laboratorista, { foreignKey: 'laboratoristaId' });

// Relaciones de jerarquía de exámenes
db.Area.hasMany(db.Examen, { foreignKey: 'area_id' });
db.Examen.belongsTo(db.Area, { foreignKey: 'area_id' });

db.Examen.hasMany(db.Subexamen, { foreignKey: 'examen_id' });
db.Subexamen.belongsTo(db.Examen, { foreignKey: 'examen_id' });
db.TipoExamen = require('./tipoexamen.model.js')(sequelize, Sequelize.DataTypes);
db.HistorialImportacion = require('./historialimportacion')(sequelize, Sequelize);


module.exports = db;
