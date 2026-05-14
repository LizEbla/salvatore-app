//controller/paciente.controller.js

const db = require('../models');
const { Op, Sequelize } = require('sequelize');
const bcrypt = require('bcryptjs');


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



// En paciente.controller.js - AGREGAR ESTA FUNCIÓN
const debugUserInfo = async (req, res) => {
  console.log('🔍 DEBUG USER INFO:');
  console.log('Headers:', req.headers);
  console.log('User object:', req.usuario);
  console.log('Auth header:', req.header('Authorization'));
  
  res.json({
    user: req.usuario,
    headers: req.headers,
    authHeader: req.header('Authorization'),
    message: req.usuario ? 'Usuario autenticado' : 'No autenticado'
  });
};



const crearPaciente = async (req, res) => {
  console.log('📌 Registro de paciente iniciado');
  console.log('📦 Datos recibidos:', req.body);

  try {
    const {
      nombres, apellidos, cedula, fechaNacimiento, edad,
      estadoSalud, direccion, telefono, correo,
      alergias, usuario, claveAcceso, sexo
    } = req.body;

    // ✅ 0) Validaciones mínimas
    if (!nombres || !apellidos || !cedula || !fechaNacimiento) {
      return res.status(400).json({
        mensaje: 'Faltan campos obligatorios: nombres, apellidos, cedula, fechaNacimiento'
      });
    }

    // ✅ 1) Usuario y clave por defecto si no llegan (según tu requerimiento)
    const usuarioFinal = (usuario && String(usuario).trim()) ? String(usuario).trim() : String(cedula).trim();

    // claveAcceso: si no llega, se arma ddmmyyyy desde fechaNacimiento
    const claveAccesoFinal = (claveAcceso && String(claveAcceso).trim())
      ? String(claveAcceso).trim()
      : (() => {
          const d = new Date(fechaNacimiento);
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yyyy = String(d.getFullYear());
          return `${dd}${mm}${yyyy}`;
        })();

    const contrasena = claveAccesoFinal;

    // ✅ 2) Verificar duplicados (cédula o usuario)
    const existe = await Paciente.findOne({
      where: { [Op.or]: [{ cedula }, { usuario: usuarioFinal }] }
    });

    if (existe) {
      return res.status(409).json({ mensaje: 'El paciente ya está registrado.' });
    }

    // ✅ 3) Encriptar contraseña
    const contrasenaHash = await bcrypt.hash(contrasena, 10);

    // ✅ 4) Tomar usuario autenticado desde el middleware (NO req.usuario)
    // Ajustado a tu caso: intenta varios posibles campos
    const auth = req.user || req.usuario || req.auth || null;

    const laboratoristaId =
      auth?.id ||
      auth?.laboratoristaId ||
      null;

    const nombreLaboratorista =
      auth?.nombres && auth?.apellidos ? `${auth.nombres} ${auth.apellidos}` :
      auth?.nombre ? auth.nombre :
      auth?.usuario ? auth.usuario :
      null;

    console.log('🧪 auth payload:', auth);
    console.log('🧪 laboratoristaId:', laboratoristaId);
    console.log('🧪 nombreLaboratorista:', nombreLaboratorista);

    // ✅ 5) Crear paciente
    const nuevoPaciente = await Paciente.create({
      nombres, apellidos, cedula, fechaNacimiento, edad,
      estadoSalud, direccion, telefono, correo,
      alergias, sexo,

      usuario: usuarioFinal,
      claveAcceso: claveAccesoFinal,     // ✅ visible
      contrasenaHash,                    // ✅ encriptada

      laboratoristaId,
      nombreLaboratorista
    });

    return res.status(201).json({
      mensaje: 'Paciente registrado correctamente ✅',
      paciente: nuevoPaciente
    });

  } catch (error) {
    console.error('❌ Error al registrar paciente:', error);
    return res.status(500).json({
      mensaje: 'Error al registrar paciente',
      error: error.message
    });
  }
};



