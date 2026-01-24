module.exports = (sequelize, DataTypes) => {
  const Area = sequelize.define('Area', {
    nombre: { type: DataTypes.STRING, allowNull: false }
  });

  Area.associate = (models) => {
    Area.hasMany(models.Examen, { foreignKey: 'area_id', as: 'Examenes' });
  };

  return Area;
};
