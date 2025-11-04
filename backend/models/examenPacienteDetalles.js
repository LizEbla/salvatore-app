// models/examenPacienteDetalle.model.js - COMPLETO CORREGIDO
module.exports = (sequelize, DataTypes) => {
  const ExamenPacienteDetalle = sequelize.define('ExamenPacienteDetalle', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    examenPacienteId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'ExamenPacientes',
        key: 'id'
      }
    },
    examenId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Examenes',
        key: 'id'
      }
    },
    subexamenId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Subexamenes',
        key: 'id'
      }
    },
    precioAplicado: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    descuentoAplicado: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false, // ✅ CAMBIAR a false para que no sea NULL
      defaultValue: 0
    },
    precioFinal: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    estado: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'pendiente',
      validate: {
        isIn: [['pendiente', 'completado', 'en_proceso', 'cancelado']]
      }
    },
    observaciones: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    resultados: {
      type: DataTypes.JSON,
      allowNull: true
    },
    fechaRealizacion: {
      type: DataTypes.DATE,
      allowNull: true
    },
    fechaEntrega: {
      type: DataTypes.DATE,
      allowNull: true
    },
    laboratoristaId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Laboratoristas',
        key: 'id'
      }
    },
    sucursalId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Sucursales',
        key: 'id'
      }
    },
    conPromocion: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    promocionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Promociones',
        key: 'id'
      }
    },
    parametrosResultados: {
      type: DataTypes.JSON,
      allowNull: true
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
    tableName: 'ExamenPacienteDetalles',
    timestamps: true,
    indexes: [
      { fields: ['examenPacienteId'] },
      { fields: ['examenId'] },
      { fields: ['subexamenId'] },
      { fields: ['estado'] },
      { fields: ['laboratoristaId'] },
      { fields: ['sucursalId'] }
    ]
  });

  ExamenPacienteDetalle.associate = function(models) {
    ExamenPacienteDetalle.belongsTo(models.ExamenPaciente, { 
      foreignKey: 'examenPacienteId', 
      as: 'Cabecera' 
    });
    
    ExamenPacienteDetalle.belongsTo(models.Examen, { 
      foreignKey: 'examenId', 
      as: 'Examen' 
    });
    
    ExamenPacienteDetalle.belongsTo(models.Subexamen, { 
      foreignKey: 'subexamenId', 
      as: 'Subexamen' 
    });
    
    ExamenPacienteDetalle.belongsTo(models.Laboratorista, { 
      foreignKey: 'laboratoristaId', 
      as: 'Laboratorista' 
    });
    
    ExamenPacienteDetalle.belongsTo(models.Sucursal, { 
      foreignKey: 'sucursalId', 
      as: 'Sucursal' 
    });
    
    ExamenPacienteDetalle.belongsTo(models.Promocion, { 
      foreignKey: 'promocionId', 
      as: 'Promocion' 
    });
  };

  // Hook para calcular precioFinal automáticamente
  ExamenPacienteDetalle.beforeSave((detalle, options) => {
    if (detalle.precioAplicado || detalle.descuentoAplicado) {
      const precio = parseFloat(detalle.precioAplicado || 0);
      const descuento = parseFloat(detalle.descuentoAplicado || 0);
      detalle.precioFinal = precio - descuento;
    }
  });

  return ExamenPacienteDetalle;
};