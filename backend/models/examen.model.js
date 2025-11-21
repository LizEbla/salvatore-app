// models/examen.model.js
module.exports = (sequelize, DataTypes) => {
  const Examen = sequelize.define('Examen', {
    nombre: { type: DataTypes.STRING(3000), allowNull: false },
    precio: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    tipoPrecio: { type: DataTypes.STRING, allowNull: true },
    tipoMuestra: { type: DataTypes.TEXT },
    tipoTubo: { type: DataTypes.STRING(255), allowNull: true },
    tiempoEntrega: { type: DataTypes.STRING(255), allowNull: true },
    observaciones: { type: DataTypes.TEXT },
  }, {
    tableName: 'Examenes' // Asegúrate que coincida con la referencia
  });

  Examen.associate = (models) => {
    // 🔹 Relación con Área
    Examen.belongsTo(models.Area, { foreignKey: 'area_id', as: 'Area' });

    // 🔹 Relación con ExamenPaciente
    Examen.hasMany(models.ExamenPaciente, { foreignKey: 'examenId', as: 'ExamenesPaciente' });

    // 🔹 Relación con Subexámenes (ASOCIACIÓN CRÍTICA)
    Examen.hasMany(models.Subexamen, { 
      foreignKey: 'examen_id', 
      as: 'Subexamenes' 
    });

    // 🔹 Relación con ExamenPacienteDetalle
    Examen.hasMany(models.ExamenPacienteDetalle, { foreignKey: 'examenId', as: 'Detalles' });

    // 🔹 Relación N:M con Promocion
    Examen.belongsToMany(models.Promocion, {
      through: models.PromocionExamen,
      foreignKey: 'examenId',
      otherKey: 'promocionId',
      as: 'Promociones'
    });

    Examen.belongsTo(models.TipoExamen, {
    foreignKey: 'tipoExamenId',
    as: 'TipoExamen'
  });

  
  };

  return Examen;
};