// models/historialresultados.js
'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class HistorialResultados extends Model {
    static associate(models) {
      // ✅ Asociación con ExamenPacienteDetalle
      HistorialResultados.belongsTo(models.ExamenPacienteDetalle, {
        foreignKey: 'examenPacienteDetalleId',
        as: 'ExamenPacienteDetalle'
      });
      
      // ✅ Asociación con Laboratorista
      HistorialResultados.belongsTo(models.Laboratorista, {
        foreignKey: 'laboratoristaId',
        as: 'Laboratorista'
      });
    }
  }

  HistorialResultados.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    examenPacienteDetalleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'ExamenPacienteDetalles',
        key: 'id'
      }
    },
    laboratoristaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Laboratoristas',
        key: 'id'
      }
    },
    resultadosAnteriores: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    resultadosNuevos: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    cambios: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    accion: {
      type: DataTypes.ENUM('creacion', 'edicion', 'correccion', 'validacion'),
      defaultValue: 'edicion'
    }
  }, {
    sequelize,
    modelName: 'HistorialResultados',
    tableName: 'HistorialResultados',
    timestamps: true,
    underscored: false
  });

  return HistorialResultados;
};