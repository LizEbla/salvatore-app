module.exports = (sequelize, DataTypes) => {
  const Examen = sequelize.define('Examen', {
    nombre: {
      type: DataTypes.STRING(3000),
      allowNull: false
    },
    precio: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    tipoPrecio: {
      type: DataTypes.STRING, // ✅ Asegúrate de que exista esta línea
      allowNull: true
    },
    tipoMuestra: {
  type: DataTypes.TEXT, // admite textos largos sin límite de caracteres
},

    tipoTubo: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    tiempoEntrega: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    observaciones: {
  type: DataTypes.TEXT,
},
  });

  Examen.associate = models => {
    Examen.belongsTo(models.Area, {
      foreignKey: 'area_id',
      as: 'area'
    });

    Examen.hasMany(models.Subexamen, {
      foreignKey: 'examen_id',
      as: 'subexamenes'
    });
  };

  return Examen;
};
