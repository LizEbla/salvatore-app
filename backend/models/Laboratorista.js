// models/laboratorista.model.js - VERSIÓN CORREGIDA
module.exports = (sequelize, DataTypes) => {
  const Laboratorista = sequelize.define('Laboratorista', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombres: {
      type: DataTypes.STRING,
      allowNull: false
    },
    apellidos: {
      type: DataTypes.STRING,
      allowNull: false
    },
    cedula: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    // 🔹 AGREGAR ESTOS CAMPOS PARA LOGIN
    usuario: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    contrasena: {
      type: DataTypes.STRING,
      allowNull: false
    },
    rol: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'laboratorista'
    },
    especialidad: {
      type: DataTypes.STRING,
      allowNull: true
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: true
    },
    correo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
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
    tableName: 'Laboratoristas',
    timestamps: true
  });

  Laboratorista.associate = function(models) {
    Laboratorista.hasMany(models.ExamenPacienteDetalle, {
      foreignKey: 'realizadoPor',
      as: 'ExamenesRealizados'
    });
    
    Laboratorista.belongsTo(models.Sucursal, {
      foreignKey: 'sucursalId',
      as: 'Sucursal'
    });

 Laboratorista.hasMany(models.HistorialResultados, {
    foreignKey: 'laboratoristaId',
    as: 'HistorialResultados'
  });

  };

  return Laboratorista;
};