// models/Usuario.js
module.exports = (sequelize, DataTypes) => {
  const Usuario = sequelize.define('Usuario', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    nombres: { type: DataTypes.STRING, allowNull: false },
    apellidos: { type: DataTypes.STRING, allowNull: false },

    usuario: { type: DataTypes.STRING, allowNull: false, unique: true },
    contrasena: { type: DataTypes.STRING, allowNull: false },

    rol: {
      type: DataTypes.ENUM('superadmin', 'administrador'),
      allowNull: false
    },

    estado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  }, {
    tableName: 'usuarios',
    timestamps: true
  });

  return Usuario;
};
