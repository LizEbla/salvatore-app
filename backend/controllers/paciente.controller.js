const db = require('../models');
const { Op, Sequelize } = require('sequelize');

const Paciente = db.Paciente;

// 🧾 CRUD COMPLETO DE PACIENTES


// OBTENER TODOS LOS PACIENTES
const obtenerPacientes = async (req, res) => {
  try {
    const pacientes = await Paciente.findAll({
      order: [['apellidos', 'ASC'], ['nombres', 'ASC']]
    });
    res.json(pacientes);
  } catch (error) {
    console.error('Error al obtener pacientes:', error);
    res.status(500).json({ mensaje: 'Error al obtener pacientes' });
  }
};

// OBTENER PACIENTE POR ID
const obtenerPacientePorId = async (req, res) => {
  try {
    const paciente = await Paciente.findByPk(req.params.id);
    if (!paciente) return res.status(404).json({ mensaje: 'Paciente no encontrado' });
    res.json(paciente);
  } catch (error) {
    console.error('Error al obtener paciente por ID:', error);
    res.status(500).json({ mensaje: 'Error al obtener paciente por ID' });
  }
};

// ACTUALIZAR PACIENTE
const actualizarPaciente = async (req, res) => {
  try {
    const id = req.params.id;
    const [updated] = await Paciente.update(req.body, { 
      where: { id },
      returning: true 
    });
    
    if (updated === 0) return res.status(404).json({ mensaje: 'Paciente no encontrado' });
    
    const pacienteActualizado = await Paciente.findByPk(id);
    res.json({ 
      mensaje: 'Paciente actualizado correctamente',
      paciente: pacienteActualizado 
    });
  } catch (error) {
    console.error('Error al actualizar paciente:', error);
    res.status(500).json({ mensaje: 'Error al actualizar paciente' });
  }
};

