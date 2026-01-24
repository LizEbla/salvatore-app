// models/pagodetalle.js
module.exports = (sequelize, DataTypes) => {
  const PagoDetalle = sequelize.define('PagoDetalle', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    pagoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Pagos',
        key: 'id'
      }
    },
    examenPacienteId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'ExamenPacientes',
        key: 'id'
      }
    },
    examenPacienteDetalleId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'ExamenPacienteDetalles',
        key: 'id'
      }
    },
    montoAplicado: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    tipoAplicacion: {
      type: DataTypes.ENUM('grupal', 'individual'),
      allowNull: false,
      defaultValue: 'grupal'
    }
  }, {
    tableName: 'PagoDetalles',
    timestamps: true
  });

  PagoDetalle.associate = (models) => {
    PagoDetalle.belongsTo(models.Pago, {
      foreignKey: 'pagoId',
      as: 'Pago'
    });
    PagoDetalle.belongsTo(models.ExamenPaciente, {
      foreignKey: 'examenPacienteId',
      as: 'ExamenPaciente'
    });
    PagoDetalle.belongsTo(models.ExamenPacienteDetalle, {
      foreignKey: 'examenPacienteDetalleId',
      as: 'ExamenDetalle'
    });
  };

  return PagoDetalle;
  
};