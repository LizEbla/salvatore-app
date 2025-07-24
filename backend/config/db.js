const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('Lab_Salvatore', 'postgres', '12345', {
  host: 'localhost',
  port: 5433, // 5433 si tu PostgreSQL está en ese puerto
  dialect: 'postgres',
  logging: false,
});

module.exports = sequelize;
