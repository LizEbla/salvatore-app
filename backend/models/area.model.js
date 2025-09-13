module.exports = (sequelize, DataTypes) => {
  const Area = sequelize.define('Area', {
    nombre: DataTypes.STRING
  });

  Area.associate = models => {
    Area.hasMany(models.Examen, {
      foreignKey: 'area_id',
      as: 'examenes'
    });
  };

  return Area;
};
