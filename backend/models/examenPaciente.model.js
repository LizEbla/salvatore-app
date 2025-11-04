// models/examenPaciente.model.js - COMPLETO CORREGIDO
module.exports = (sequelize, DataTypes) => {
  const ExamenPaciente = sequelize.define('ExamenPaciente', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    pacienteId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Pacientes',
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
    fechaAsignacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    estadoPago: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'pendiente',
      validate: {
        isIn: [['pendiente', 'pagado', 'parcial', 'cancelado']]
      }
    },
    abono: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0
    },
    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    saldoPendiente: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    cantidadExamenes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    observaciones: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    sucursalId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Sucursales',
        key: 'id'
      }
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'ExamenPacientes',
    timestamps: true,
    indexes: [
      {
        fields: ['pacienteId']
      },
      {
        fields: ['fechaAsignacion']
      },
      {
        fields: ['estadoPago']
      },
      {
        fields: ['laboratoristaId']
      }
    ]
  });

  ExamenPaciente.associate = function(models) {
    // 🔹 Relación con Paciente
    ExamenPaciente.belongsTo(models.Paciente, { 
      foreignKey: 'pacienteId', 
      as: 'Paciente' 
    });
    
    // 🔹 Relación con Laboratorista
    ExamenPaciente.belongsTo(models.Laboratorista, { 
      foreignKey: 'laboratoristaId', 
      as: 'Laboratorista' 
    });
    
    // 🔹 Relación con los detalles (ExamenPacienteDetalle)
    ExamenPaciente.hasMany(models.ExamenPacienteDetalle, { 
      foreignKey: 'examenPacienteId', 
      as: 'Detalles' 
    });
    
    // 🔹 Relación con Sucursal
    ExamenPaciente.belongsTo(models.Sucursal, { 
      foreignKey: 'sucursalId', 
      as: 'Sucursal' 
    });
  };

  return ExamenPaciente;
};