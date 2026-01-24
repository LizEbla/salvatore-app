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
    // models/examenPaciente.model.js - MODIFICAR
laboratoristaId: {
  type: DataTypes.INTEGER,
  allowNull: true, // ✅ CAMBIAR de false a true
  references: {
    model: 'Laboratoristas',
    key: 'id'
  },
  comment: 'Puede ser null para administradores que asignan'
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
    isIn: [['pendiente', 'pagado', 'parcial', 'abono', 'cancelado']] // ✅ AGREGAR 'abono'
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
    medicoSolicitante: {
  type: DataTypes.STRING,
  allowNull: true
},

    observaciones: {
      type: DataTypes.TEXT,
      allowNull: true
    },

    // En models/examenPaciente.model.js
usuarioAsignadorId: {
  type: DataTypes.INTEGER,
  allowNull: false,
  comment: 'ID del usuario que asignó (puede ser laboratorista o administrador)'
},
tipoUsuarioAsignador: {
  type: DataTypes.ENUM('laboratorista', 'administrador', 'superadmin'),
  allowNull: false,
  defaultValue: 'laboratorista'
},
asignadoPor: {
  type: DataTypes.STRING(255),
  allowNull: true,
  comment: 'Nombre completo del usuario que asignó'
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


ExamenPaciente.hasMany(models.Pago, {
  foreignKey: 'examenPacienteId',
  as: 'Pagos'
});


    
  };

  return ExamenPaciente;
};