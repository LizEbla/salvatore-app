const db = require('../models');
const Paciente = db.Paciente;
const { Op, Sequelize } = require('sequelize');

// Función auxiliar para manejar fechas con zona horaria
function ajustarFechaParaZonaHoraria(fechaString, esInicioDelDia = true) {
  if (!fechaString) return null;
  
  const fecha = new Date(fechaString);
  
  // Si es el inicio del día (00:00:00)
  if (esInicioDelDia) {
    return new Date(Date.UTC(
      fecha.getUTCFullYear(),
      fecha.getUTCMonth(),
      fecha.getUTCDate(),
      0, 0, 0, 0
    ));
  } 
  // Si es el final del día (23:59:59)
  else {
    return new Date(Date.UTC(
      fecha.getUTCFullYear(),
      fecha.getUTCMonth(),
      fecha.getUTCDate(),
      23, 59, 59, 999
    ));
  }
}

// 🔍 Buscar pacientes con múltiples filtros - VERSIÓN CORREGIDA
exports.buscarConFiltros = async (req, res) => {
  const {
    busqueda,
    cedula,
    sexo,
    edadDesde,
    edadHasta,
    fechaDesde,
    fechaHasta,
    tipoBusqueda,
    fechaExacta
  } = req.query;

  console.log('Parámetros recibidos en el backend:', req.query);

  try {
    const whereConditions = [];

    // Búsqueda por nombre completo (nombres + apellidos)
    if (busqueda) {
      whereConditions.push({
        [Op.or]: [
          { nombres: { [Op.iLike]: `%${busqueda}%` } },
          { apellidos: { [Op.iLike]: `%${busqueda}%` } },
          Sequelize.where(
            Sequelize.fn('concat', Sequelize.col('nombres'), ' ', Sequelize.col('apellidos')),
            { [Op.iLike]: `%${busqueda}%` }
          )
        ]
      });
    }

    // Búsqueda específica por cédula
    if (cedula) {
      whereConditions.push({
        cedula: { [Op.iLike]: `%${cedula}%` }
      });
    }

    // Búsqueda por sexo
    if (sexo) {
      whereConditions.push({
        sexo: { [Op.iLike]: sexo }
      });
    }

    // Búsqueda por rango de edad
    if (edadDesde && edadHasta) {
      whereConditions.push({
        edad: {
          [Op.between]: [parseInt(edadDesde), parseInt(edadHasta)]
        }
      });
    } else if (edadDesde) {
      whereConditions.push({
        edad: { [Op.gte]: parseInt(edadDesde) }
      });
    } else if (edadHasta) {
      whereConditions.push({
        edad: { [Op.lte]: parseInt(edadHasta) }
      });
    }

    // 🔥 MANEJO CORREGIDO PARA FECHAS - SOLUCIÓN DEFINITIVA
    if (tipoBusqueda === 'fechaExacta' && fechaExacta) {
      console.log('Buscando por fecha exacta:', fechaExacta);
      
      // Convertir la fecha a UTC para evitar problemas de zona horaria
      const startOfDayUTC = ajustarFechaParaZonaHoraria(fechaExacta, true);
      const endOfDayUTC = ajustarFechaParaZonaHoraria(fechaExacta, false);
      
      console.log('Rango UTC ajustado:', startOfDayUTC, 'a', endOfDayUTC);
      
      whereConditions.push({
        createdAt: {
          [Op.between]: [startOfDayUTC, endOfDayUTC]
        }
      });
    } 
    // Búsqueda por rango de fechas (para otros tipos)
    else if (fechaDesde && fechaHasta) {
      const startDateUTC = ajustarFechaParaZonaHoraria(fechaDesde, true);
      const endDateUTC = ajustarFechaParaZonaHoraria(fechaHasta, false);
      
      console.log('Rango de fechas UTC:', startDateUTC, 'a', endDateUTC);
      
      whereConditions.push({
        createdAt: {
          [Op.between]: [startDateUTC, endDateUTC]
        }
      });
    } else if (fechaDesde) {
      const startDateUTC = ajustarFechaParaZonaHoraria(fechaDesde, true);
      whereConditions.push({
        createdAt: { [Op.gte]: startDateUTC }
      });
    } else if (fechaHasta) {
      const endDateUTC = ajustarFechaParaZonaHoraria(fechaHasta, false);
      whereConditions.push({
        createdAt: { [Op.lte]: endDateUTC }
      });
    }

    console.log('Condiciones finales de búsqueda:', JSON.stringify(whereConditions, null, 2));

    const pacientes = await Paciente.findAll({
      where: whereConditions.length > 0 ? { [Op.and]: whereConditions } : {},
      order: [['apellidos', 'ASC'], ['nombres', 'ASC']]
    });

    console.log(`Se encontraron ${pacientes.length} pacientes`);
    res.json(pacientes);
  } catch (error) {
    console.error('Error en la búsqueda con filtros:', error);
    res.status(500).json({ 
      mensaje: 'Error al buscar pacientes con filtros', 
      error: error.message 
    });
  }
};

