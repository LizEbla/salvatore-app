module.exports = (sequelize, DataTypes) => {
  const Subexamen = sequelize.define('Subexamen', {
    nombre: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    precio: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },

    tipoPrecio: {
      type: DataTypes.STRING, // ✅ Asegúrate de que exista esta línea
      allowNull: true
    },
    
    tipoMuestra: {
      type: DataTypes.STRING(255)
    },
    tipoTubo: {
      type: DataTypes.STRING(255)
    },
    tiempoEntrega: {
      type: DataTypes.STRING(255)
    },
    observaciones: {
      type: DataTypes.STRING(2000), // ⬅️ Aumentamos el tamaño
      allowNull: true
    }
  });

  Subexamen.associate = models => {
    Subexamen.belongsTo(models.Examen, {
      foreignKey: 'examen_id',
      as: 'examen'
    });
  };

  return Subexamen;
};