const getExamenesPendientes = async (req, res) => {
  try {
    const { estado = 'pendiente' } = req.query;

    console.log('🔍 Parámetros recibidos para exámenes pendientes:', req.query);

    const db = require('../models');
    const { ExamenPacienteDetalle, ExamenPaciente, Paciente, Laboratorista, Sucursal } = db;

    // Consulta usando SOLO columnas que existen según tu modelo
    const examenesPendientes = await ExamenPacienteDetalle.findAll({
      where: { estado: estado },
      include: [
        {
          model: ExamenPaciente,
          as: 'Cabecera',
          required: true,
          include: [
            {
              model: Paciente,
              as: 'Paciente',
              required: true,
              attributes: ['id', 'nombres', 'apellidos', 'cedula', 'edad', 'sexo', 'telefono', 'correo']
            }
          ]
        },
        {
          model: Laboratorista,
          as: 'Laboratorista',
          required: false,
          attributes: ['id', 'nombres', 'apellidos', 'cedula', 'telefono', 'especialidad']
        },
        {
          model: Sucursal,
          as: 'Sucursal',
          required: false,
          attributes: ['id', 'nombre', 'direccion', 'telefono', 'ciudad']
        }
      ],
      // SOLO columnas que EXISTEN según tu modelo
      attributes: [
        'id', 
        'examenPacienteId', 
        'examenId',
        'subexamenId',
        'nombreExamen', 
        'estado', 
        'createdAt', 
        'updatedAt',
        'precioAplicado',
        'descuentoAplicado',
        'precioFinal', 
        'observaciones', 
        'laboratoristaId', 
        'sucursalId', 
        'registradoPor', // ✅ Esta SÍ existe
        'fechaRegistro', 
        'horaRegistro', 
        'laboratorio',
        'esSubexamen',
        'fechaCompletado',
        'medicoSolicitanteDetalle',
        'conPromocion',
        'promocionId'
        // ❌ NO incluir 'asignadoPor' - NO existe
      ],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    console.log(`✅ Exámenes pendientes encontrados: ${examenesPendientes.length}`);

    // Formatear respuesta completa
    const datosFormateados = examenesPendientes.map(item => {
      const fechaRegistro = item.fechaRegistro || item.createdAt;
      
      // Determinar tipo de examen
      const tipoExamen = item.esSubexamen ? 'Subexamen' : 'Examen Principal';
      
      // Formatear fechas
      const fechaFormateada = fechaRegistro ? 
        new Date(fechaRegistro).toLocaleDateString('es-EC', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit' 
        }) : 'Sin fecha';
      
      const horaFormateada = item.horaRegistro || 
        (fechaRegistro ? 
          new Date(fechaRegistro).toLocaleTimeString('es-EC', {
            hour: '2-digit',
            minute: '2-digit'
          }) : 'Sin hora');

      return {
        // Información principal
        id: item.id,
        detalleId: item.id,
        examenPacienteId: item.examenPacienteId,
        nombreExamen: item.nombreExamen,
        estado: item.estado,
        tipoExamen: tipoExamen,
        
        // Precios
        precioAplicado: item.precioAplicado,
        descuentoAplicado: item.descuentoAplicado,
        precioFinal: item.precioFinal,
        conPromocion: item.conPromocion || false,
        
        // Observaciones y médico
        observaciones: item.observaciones || '',
        medicoSolicitanteDetalle: item.medicoSolicitanteDetalle || '',
        
        // Fechas
        fechaRegistro: fechaRegistro,
        fechaRegistroFormateada: fechaFormateada,
        horaRegistroFormateada: horaFormateada,
        fechaActualizacion: item.updatedAt,
        fechaCompletado: item.fechaCompletado,
        
        // Información del paciente
        paciente: item.Cabecera?.Paciente ? {
          id: item.Cabecera.Paciente.id,
          nombres: item.Cabecera.Paciente.nombres,
          apellidos: item.Cabecera.Paciente.apellidos,
          nombreCompleto: `${item.Cabecera.Paciente.nombres} ${item.Cabecera.Paciente.apellidos}`,
          cedula: item.Cabecera.Paciente.cedula,
          telefono: item.Cabecera.Paciente.telefono,
          edad: item.Cabecera.Paciente.edad,
          sexo: item.Cabecera.Paciente.sexo,
          correo: item.Cabecera.Paciente.correo
        } : null,
        
        // Laboratorista asignado (desde include)
        laboratorista: item.Laboratorista ? {
          id: item.Laboratorista.id,
          nombreCompleto: `${item.Laboratorista.nombres} ${item.Laboratorista.apellidos}`,
          cedula: item.Laboratorista.cedula,
          telefono: item.Laboratorista.telefono,
          especialidad: item.Laboratorista.especialidad
        } : item.laboratoristaId ? {
          id: item.laboratoristaId,
          nombreCompleto: `Laboratorista ID: ${item.laboratoristaId}`
        } : null,
        
        // Quién registró (DIRECTAMENTE de la base de datos)
        registradoPor: item.registradoPor || 'No especificado',
        
        // Sucursal (desde include)
        sucursal: item.Sucursal ? {
          id: item.Sucursal.id,
          nombre: item.Sucursal.nombre,
          direccion: item.Sucursal.direccion,
          telefono: item.Sucursal.telefono,
          ciudad: item.Sucursal.ciudad
        } : item.sucursalId ? {
          id: item.sucursalId,
          nombre: `Sucursal ID: ${item.sucursalId}`
        } : {
          nombre: item.laboratorio || 'Laboratorio Central',
          tipo: 'laboratorio'
        },
        
        // Información de la cabecera
        cabecera: {
          id: item.Cabecera?.id,
          fechaAsignacion: item.Cabecera?.fechaAsignacion,
          medicoSolicitante: item.Cabecera?.medicoSolicitante || '',
          estadoPago: item.Cabecera?.estadoPago || 'pendiente',
          total: item.Cabecera?.total,
          abono: item.Cabecera?.abono,
          saldoPendiente: item.Cabecera?.saldoPendiente
        },
        
        // IDs para referencia
        ids: {
          examenId: item.examenId,
          subexamenId: item.subexamenId,
          laboratoristaId: item.laboratoristaId,
          sucursalId: item.sucursalId,
          promocionId: item.promocionId
        },
        
        // Información técnica
        laboratorio: item.laboratorio || 'Laboratorio Central',
        esSubexamen: item.esSubexamen || false
      };
    });

    res.json({
      success: true,
      data: datosFormateados,
      count: datosFormateados.length,
      message: 'Exámenes pendientes obtenidos correctamente',
      estadisticas: {
        total: datosFormateados.length,
        conLaboratorista: datosFormateados.filter(d => d.laboratorista).length,
        conSucursal: datosFormateados.filter(d => d.sucursal && d.sucursal.id).length,
        conRegistradoPor: datosFormateados.filter(d => d.registradoPor !== 'No especificado').length,
        examenesPrincipales: datosFormateados.filter(d => !d.esSubexamen).length,
        subexamenes: datosFormateados.filter(d => d.esSubexamen).length
      }
    });

  } catch (error) {
    console.error('❌ Error al obtener exámenes pendientes:', error);
    
    // Versión de emergencia más simple
    try {
      const db = require('../models');
      const { ExamenPacienteDetalle } = db;
      
      const datosBasicos = await ExamenPacienteDetalle.findAll({
        where: { estado: 'pendiente' },
        attributes: ['id', 'nombreExamen', 'estado', 'createdAt', 'registradoPor', 'precioFinal'],
        order: [['createdAt', 'DESC']],
        limit: 20,
        raw: true
      });
      
      const datosSimples = datosBasicos.map(item => ({
        id: item.id,
        nombreExamen: item.nombreExamen,
        estado: item.estado,
        precioFinal: item.precioFinal,
        fechaRegistro: item.createdAt,
        fechaRegistroFormateada: item.createdAt ? 
          new Date(item.createdAt).toLocaleDateString('es-EC') : 'Sin fecha',
        registradoPor: item.registradoPor || 'No especificado'
      }));
      
      res.json({
        success: true,
        data: datosSimples,
        count: datosSimples.length,
        message: 'Datos básicos obtenidos'
      });
    } catch (fallbackError) {
      res.status(500).json({ 
        success: false, 
        message: 'Error al obtener exámenes pendientes',
        error: error.message,
        detalle: 'Verificar que las columnas en attributes existen en el modelo'
      });
    }
  }
};



const debugAsociaciones = async (req, res) => {
  try {
    const db = require('../models');
    const { ExamenPaciente, ExamenPacienteDetalle } = db;
    
    res.json({
      ExamenPaciente_associations: Object.keys(ExamenPaciente.associations || {}),
      ExamenPacienteDetalle_associations: Object.keys(ExamenPacienteDetalle.associations || {}),
      ExamenPaciente_associations_detalles: ExamenPaciente.associations || {},
      ExamenPacienteDetalle_associations_detalles: ExamenPacienteDetalle.associations || {}
    });
  } catch (error) {
    console.error('Error en debugAsociaciones:', error);
    res.status(500).json({ error: error.message });
  }
};

// En paciente.controller.js, agrega:
const debugAsociacionesExamenDetalle = async (req, res) => {
  try {
    const db = require('../models');
    const { ExamenPacienteDetalle } = db;
    
    const asociaciones = {};
    
    if (ExamenPacienteDetalle.associations) {
      Object.keys(ExamenPacienteDetalle.associations).forEach(key => {
        const assoc = ExamenPacienteDetalle.associations[key];
        asociaciones[key] = {
          target: assoc.target.name,
          associationType: assoc.associationType,
          options: {
            as: assoc.options.as,
            foreignKey: assoc.options.foreignKey
          }
        };
      });
    }
    
    res.json({
      modelo: 'ExamenPacienteDetalle',
      asociaciones: asociaciones,
      todasLasKeys: Object.keys(ExamenPacienteDetalle.associations || {})
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// En paciente.routes.js:
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
  getExamenesPendientes,
  debugAsociaciones,
  debugAsociacionesExamenDetalle,
  // FUNCIONES AUXILIARES
  ajustarFechaParaZonaHoraria
};