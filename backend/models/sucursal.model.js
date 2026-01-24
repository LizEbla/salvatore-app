//models/sucursal.model.js

module.exports = (sequelize, DataTypes) => {
  const Sucursal = sequelize.define('Sucursal', {
    nombre: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    direccion: { type: DataTypes.STRING(255) },
    telefono: { type: DataTypes.STRING(20) },
    ciudad: { type: DataTypes.STRING(100) },
    activo: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, {
    tableName: 'Sucursales',
    freezeTableName: true,
    timestamps: true
  });

  Sucursal.associate = (models) => {
    // Relación con Laboratorista
    Sucursal.hasMany(models.Laboratorista, {
      foreignKey: 'sucursalId',
      as: 'Laboratorista'
    });

    // Relación opcional con detalles de exámenes
    Sucursal.hasMany(models.ExamenPacienteDetalle, {
      foreignKey: 'sucursalId',
      as: 'DetallesRegistrados'
    });
  };

  return Sucursal;
};