// Función para debuggear pacientes existentes en una fecha específica
exports.debugPacientesPorFecha = async (req, res) => {
  const { fecha } = req.query;
  
  if (!fecha) {
    return res.status(400).json({ error: 'Parámetro fecha requerido' });
  }

  try {
    const startOfDayUTC = ajustarFechaParaZonaHoraria(fecha, true);
    const endOfDayUTC = ajustarFechaParaZonaHoraria(fecha, false);
    
    console.log('Buscando pacientes entre (UTC):', startOfDayUTC, 'y', endOfDayUTC);
    
    const pacientes = await Paciente.findAll({
      where: {
        createdAt: {
          [Op.between]: [startOfDayUTC, endOfDayUTC]
        }
      },
      order: [['createdAt', 'ASC']],
      attributes: ['id', 'cedula', 'nombres', 'apellidos', 'createdAt']
    });
    
    console.log(`Encontrados ${pacientes.length} pacientes en esta fecha:`);
    pacientes.forEach(p => {
      console.log(`- ${p.nombres} ${p.apellidos} (${p.cedula}): ${p.createdAt}`);
    });
    
    res.json({
      fecha: fecha,
      startOfDayUTC: startOfDayUTC,
      endOfDayUTC: endOfDayUTC,
      pacientes: pacientes,
      count: pacientes.length
    });
  } catch (error) {
    console.error('Error en debug:', error);
    res.status(500).json({ error: error.message });
  }
};

// Resto de las funciones del controlador (crear, obtener, actualizar, eliminar)
exports.crearPaciente = async (req, res) => {
  const {
    nombres, apellidos, cedula, fechaNacimiento, edad,
    estadoSalud, direccion, telefono, correo,
    alergias, usuario, contrasena, sexo
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
      nombres, apellidos, cedula, fechaNacimiento, edad,
      estadoSalud, direccion, telefono, correo,
      alergias, usuario, contrasena, sexo,
      laboratoristaId, nombreLaboratorista
    });

    res.status(201).json(nuevoPaciente);
  } catch (error) {
    console.error('Error al registrar paciente:', error);
    res.status(500).json({ mensaje: 'Error al registrar paciente' });
  }
};

exports.obtenerPacientes = async (req, res) => {
  try {
    const pacientes = await Paciente.findAll();
    res.json(pacientes);
  } catch (error) {
    console.error('Error al obtener pacientes:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

exports.obtenerPacientePorId = async (req, res) => {
  try {
    const paciente = await Paciente.findByPk(req.params.id);
    if (!paciente) {
      return res.status(404).json({ mensaje: 'Paciente no encontrado' });
    }
    res.json(paciente);
  } catch (error) {
    console.error('Error al obtener paciente por ID:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

exports.actualizarPaciente = async (req, res) => {
  try {
    const id = req.params.id;
    const [updated] = await Paciente.update(req.body, { where: { id } });
    if (updated === 0) {
      return res.status(404).json({ mensaje: 'Paciente no encontrado' });
    }
    res.json({ mensaje: 'Paciente actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar paciente:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

exports.eliminarPaciente = async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await Paciente.destroy({ where: { id } });
    if (deleted === 0) {
      return res.status(404).json({ mensaje: 'Paciente no encontrado' });
    }
    res.json({ mensaje: 'Paciente eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar paciente:', error);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

exports.buscarPacientes = async (req, res) => {
  const { cedula, nombreCompleto } = req.query;

  try {
    const whereConditions = [];

    if (cedula) {
      whereConditions.push({
        cedula: { [Op.iLike]: `%${cedula}%` }
      });
    }

    if (nombreCompleto) {
      whereConditions.push(
        Sequelize.where(
          Sequelize.fn(
            'concat',
            Sequelize.col('nombres'),
            ' ',
            Sequelize.col('apellidos')
          ),
          {
            [Op.iLike]: `%${nombreCompleto}%`
          }
        )
      );
    }

    const pacientes = await Paciente.findAll({
      where: {
        [Op.or]: whereConditions
      }
    });

    res.json(pacientes);
  } catch (error) {
    console.error('Error al buscar pacientes:', error);
    res.status(500).json({ message: 'Error en la búsqueda' });
  }
};

// Función para verificar existencia de paciente
exports.verificarExistencia = async (req, res) => {
  const { cedula, nombres, apellidos } = req.query;

  try {
    const whereConditions = [];

    if (cedula) {
      whereConditions.push({ cedula: { [Op.iLike]: `%${cedula}%` } });
    }

    if (nombres && apellidos) {
      whereConditions.push({
        [Op.and]: [
          { nombres: { [Op.iLike]: `%${nombres}%` } },
          { apellidos: { [Op.iLike]: `%${apellidos}%` } }
        ]
      });
    }

    const paciente = await Paciente.findOne({
      where: {
        [Op.or]: whereConditions
      }
    });

    res.json({ existe: !!paciente, paciente });
  } catch (error) {
    console.error('Error al verificar existencia:', error);
    res.status(500).json({ mensaje: 'Error al verificar existencia' });
  }
};
