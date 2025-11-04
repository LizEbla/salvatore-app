// models/promocion.model.js
// models/promocion.model.js
module.exports = (sequelize, DataTypes) => {
  const Promocion = sequelize.define('Promocion', {
    nombre: { 
      type: DataTypes.STRING, 
      allowNull: false,
      validate: {
        notEmpty: { msg: 'El nombre de la promoción es requerido' }
      }
    },
    descripcion: { 
      type: DataTypes.TEXT,
      allowNull: true 
    },
    tipo: { 
      type: DataTypes.ENUM('porcentaje', 'monto', 'combo'), 
      allowNull: false,
      validate: {
        isIn: {
          args: [['porcentaje', 'monto', 'combo']],
          msg: 'El tipo debe ser: porcentaje, monto o combo'
        }
      }
    }, 
    valor: { 
      type: DataTypes.DECIMAL(10,2), 
      allowNull: false,
      validate: {
        min: {
          args: [0],
          msg: 'El valor no puede ser negativo'
        }
      }
    },
    fechaInicio: { 
      type: DataTypes.DATE, 
      allowNull: false,
      validate: {
        isDate: { msg: 'La fecha de inicio debe ser una fecha válida' }
      }
    },
    fechaFin: { 
      type: DataTypes.DATE, 
      allowNull: false,
      validate: {
        isDate: { msg: 'La fecha de fin debe ser una fecha válida' },
        isAfterStartDate(value) {
          if (new Date(value) <= new Date(this.fechaInicio)) {
            throw new Error('La fecha de fin debe ser posterior a la fecha de inicio');
          }
        }
      }
    },
    activa: { 
      type: DataTypes.BOOLEAN, 
      defaultValue: true 
    },
    examenPrincipalId: { 
      type: DataTypes.INTEGER, 
      allowNull: true,
      validate: {
        isInt: { msg: 'El ID del examen principal debe ser un número entero' }
      }
    },
    precioTotalIndividual: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: 'El precio total individual no puede ser negativo'
        }
      }
    },
    precioTotalPromocion: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: 'El precio total promoción no puede ser negativo'
        }
      }
    },
    ahorroTotal: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
      validate: {
        min: {
          args: [0],
          msg: 'El ahorro total no puede ser negativo'
        }
      }
    }
  }, {
    tableName: 'Promociones',
    hooks: {
      beforeValidate: (promocion) => {
        // Asegurar que las fechas tengan el formato correcto
        if (promocion.fechaInicio) {
          const fechaInicio = new Date(promocion.fechaInicio);
          fechaInicio.setHours(0, 0, 0, 0);
          promocion.fechaInicio = fechaInicio;
        }
        
        if (promocion.fechaFin) {
          const fechaFin = new Date(promocion.fechaFin);
          fechaFin.setHours(23, 59, 59, 999);
          promocion.fechaFin = fechaFin;
        }

        // Validaciones específicas por tipo
        if (promocion.tipo === 'porcentaje' && promocion.valor > 100) {
          throw new Error('El porcentaje no puede ser mayor a 100%');
        }

        if (promocion.tipo === 'combo' && !promocion.examenPrincipalId) {
          throw new Error('Los combos requieren un examen principal');
        }
      },
      afterUpdate: async (promocion) => {
        // Actualizar automáticamente el estado 'activa' basado en las fechas
        const ahora = new Date();
        if (promocion.activa && new Date(promocion.fechaFin) < ahora) {
          await promocion.update({ activa: false });
        }
      }
    },
    indexes: [
      {
        fields: ['activa', 'fechaInicio', 'fechaFin']
      },
      {
        fields: ['tipo']
      }
    ]
  });

  Promocion.associate = (models) => {
    // 🔹 Relación N:M con Examen a través de PromocionExamen
    Promocion.belongsToMany(models.Examen, {
      through: models.PromocionExamen,
      foreignKey: 'promocionId',
      otherKey: 'examenId',
      as: 'Examenes',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 🔹 Relación directa con PromocionExamen para acceder a los detalles
    Promocion.hasMany(models.PromocionExamen, {
      foreignKey: 'promocionId',
      as: 'DetallesExamenes',
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // 🔹 Relación con examen principal
    Promocion.belongsTo(models.Examen, {
      foreignKey: 'examenPrincipalId',
      as: 'ExamenPrincipal',
      constraints: false // Para evitar problemas con la migración
    });
  };

  // Métodos de instancia
  Promocion.prototype.estaActiva = function() {
    const ahora = new Date();
    return this.activa && 
           new Date(this.fechaInicio) <= ahora && 
           new Date(this.fechaFin) >= ahora;
  };

  Promocion.prototype.calcularResumen = function() {
    return {
      precioTotalIndividual: parseFloat(this.precioTotalIndividual) || 0,
      precioTotalPromocion: parseFloat(this.precioTotalPromocion) || 0,
      ahorroTotal: parseFloat(this.ahorroTotal) || 0,
      porcentajeAhorro: this.precioTotalIndividual > 0 ? 
        ((this.ahorroTotal / this.precioTotalIndividual) * 100).toFixed(1) : 0
    };
  };

  // Métodos estáticos
  Promocion.obtenerPromocionesActivas = function() {
    const ahora = new Date();
    return this.findAll({
      where: {
        activa: true,
        fechaInicio: { [sequelize.Op.lte]: ahora },
        fechaFin: { [sequelize.Op.gte]: ahora }
      },
      include: ['Examenes', 'DetallesExamenes', 'ExamenPrincipal']
    });
  };

  Promocion.actualizarEstadosAutomaticamente = async function() {
    const ahora = new Date();
    const resultado = await this.update(
      { activa: false },
      {
        where: {
          fechaFin: { [sequelize.Op.lt]: ahora },
          activa: true
        }
      }
    );
    return resultado[0];
  };

  return Promocion;
};