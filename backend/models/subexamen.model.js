// models/subexamen.model.js
module.exports = (sequelize, DataTypes) => {
  const Subexamen = sequelize.define('Subexamen', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: { 
      type: DataTypes.STRING, 
      allowNull: false 
    },
    examen_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Examenes', // nombre de la tabla en la BD
        key: 'id'
      }
    },
    precio: { 
      type: DataTypes.DECIMAL(10, 2), 
      allowNull: true 
    },
    tipoPrecio: { 
      type: DataTypes.STRING, 
      allowNull: true 
    },
    tipoMuestra: { 
      type: DataTypes.TEXT 
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
      type: DataTypes.TEXT 
    },
    parametros: {
      type: DataTypes.JSON, // Para almacenar parámetros específicos del subexamen
      allowNull: true
    },
    orden: {
      type: DataTypes.INTEGER, // Para ordenar los subexámenes
      defaultValue: 0
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'Subexamenes',
    timestamps: true,
    indexes: [
      {
        fields: ['examen_id'] // Índice para mejorar rendimiento en búsquedas
      }
    ]
  });

  Subexamen.associate = function(models) {
    // 🔹 ASOCIACIÓN CRÍTICA: Subexamen pertenece a Examen
    Subexamen.belongsTo(models.Examen, { 
      foreignKey: 'examen_id', 
      as: 'Examen' 
    });

    

    // 🔹 Si necesitas asociaciones adicionales con ExamenPacienteDetalle
    Subexamen.hasMany(models.ExamenPacienteDetalle, {
      foreignKey: 'subexamenId',
      as: 'DetallesPaciente'
    });
  };

  return Subexamen;
};