// ELIMINAR PACIENTE
const eliminarPaciente = async (req, res) => {
  try {
    const id = req.params.id;
    const deleted = await Paciente.destroy({ where: { id } });
    if (deleted === 0) return res.status(404).json({ mensaje: 'Paciente no encontrado' });
    res.json({ mensaje: 'Paciente eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar paciente:', error);
    res.status(500).json({ mensaje: 'Error al eliminar paciente' });
  }
};

// 🔍 BÚSQUEDAS Y FILTROS

// BÚSQUEDA SIMPLE (cédula o nombre)
const buscarPacientes = async (req, res) => {
  const { cedula, nombreCompleto } = req.query;

  console.log('🔍 BACKEND - Parámetros recibidos:', { cedula, nombreCompleto });

  try {
    let whereCondition = {};

    if (cedula) {
      console.log('🔍 BUSCANDO POR CÉDULA:', cedula);
      whereCondition = { cedula: cedula };
    } else if (nombreCompleto) {
      console.log('🔍 BUSCANDO POR NOMBRE:', nombreCompleto);
      whereCondition = {
        [Op.or]: [
          { nombres: { [Op.iLike]: `%${nombreCompleto}%` } },
          { apellidos: { [Op.iLike]: `%${nombreCompleto}%` } },
          Sequelize.where(
            Sequelize.fn('concat', Sequelize.col('nombres'), ' ', Sequelize.col('apellidos')),
            { [Op.iLike]: `%${nombreCompleto}%` }
          )
        ]
      };
    }

    console.log('🔍 BACKEND - Condición final:', whereCondition);

    const pacientes = await Paciente.findAll({
      where: whereCondition,
      order: [['apellidos', 'ASC'], ['nombres', 'ASC']]
    });

    console.log(`✅ BACKEND - Búsqueda completada. Encontrados: ${pacientes.length} pacientes`);
    
    res.json(pacientes);
  } catch (error) {
    console.error('❌ BACKEND - Error en buscarPacientes:', error);
    res.status(500).json({ 
      message: 'Error en la búsqueda',
      error: error.message
    });
  }
};

// BÚSQUEDA CON FILTROS MÚLTIPLES
const buscarConFiltros = async (req, res) => {
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

  console.log('🔍 Parámetros de búsqueda recibidos:', {
    busqueda, cedula, sexo, edadDesde, edadHasta, 
    fechaDesde, fechaHasta, tipoBusqueda, fechaExacta
  });

  try {
    const whereConditions = [];

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

    if (cedula) {
      whereConditions.push({ cedula: cedula });
    }

    if (sexo) {
      whereConditions.push({ sexo: { [Op.iLike]: sexo } });
    }

    if (edadDesde && edadHasta) {
      whereConditions.push({ edad: { [Op.between]: [parseInt(edadDesde), parseInt(edadHasta)] } });
    } else if (edadDesde) {
      whereConditions.push({ edad: { [Op.gte]: parseInt(edadDesde) } });
    } else if (edadHasta) {
      whereConditions.push({ edad: { [Op.lte]: parseInt(edadHasta) } });
    }

    if (tipoBusqueda === 'fechaExacta' && fechaExacta) {
      console.log('🎯 Búsqueda por fecha exacta:', fechaExacta);
      whereConditions.push(
        Sequelize.where(
          Sequelize.fn(
            'DATE',
            Sequelize.cast(
              Sequelize.fn("timezone", "America/Guayaquil", Sequelize.col("createdAt")),
              "timestamp"
            )
          ),
          fechaExacta
        )
      );
    } else if (fechaDesde && fechaHasta) {
      const start = new Date(fechaDesde + 'T00:00:00');
      const end = new Date(fechaHasta + 'T23:59:59');
      whereConditions.push({ createdAt: { [Op.between]: [start, end] } });
    } else if (fechaDesde) {
      const start = new Date(fechaDesde + 'T00:00:00');
      whereConditions.push({ createdAt: { [Op.gte]: start } });
    } else if (fechaHasta) {
      const end = new Date(fechaHasta + 'T23:59:59');
      whereConditions.push({ createdAt: { [Op.lte]: end } });
    }

    const pacientes = await Paciente.findAll({
      where: whereConditions.length > 0 ? { [Op.and]: whereConditions } : {},
      order: [['apellidos', 'ASC'], ['nombres', 'ASC']],
      attributes: ['id', 'cedula', 'nombres', 'apellidos', 'edad', 'sexo', 'estadoSalud', 'createdAt']
    });

    console.log(`✅ BÚSQUEDA COMPLETADA. Encontrados: ${pacientes.length} pacientes`);
    res.json(pacientes);

  } catch (error) {
    console.error('❌ Error en la búsqueda con filtros:', error);
    res.status(500).json({ mensaje: 'Error al buscar pacientes con filtros', error: error.message });
  }
};

// VERIFICAR EXISTENCIA DE PACIENTE
const verificarExistencia = async (req, res) => {
  const { cedula, nombres, apellidos } = req.query;

  try {
    const whereConditions = [];

    if (cedula) {
      whereConditions.push({ cedula: cedula });
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
      where: { [Op.or]: whereConditions }
    });

    res.json({ existe: !!paciente, paciente });
  } catch (error) {
    console.error('Error al verificar existencia:', error);
    res.status(500).json({ mensaje: 'Error al verificar existencia' });
  }
};

// 🩺 DIAGNÓSTICOS ESPECÍFICOS DE PACIENTES

// DIAGNÓSTICO DE FECHAS
const diagnosticoFechas = async (req, res) => {
  const { fecha } = req.query;
  
  if (!fecha) {
    return res.status(400).json({ error: 'Parámetro fecha requerido' });
  }

  try {
    console.log('🩺 INICIANDO DIAGNÓSTICO PARA FECHA:', fecha);
    
    const start = ajustarFechaParaZonaHoraria(fecha, true);
    const end = ajustarFechaParaZonaHoraria(fecha, false);
    
    const todosPacientes = await Paciente.findAll({
      order: [['createdAt', 'ASC']],
      attributes: ['id', 'cedula', 'nombres', 'apellidos', 'createdAt']
    });

    const pacientesEnRango = await Paciente.findAll({
      where: { 
        createdAt: { 
          [Op.between]: [start, end] 
        } 
      },
      order: [['createdAt', 'ASC']],
      attributes: ['id', 'cedula', 'nombres', 'apellidos', 'createdAt']
    });

    const respuesta = {
      fechaSolicitada: fecha,
      rangoUTC: {
        start: start ? start.toISOString() : 'ERROR',
        end: end ? end.toISOString() : 'ERROR'
      },
      pacientesEnRango: pacientesEnRango.map(p => ({
        id: p.id,
        cedula: p.cedula,
        nombre: `${p.nombres} ${p.apellidos}`,
        createdAt: p.createdAt,
        createdAtLocal: new Date(p.createdAt).toLocaleString('es-EC', { 
          timeZone: 'America/Guayaquil' 
        })
      })),
      todosLosPacientes: todosPacientes.map(p => ({
        id: p.id,
        cedula: p.cedula,
        nombre: `${p.nombres} ${p.apellidos}`,
        createdAt: p.createdAt,
        fechaSimple: new Date(p.createdAt).toISOString().split('T')[0],
        fechaLocal: new Date(p.createdAt).toLocaleString('es-EC', { 
          timeZone: 'America/Guayaquil' 
        })
      })),
      estadisticas: {
        totalPacientes: todosPacientes.length,
        encontradosEnRango: pacientesEnRango.length,
        porcentaje: ((pacientesEnRango.length / todosPacientes.length) * 100).toFixed(2) + '%'
      }
    };

    console.log('📊 ESTADÍSTICAS:', respuesta.estadisticas);
    
    res.json(respuesta);
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    res.status(500).json({ error: error.message });
  }
};

