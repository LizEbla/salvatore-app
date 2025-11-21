// models/examenPacienteDetalle.model.js - VERSIÓN COMPLETA CORREGIDA
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
    
    // ✅ COLUMNA FALTANTE - AGREGAR ESTA
    
    nombreExamen: {
  type: DataTypes.TEXT, // Cambiar de STRING a TEXT
  allowNull: false,
  defaultValue: 'Examen sin nombre'
},
    
    precioAplicado: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    descuentoAplicado: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
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
    medicoSolicitanteDetalle: {
      type: DataTypes.STRING,
      allowNull: true
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

    // ✅ CAMPOS PARA PDF Y FIRMA
    pdfGenerado: {
      type: DataTypes.BLOB('long'),
      allowNull: true
    },
    fechaGeneracionPdf: {
      type: DataTypes.DATE,
      allowNull: true
    },
    pdfPendiente: { // ✅ NUEVO - para controlar generación de PDF
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    firmaElectronica: {
      type: DataTypes.JSON,
      allowNull: true
    },
    fechaFirma: {
      type: DataTypes.DATE,
      allowNull: true
    },
    laboratoristaFirmaId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Laboratoristas',
        key: 'id'
      }
    },
    firmaVisual: {
      type: DataTypes.JSON,
      allowNull: true
    },
    estadoFirma: { // ✅ NUEVO - para controlar estado de firma
      type: DataTypes.STRING(20),
      defaultValue: 'no_firmado',
      validate: {
        isIn: [['no_firmado', 'firmado', 'pendiente_firma']]
      }
    },

    pdfFirmado: {
  type: DataTypes.STRING,
  allowNull: true
},

    
    // ✅ CAMPOS DE REGISTRO - AGREGAR ESTOS
    registradoPor: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    fechaRegistro: {
      type: DataTypes.DATE,
      allowNull: true
    },
    horaRegistro: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    laboratorio: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    
    // ✅ CAMPOS PARA CONTROL DE EDICIÓN
    esSubexamen: { // ✅ NUEVO - para identificar tipo
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    fechaCompletado: { // ✅ NUEVO - para controlar cuando se completa
      type: DataTypes.DATE,
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
      { fields: ['sucursalId'] },
      { fields: ['nombreExamen'] } // ✅ NUEVO índice
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

    ExamenPacienteDetalle.hasMany(models.HistorialResultados, {
      foreignKey: 'examenPacienteDetalleId',
      as: 'Historial'
    });
    
    ExamenPacienteDetalle.belongsTo(models.Promocion, { 
      foreignKey: 'promocionId', 
      as: 'Promocion' 
    });
  };

  // ✅ HOOK MEJORADO para calcular precioFinal y establecer nombreExamen
  ExamenPacienteDetalle.beforeSave(async (detalle, options) => {
    // Calcular precioFinal
    if (detalle.precioAplicado || detalle.descuentoAplicado) {
      const precio = parseFloat(detalle.precioAplicado || 0);
      const descuento = parseFloat(detalle.descuentoAplicado || 0);
      detalle.precioFinal = Math.max(0, precio - descuento);
    }

    // ✅ ESTABLECER nombreExamen automáticamente si no está definido
    if (!detalle.nombreExamen) {
      try {
        if (detalle.examenId && detalle.esSubexamen === false) {
          const examen = await sequelize.models.Examen.findByPk(detalle.examenId);
          if (examen) {
            detalle.nombreExamen = examen.nombre;
          }
        } else if (detalle.subexamenId && detalle.esSubexamen === true) {
          const subexamen = await sequelize.models.Subexamen.findByPk(detalle.subexamenId);
          if (subexamen) {
            detalle.nombreExamen = subexamen.nombre;
          }
        }
      } catch (error) {
        console.warn('⚠️ No se pudo establecer nombreExamen automáticamente:', error.message);
      }
    }

    // ✅ ESTABLECER esSubexamen automáticamente
    if (detalle.esSubexamen === undefined || detalle.esSubexamen === null) {
      detalle.esSubexamen = !!detalle.subexamenId;
    }

    // ✅ ACTUALIZAR estado cuando se completa
    if (detalle.estado === 'completado' && !detalle.fechaCompletado) {
      detalle.fechaCompletado = new Date();
    }
  });

  return ExamenPacienteDetalle;
};