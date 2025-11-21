//models/Paciente.model.js

module.exports = (sequelize, DataTypes) => {
  const Paciente = sequelize.define('Paciente', {

    
    nombres: {
      type: DataTypes.STRING,
      allowNull: false
    },
    apellidos: {
      type: DataTypes.STRING,
      allowNull: false
    },
    cedula: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    fechaNacimiento: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    edad: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    estadoSalud: {
      type: DataTypes.STRING,
      allowNull: false
    },
    direccion: {
      type: DataTypes.STRING,
      allowNull: false
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: false
    },
    correo: {
      type: DataTypes.STRING,
      allowNull: false
    },
    alergias: {
      type: DataTypes.TEXT
    },
    usuario: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    claveAcceso: { // Contraseña visible para el laboratorista/admin
  type: DataTypes.STRING,
  allowNull: false
},
contrasenaHash: { // Contraseña encriptada para login
  type: DataTypes.STRING,
  allowNull: false
},

    laboratoristaId: {
      type: DataTypes.INTEGER
    },
    nombreLaboratorista: {
      type: DataTypes.STRING
    },
    sexo: {
      type: DataTypes.STRING(1),
      allowNull: false,
      validate: {
        isIn: [['M', 'F']]
      }
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
    timestamps: true  // ✅ esto habilita createdAt y updatedAt
  });

  Paciente.associate = function(models) {
  Paciente.hasMany(models.ExamenPaciente, { 
  foreignKey: 'pacienteId',
  as: 'ExamenesPaciente'
});

};

  return Paciente;
};
