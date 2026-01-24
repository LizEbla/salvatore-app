// models/historialimportacion.js
module.exports = (sequelize, DataTypes) => {
  const HistorialImportacion = sequelize.define('HistorialImportacion', {
    nombre_archivo: DataTypes.TEXT,
    fecha_importacion: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    usuario: DataTypes.STRING
  });

  return HistorialImportacion;
};