// DEBUG PACIENTES POR FECHA
const debugPacientesPorFecha = async (req, res) => {
  const { fecha } = req.query;
  if (!fecha) {
    return res.status(400).json({ error: 'Parámetro fecha requerido' });
  }

  try {
    console.log('🔍 Debug fecha solicitada:', fecha);
    
    const start = ajustarFechaParaZonaHoraria(fecha, true);
    const end = ajustarFechaParaZonaHoraria(fecha, false);
    
    console.log('🕐 Rango UTC calculado:', { start, end });

    const pacientes = await Paciente.findAll({
      where: { 
        createdAt: { 
          [Op.between]: [start, end] 
        } 
      },
      order: [['createdAt', 'ASC']],
      attributes: ['id', 'cedula', 'nombres', 'apellidos', 'createdAt']
    });

    console.log(`📊 Pacientes encontrados en el rango: ${pacientes.length}`);

    res.json({
      fechaSolicitada: fecha,
      rangoUTC: { start, end },
      pacientes: pacientes.map(p => ({
        id: p.id,
        cedula: p.cedula,
        nombre: `${p.nombres} ${p.apellidos}`,
        createdAt: p.createdAt,
        createdAtLocal: new Date(p.createdAt).toLocaleString('es-EC')
      })),
      count: pacientes.length
    });
  } catch (error) {
    console.error('❌ Error en debugPacientesPorFecha:', error);
    res.status(500).json({ error: error.message });
  }
};

