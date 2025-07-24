module.exports = (sequelize, DataTypes) => {
  const Laboratorista = sequelize.define('Laboratorista', {
    nombres: { type: DataTypes.STRING, allowNull: false },
    apellidos: { type: DataTypes.STRING, allowNull: false },
    cedula: { type: DataTypes.STRING, allowNull: false, unique: true },
    celular: { type: DataTypes.STRING, allowNull: false },
    correo: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { isEmail: true }
    },
    usuario: { type: DataTypes.STRING, allowNull: false, unique: true },
    contrasena: { type: DataTypes.STRING, allowNull: false }

    
  }, {
    tableName: 'Laboratorista' // 👈 nombre exacto de la tabla en la BD
  });

  return Laboratorista;
};
