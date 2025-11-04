// models/promocionExamen.model.js
// models/promocionExamen.model.js
module.exports = (sequelize, DataTypes) => {
  const PromocionExamen = sequelize.define('PromocionExamen', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    promocionId: { 
      type: DataTypes.INTEGER, 
      allowNull: false 
    },
    examenId: { 
      type: DataTypes.INTEGER, 
      allowNull: false 
    },
    subexamenId: { 
      type: DataTypes.INTEGER, 
      allowNull: true 
    },
    // ✅ NUEVOS CAMPOS PARA LOS DETALLES DE PRECIOS
    precioIndividual: { 
      type: DataTypes.DECIMAL(10, 2), 
      allowNull: false,
      defaultValue: 0
    },
    precioDescuento: { 
      type: DataTypes.DECIMAL(10, 2), 
      allowNull: false,
      defaultValue: 0
    },
    ahorro: { 
      type: DataTypes.DECIMAL(10, 2), 
      allowNull: false,
      defaultValue: 0
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    esPrincipal: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'PromocionExamenes',
    timestamps: true // ✅ Ahora sí tendrá timestamps
  });

  PromocionExamen.associate = (models) => {
    PromocionExamen.belongsTo(models.Promocion, {
      foreignKey: 'promocionId',
      as: 'Promocion'
    });
    
    PromocionExamen.belongsTo(models.Examen, {
      foreignKey: 'examenId',
      as: 'Examen'
    });
    
    PromocionExamen.belongsTo(models.Subexamen, {
      foreignKey: 'subexamenId',
      as: 'Subexamen'
    });
  };

  return PromocionExamen;
};