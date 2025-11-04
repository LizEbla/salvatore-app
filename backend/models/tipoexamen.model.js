module.exports = (sequelize, DataTypes) => {
  const TipoExamen = sequelize.define('TipoExamen', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: DataTypes.STRING,
    area: DataTypes.STRING,
    precio: DataTypes.DOUBLE,
    tipoPrecio: DataTypes.STRING,
    tipoMuestra: DataTypes.STRING,
    tiempoEntrega: DataTypes.STRING,
    tipoTubo: DataTypes.STRING,
    observaciones: DataTypes.STRING
  }, {
    tableName: 'Tipoexamenes',
    timestamps: false
  });

  return TipoExamen;
};
