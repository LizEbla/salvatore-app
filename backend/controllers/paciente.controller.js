const db = require('../models');
const Paciente = db.Paciente;
const { Op, fn, col, where, Sequelize } = require('sequelize');

// 📌 Crear paciente
exports.crearPaciente = async (req, res) => {
  const {
    nombres,
    apellidos,
    cedula,
    fechaNacimiento,
    edad,
    estadoSalud,
    direccion,
    telefono,
    correo,
    alergias,
    usuario,
    contrasena,
    sexo
  } = req.body;

  try {
    const existe = await Paciente.findOne({
      where: {
        [Op.or]: [
          { cedula },
          {
            [Op.and]: [
              { nombres: { [Op.iLike]: nombres } },
              { apellidos: { [Op.iLike]: apellidos } }
            ]
          }
        ]
      }
    });

    if (existe) {
      return res.status(409).json({ mensaje: 'El paciente ya está registrado.' });
    }

    let laboratoristaId = null;
    let nombreLaboratorista = null;
    if (req.user) {
      laboratoristaId = req.user.id;
      nombreLaboratorista = `${req.user.nombres} ${req.user.apellidos}`;
    }

    const nuevoPaciente = await Paciente.create({
      nombres,
      apellidos,
      cedula,
      fechaNacimiento,
      edad,
      estadoSalud,
      direccion,
      telefono,
      correo,
      alergias,
      usuario,
      contrasena,
      laboratoristaId,
      nombreLaboratorista,
      sexo
    });

    res.status(201).json(nuevoPaciente);
  } catch (error) {
    console.error('Error al registrar paciente:', error);
    res.status(500).json({ mensaje: 'Error al registrar paciente' });
  }
};

// 📌 Obtener pacientes con múltiples filtros
exports.obtenerPacientes = async (req, res) => {
  try {
    const {
  busqueda = '',
  cedula = '',
  sexo,
  fechaDesde,
  fechaHasta,
  edadDesde,
  edadHasta
} = req.query;

    const condiciones = {};

    if (busqueda) {
      condiciones[Op.or] = [
        { nombres: { [Op.iLike]: `%${busqueda}%` } },
        { apellidos: { [Op.iLike]: `%${busqueda}%` } }
      ];
    }

    if (cedula) {
      condiciones.cedula = { [Op.iLike]: `%${cedula}%` };
    }

    if (sexo) {
      condiciones.sexo = sexo;
    }

    if (edadDesde && edadHasta) {
  condiciones.edad = {
    [Op.between]: [parseInt(edadDesde), parseInt(edadHasta)]
  };
} else if (edadDesde) {
  condiciones.edad = {
    [Op.gte]: parseInt(edadDesde)
  };
} else if (edadHasta) {
  condiciones.edad = {
    [Op.lte]: parseInt(edadHasta)
  };
}

    if (fechaDesde && fechaHasta) {
  const fechaInicio = new Date(fechaDesde + 'T00:00:00');
  const fechaFin = new Date(fechaHasta + 'T00:00:00');
  fechaFin.setDate(fechaFin.getDate() + 1); // ⬅️ suma 1 día para incluir todo el día del 16

  condiciones.createdAt = {
    [Op.gte]: fechaInicio,
    [Op.lt]: fechaFin // ⬅️ menor que el inicio del día siguiente
  };
}



    const pacientes = await Paciente.findAll({
      where: condiciones,
      order: [['createdAt', 'DESC']]
    });

    res.json(pacientes);
  } catch (error) {
    console.error('Error al obtener pacientes:', error);
    res.status(500).json({ mensaje: 'Error al obtener pacientes' });
  }
};

// 📌 Obtener paciente por ID
exports.obtenerPacientePorId = async (req, res) => {
  const { id } = req.params;
  try {
    const paciente = await Paciente.findByPk(id);
    if (!paciente) {
      return res.status(404).json({ mensaje: 'Paciente no encontrado' });
    }
    res.json(paciente);
  } catch (err) {
    res.status(500).json({ mensaje: 'Error al buscar paciente' });
  }
};

// 📌 Actualizar paciente
exports.actualizarPaciente = async (req, res) => {
  const { id } = req.params;
  try {
    const paciente = await Paciente.findByPk(id);
    if (!paciente) {
      return res.status(404).json({ mensaje: 'Paciente no encontrado' });
    }

    await paciente.update(req.body);
    res.json({ mensaje: 'Paciente actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar paciente:', error);
    res.status(500).json({ mensaje: 'Error al actualizar paciente' });
  }
};

// 📌 Eliminar paciente
exports.eliminarPaciente = async (req, res) => {
  const { id } = req.params;
  try {
    const paciente = await Paciente.findByPk(id);
    if (!paciente) {
      return res.status(404).json({ mensaje: 'Paciente no encontrado' });
    }

    await paciente.destroy();
    res.json({ mensaje: 'Paciente eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar paciente:', error);
    res.status(500).json({ mensaje: 'Error al eliminar paciente' });
  }
};

// 📌 Verificar existencia por cédula o nombre completo
exports.verificarExistencia = async (req, res) => {
  const { cedula, nombreCompleto } = req.query;
  try {
    const pacientes = await Paciente.findAll({
      where: {
        [Op.or]: [
          { cedula: { [Op.iLike]: `%${cedula}%` } },
          where(fn('concat', col('nombres'), ' ', col('apellidos')), {
            [Op.iLike]: `%${nombreCompleto}%`
          }),
          { nombres: { [Op.iLike]: `%${nombreCompleto}%` } },
          { apellidos: { [Op.iLike]: `%${nombreCompleto}%` } }
        ]
      }
    });

    res.json(pacientes);
  } catch (error) {
    console.error('Error al verificar existencia:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