// DEBUG DATOS RECIBIDOS
const debugDatosRecibidos = async (req, res) => {
  try {
    console.log('🐛 DEBUG - HEADERS:', req.headers);
    console.log('🐛 DEBUG - BODY:', req.body);
    console.log('🐛 DEBUG - PARAMS:', req.params);
    console.log('🐛 DEBUG - QUERY:', req.query);

    res.json({
      success: true,
      message: 'Datos de debug',
      headers: req.headers,
      body: req.body,
      params: req.params,
      query: req.query,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error en debug:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// 🔧 FUNCIONES AUXILIARES

// FUNCIÓN PARA AJUSTAR FECHAS CON ZONA HORARIA
function ajustarFechaParaZonaHoraria(fechaString, esInicioDelDia = true) {
  if (!fechaString) return null;

  console.log('📅 Fecha recibida para ajuste:', fechaString);

  let fecha;
  
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(fechaString)) {
      const [year, month, day] = fechaString.split('-').map(Number);
      fecha = new Date(Date.UTC(year, month - 1, day));
    } else if (fechaString.includes('/')) {
      const parts = fechaString.split('/').map(Number);
      if (parts.length === 3) {
        const [day, month, year] = parts;
        if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
          console.error('❌ Fecha inválida:', fechaString);
          return null;
        }
        fecha = new Date(Date.UTC(year, month - 1, day));
      }
    } else {
      fecha = new Date(fechaString);
    }

    if (isNaN(fecha.getTime())) {
      console.error('❌ Fecha inválida después de parsing:', fechaString);
      return null;
    }

    console.log('✅ Fecha parseada correctamente:', fecha.toISOString());

    if (esInicioDelDia) {
      const inicioDia = new Date(Date.UTC(
        fecha.getUTCFullYear(),
        fecha.getUTCMonth(),
        fecha.getUTCDate(),
        0, 0, 0, 0
      ));
      console.log('🕐 Inicio del día (UTC):', inicioDia.toISOString());
      return inicioDia;
    } else {
      const finDia = new Date(Date.UTC(
        fecha.getUTCFullYear(),
        fecha.getUTCMonth(),
        fecha.getUTCDate(),
        23, 59, 59, 999
      ));
      console.log('🕐 Fin del día (UTC):', finDia.toISOString());
      return finDia;
    }
  } catch (error) {
    console.error('❌ Error en ajustarFechaParaZonaHoraria:', error);
    return null;
  }
}

const crearPaciente = async (req, res) => {
  // DEBUG COMPLETO DEL REQUEST
  console.log('🔍 DEBUG COMPLETO DEL REQUEST:');
  console.log('📋 Headers:', req.headers);
  console.log('🔐 Auth Header:', req.headers.authorization);
  console.log('👤 req.user:', req.user);
  console.log('📦 req.body:', req.body);
  
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
    
    // DEBUG DETALLADO DEL USUARIO
    if (req.user) {
      console.log('✅ USUARIO ENCONTRADO EN REQ.USER:');
      console.log('   ID:', req.user.id);
      console.log('   Nombres:', req.user.nombres);
      console.log('   Apellidos:', req.user.apellidos);
      console.log('   Tipo de usuario:', req.user.tipoUsuario);
      console.log('   Todos los campos:', Object.keys(req.user));
      
      laboratoristaId = req.user.id;
      nombreLaboratorista = `${req.user.nombres} ${req.user.apellidos}`;
    } else {
      console.log('❌ NO HAY USUARIO EN REQ.USER');
      console.log('   Posibles causas:');
      console.log('   - Middleware de auth no está siendo ejecutado');
      console.log('   - Token no válido o expirado');
      console.log('   - Ruta no protegida con middleware de auth');
    }

    console.log('📝 VALORES QUE SE GUARDARÁN:');
    console.log('   laboratoristaId:', laboratoristaId);
    console.log('   nombreLaboratorista:', nombreLaboratorista);

    const nuevoPaciente = await Paciente.create({
      nombres, apellidos, cedula, fechaNacimiento, edad,
      estadoSalud, direccion, telefono, correo,
      alergias, usuario, contrasena, sexo,
      laboratoristaId, 
      nombreLaboratorista
    });

    // VERIFICAR QUÉ SE GUARDÓ REALMENTE
    const pacienteCreado = await Paciente.findByPk(nuevoPaciente.id);
    console.log('✅ PACIENTE GUARDADO EN BD:');
    console.log('   ID:', pacienteCreado.id);
    console.log('   laboratoristaId:', pacienteCreado.laboratoristaId);
    console.log('   nombreLaboratorista:', pacienteCreado.nombreLaboratorista);

    res.status(201).json(nuevoPaciente);
  } catch (error) {
    console.error('❌ Error al registrar paciente:', error);
    res.status(500).json({ mensaje: 'Error al registrar paciente' });
  }
};

// En paciente.controller.js - AGREGAR ESTA FUNCIÓN
const debugUserInfo = async (req, res) => {
  console.log('🔍 DEBUG USER INFO:');
  console.log('Headers:', req.headers);
  console.log('User object:', req.user);
  console.log('Auth header:', req.header('Authorization'));
  
  res.json({
    user: req.user,
    headers: req.headers,
    authHeader: req.header('Authorization'),
    message: req.user ? 'Usuario autenticado' : 'No autenticado'
  });
};

module.exports = {
  // CRUD BÁSICO
  crearPaciente,
  obtenerPacientes,
  obtenerPacientePorId,
  actualizarPaciente,
  eliminarPaciente,
  
  // BÚSQUEDAS
  buscarPacientes,
  buscarConFiltros,
  verificarExistencia,
  
  // DIAGNÓSTICOS
  diagnosticoFechas,
  debugPacientesPorFecha,
  debugDatosRecibidos,
  debugUserInfo,
  
  // FUNCIONES AUXILIARES
  ajustarFechaParaZonaHoraria
};