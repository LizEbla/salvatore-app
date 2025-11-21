module.exports = (sequelize, DataTypes) => {
  const Pago = sequelize.define('Pago', {

    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    pacienteId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    laboratoristaId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    monto: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false,
      defaultValue: 0
    },

    metodoPago: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "efectivo"
    },

    tipo: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "grupal" // individual / grupal
    },

    referencia: {
      type: DataTypes.STRING(255),
      allowNull: true
    },

    estado: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "completado"
    },

    fechaPago: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
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
    tableName: 'Pagos',
    timestamps: true
  });

  Pago.associate = (models) => {

    Pago.belongsTo(models.Paciente, {
      foreignKey: 'pacienteId',
      as: 'Paciente'
    });

    Pago.belongsTo(models.Laboratorista, {
      foreignKey: 'laboratoristaId',
      as: 'Laboratorista'
    });

  };

  return Pago;
};
