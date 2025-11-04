const db = require('../models');
const { Op, Sequelize } = require('sequelize');

// Modelos
const { Laboratorista, Sucursal, ExamenPacienteDetalle, ExamenPaciente, Paciente, Examen, Subexamen } = db;

// 🏥 GESTIÓN DE SUCURSALES

// OBTENER TODAS LAS SUCURSALES ACTIVAS
const obtenerSucursales = async (req, res) => {
  try {
    const sucursales = await Sucursal.findAll({
      where: { activo: true },
      order: [['nombre', 'ASC']],
      attributes: ['id', 'nombre', 'direccion', 'telefono', 'ciudad', 'activo']
    });

    console.log(`✅ Se encontraron ${sucursales.length} sucursales activas`);

    res.json({
      success: true,
      data: sucursales,
      total: sucursales.length
    });
  } catch (error) {
    console.error('❌ Error obteniendo sucursales:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al obtener sucursales',
      error: error.message
    });
  }
};

// OBTENER SUCURSALES CON ESTADÍSTICAS
const obtenerSucursalesConEstadisticas = async (req, res) => {
  try {
    const sucursales = await Sucursal.findAll({
      where: { activo: true },
      include: [{
        model: Laboratorista,
        as: 'Laboratoristas',
        attributes: ['id'],
        required: false
      }],
      attributes: [
        'id', 
        'nombre', 
        'direccion', 
        'telefono', 
        'ciudad',
        'activo',
        [
          Sequelize.literal('(SELECT COUNT(*) FROM "Laboratorista" WHERE "Laboratorista"."sucursalId" = "Sucursal"."id")'),
          'totalLaboratoristas'
        ],
        [
          Sequelize.literal(`(
            SELECT COUNT(*) 
            FROM "examen_paciente_detalles" 
            WHERE "examen_paciente_detalles"."sucursalId" = "Sucursal"."id"
          )`),
          'totalExamenesRegistrados'
        ],
        [
          Sequelize.literal(`(
            SELECT COUNT(*) 
            FROM "examen_paciente_detalles" 
            WHERE "examen_paciente_detalles"."sucursalId" = "Sucursal"."id"
            AND "examen_paciente_detalles"."estado" = 'completado'
          )`),
          'examenesCompletados'
        ]
      ],
      order: [['nombre', 'ASC']]
    });

    console.log(`✅ Se encontraron ${sucursales.length} sucursales activas con estadísticas`);

    res.json({
      success: true,
      data: sucursales,
      total: sucursales.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo sucursales con estadísticas:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al obtener sucursales',
      error: error.message
    });
  }
};

// CREAR SUCURSAL
const crearSucursal = async (req, res) => {
  try {
    const { nombre, direccion, telefono, ciudad } = req.body;

    console.log('📝 Creando nueva sucursal:', { nombre, ciudad });

    // Validar campos requeridos
    if (!nombre) {
      return res.status(400).json({
        success: false,
        mensaje: 'El nombre de la sucursal es requerido'
      });
    }

    // Validar nombre único
    const existeSucursal = await Sucursal.findOne({ 
      where: { nombre } 
    });

    if (existeSucursal) {
      return res.status(400).json({
        success: false,
        mensaje: 'Ya existe una sucursal con ese nombre'
      });
    }

    const sucursal = await Sucursal.create({
      nombre: nombre.trim(),
      direccion: direccion || null,
      telefono: telefono || null,
      ciudad: ciudad || 'Guayaquil',
      activo: true
    });

    console.log(`✅ Sucursal creada: ${sucursal.nombre} (ID: ${sucursal.id})`);

    res.status(201).json({
      success: true,
      data: sucursal,
      mensaje: 'Sucursal creada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error creando sucursal:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al crear sucursal',
      error: error.message
    });
  }
};

// ACTUALIZAR SUCURSAL
const actualizarSucursal = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, direccion, telefono, ciudad, activo } = req.body;

    console.log('🔄 Actualizando sucursal ID:', id);

    const sucursal = await Sucursal.findByPk(id);

    if (!sucursal) {
      return res.status(404).json({
        success: false,
        mensaje: 'Sucursal no encontrada'
      });
    }

    // Validar nombre único si se está cambiando
    if (nombre && nombre !== sucursal.nombre) {
      const existeSucursal = await Sucursal.findOne({ 
        where: { nombre, id: { [Op.ne]: id } } 
      });

      if (existeSucursal) {
        return res.status(400).json({
          success: false,
          mensaje: 'Ya existe otra sucursal con ese nombre'
        });
      }
    }

    await sucursal.update({
      nombre: nombre || sucursal.nombre,
      direccion: direccion !== undefined ? direccion : sucursal.direccion,
      telefono: telefono !== undefined ? telefono : sucursal.telefono,
      ciudad: ciudad || sucursal.ciudad,
      activo: activo !== undefined ? activo : sucursal.activo
    });

    console.log(`✅ Sucursal actualizada: ${sucursal.nombre}`);

    res.json({
      success: true,
      data: sucursal,
      mensaje: 'Sucursal actualizada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error actualizando sucursal:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al actualizar sucursal',
      error: error.message
    });
  }
};

// ELIMINAR SUCURSAL (DESACTIVAR)
const eliminarSucursal = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Desactivando sucursal ID:', id);

    const sucursal = await Sucursal.findByPk(id);

    if (!sucursal) {
      return res.status(404).json({
        success: false,
        mensaje: 'Sucursal no encontrada'
      });
    }

    // Verificar si hay laboratoristas asignados
    const laboratoristasCount = await Laboratorista.count({
      where: { sucursalId: id }
    });

    if (laboratoristasCount > 0) {
      return res.status(400).json({
        success: false,
        mensaje: `No se puede desactivar la sucursal porque tiene ${laboratoristasCount} laboratorista(s) asignado(s)`
      });
    }

    // Desactivar la sucursal
    await sucursal.update({ activo: false });

    console.log(`✅ Sucursal desactivada: ${sucursal.nombre}`);

    res.json({
      success: true,
      mensaje: 'Sucursal desactivada exitosamente'
    });

  } catch (error) {
    console.error('❌ Error desactivando sucursal:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al desactivar sucursal',
      error: error.message
    });
  }
};

// 👨‍🔬 GESTIÓN DE LABORATORISTAS

// OBTENER TODOS LOS LABORATORISTAS
const obtenerLaboratoristas = async (req, res) => {
  try {
    const laboratoristas = await Laboratorista.findAll({
      include: [{
        model: Sucursal,
        as: 'Sucursal',
        attributes: ['id', 'nombre', 'ciudad']
      }],
      order: [['nombres', 'ASC'], ['apellidos', 'ASC']],
      attributes: ['id', 'nombres', 'apellidos', 'cedula', 'usuario', 'activo', 'sucursalId', 'createdAt']
    });

    console.log(`✅ Se encontraron ${laboratoristas.length} laboratoristas`);

    res.json({
      success: true,
      data: laboratoristas,
      total: laboratoristas.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo laboratoristas:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al obtener laboratoristas',
      error: error.message
    });
  }
};

// OBTENER LABORATORISTAS POR SUCURSAL
const obtenerLaboratoristasPorSucursal = async (req, res) => {
  try {
    const { sucursalId } = req.params;

    const laboratoristas = await Laboratorista.findAll({
      where: { 
        sucursalId: sucursalId,
        activo: true 
      },
      include: [{
        model: Sucursal,
        as: 'Sucursal',
        attributes: ['id', 'nombre']
      }],
      attributes: ['id', 'nombres', 'apellidos', 'cedula', 'usuario'],
      order: [['nombres', 'ASC']]
    });

    res.json({
      success: true,
      data: laboratoristas,
      total: laboratoristas.length
    });

  } catch (error) {
    console.error('❌ Error obteniendo laboratoristas por sucursal:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al obtener laboratoristas',
      error: error.message
    });
  }
};

// OBTENER LABORATORISTA POR ID
const obtenerLaboratoristaPorId = async (req, res) => {
  try {
    const { id } = req.params;

    const laboratorista = await Laboratorista.findByPk(id, {
      include: [{
        model: Sucursal,
        as: 'Sucursal',
        attributes: ['id', 'nombre', 'direccion', 'telefono', 'ciudad']
      }],
      attributes: { exclude: ['contrasena'] } // No enviar contraseña
    });

    if (!laboratorista) {
      return res.status(404).json({
        success: false,
        mensaje: 'Laboratorista no encontrado'
      });
    }

    res.json({
      success: true,
      data: laboratorista
    });

  } catch (error) {
    console.error('❌ Error obteniendo laboratorista:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al obtener laboratorista',
      error: error.message
    });
  }
};

// CREAR LABORATORISTA
const crearLaboratorista = async (req, res) => {
  try {
    const {
      nombres,
      apellidos,
      cedula,
      usuario,
      contrasena,
      sucursalId,
      telefono,
      correo,
      especialidad
    } = req.body;

    console.log('📝 Creando nuevo laboratorista:', { nombres, apellidos, cedula });

    // Validaciones
    if (!nombres || !apellidos || !cedula || !usuario || !contrasena) {
      return res.status(400).json({
        success: false,
        mensaje: 'Nombre, apellido, cédula, usuario y contraseña son requeridos'
      });
    }

    // Verificar cédula única
    const existeCedula = await Laboratorista.findOne({ where: { cedula } });
    if (existeCedula) {
      return res.status(400).json({
        success: false,
        mensaje: 'Ya existe un laboratorista con esta cédula'
      });
    }

    // Verificar usuario único
    const existeUsuario = await Laboratorista.findOne({ where: { usuario } });
    if (existeUsuario) {
      return res.status(400).json({
        success: false,
        mensaje: 'El nombre de usuario ya está en uso'
      });
    }

    // Verificar que la sucursal existe
    if (sucursalId) {
      const sucursal = await Sucursal.findByPk(sucursalId);
      if (!sucursal) {
        return res.status(400).json({
          success: false,
          mensaje: 'La sucursal especificada no existe'
        });
      }
    }

    const laboratorista = await Laboratorista.create({
      nombres: nombres.trim(),
      apellidos: apellidos.trim(),
      cedula,
      usuario: usuario.trim(),
      contrasena, // En un sistema real, esto debería estar encriptado
      sucursalId: sucursalId || null,
      telefono: telefono || null,
      correo: correo || null,
      especialidad: especialidad || null,
      activo: true
    });

    console.log(`✅ Laboratorista creado: ${laboratorista.nombres} ${laboratorista.apellidos}`);

    // No enviar contraseña en la respuesta
    const { contrasena: _, ...laboratoristaSinPassword } = laboratorista.toJSON();

    res.status(201).json({
      success: true,
      data: laboratoristaSinPassword,
      mensaje: 'Laboratorista creado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error creando laboratorista:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al crear laboratorista',
      error: error.message
    });
  }
};

// ACTUALIZAR LABORATORISTA
const actualizarLaboratorista = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombres,
      apellidos,
      cedula,
      usuario,
      contrasena,
      sucursalId,
      telefono,
      correo,
      especialidad,
      activo
    } = req.body;

    console.log('🔄 Actualizando laboratorista ID:', id);

    const laboratorista = await Laboratorista.findByPk(id);

    if (!laboratorista) {
      return res.status(404).json({
        success: false,
        mensaje: 'Laboratorista no encontrado'
      });
    }

    // Validar cédula única si se está cambiando
    if (cedula && cedula !== laboratorista.cedula) {
      const existeCedula = await Laboratorista.findOne({ 
        where: { cedula, id: { [Op.ne]: id } } 
      });
      if (existeCedula) {
        return res.status(400).json({
          success: false,
          mensaje: 'Ya existe otro laboratorista con esta cédula'
        });
      }
    }

    // Validar usuario único si se está cambiando
    if (usuario && usuario !== laboratorista.usuario) {
      const existeUsuario = await Laboratorista.findOne({ 
        where: { usuario, id: { [Op.ne]: id } } 
      });
      if (existeUsuario) {
        return res.status(400).json({
          success: false,
          mensaje: 'El nombre de usuario ya está en uso'
        });
      }
    }

    // Verificar que la sucursal existe
    if (sucursalId && sucursalId !== laboratorista.sucursalId) {
      const sucursal = await Sucursal.findByPk(sucursalId);
      if (!sucursal) {
        return res.status(400).json({
          success: false,
          mensaje: 'La sucursal especificada no existe'
        });
      }
    }

    const datosActualizacion = {
      nombres: nombres || laboratorista.nombres,
      apellidos: apellidos || laboratorista.apellidos,
      cedula: cedula || laboratorista.cedula,
      usuario: usuario || laboratorista.usuario,
      sucursalId: sucursalId !== undefined ? sucursalId : laboratorista.sucursalId,
      telefono: telefono !== undefined ? telefono : laboratorista.telefono,
      correo: correo !== undefined ? correo : laboratorista.correo,
      especialidad: especialidad !== undefined ? especialidad : laboratorista.especialidad,
      activo: activo !== undefined ? activo : laboratorista.activo
    };

    // Solo actualizar contraseña si se proporciona una nueva
    if (contrasena) {
      datosActualizacion.contrasena = contrasena;
    }

    await laboratorista.update(datosActualizacion);

    console.log(`✅ Laboratorista actualizado: ${laboratorista.nombres} ${laboratorista.apellidos}`);

    // No enviar contraseña en la respuesta
    const { contrasena: _, ...laboratoristaActualizado } = laboratorista.toJSON();

    res.json({
      success: true,
      data: laboratoristaActualizado,
      mensaje: 'Laboratorista actualizado exitosamente'
    });

  } catch (error) {
    console.error('❌ Error actualizando laboratorista:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al actualizar laboratorista',
      error: error.message
    });
  }
};

// ASIGNAR LABORATORISTA A UN DETALLE DE EXAMEN
const asignarLaboratorista = async (req, res) => {
  try {
    const { detalleId } = req.params;
    const { laboratoristaId } = req.body;

    if (!laboratoristaId) {
      return res.status(400).json({
        success: false,
        mensaje: 'ID de laboratorista es requerido'
      });
    }

    const detalle = await ExamenPacienteDetalle.findByPk(detalleId);
    
    if (!detalle) {
      return res.status(404).json({
        success: false,
        mensaje: 'Detalle de examen no encontrado'
      });
    }

    // Verificar que el laboratorista existe
    const laboratorista = await Laboratorista.findByPk(laboratoristaId);
    if (!laboratorista) {
      return res.status(404).json({
        success: false,
        mensaje: 'Laboratorista no encontrado'
      });
    }

    // Actualizar laboratorista y fecha de registro
    await detalle.update({
      laboratoristaId,
      fechaRegistro: new Date(),
      horaRegistro: new Date().toTimeString().split(' ')[0]
    });

    // Obtener el detalle actualizado con información del laboratorista
    const detalleActualizado = await ExamenPacienteDetalle.findByPk(detalleId, {
      include: [
        {
          model: Laboratorista,
          as: 'Laboratorista',
          attributes: ['id', 'nombres', 'apellidos']
        }
      ]
    });

    res.json({
      success: true,
      mensaje: `Laboratorista asignado correctamente: ${laboratorista.nombres} ${laboratorista.apellidos}`,
      data: detalleActualizado
    });

  } catch (error) {
    console.error('❌ Error asignando laboratorista:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor',
      error: error.message
    });
  }
};

// OBTENER INFORMACIÓN DE REGISTRO DE EXAMEN
const obtenerInformacionRegistro = async (req, res) => {
  try {
    const { detalleId } = req.params;

    const detalle = await ExamenPacienteDetalle.findByPk(detalleId, {
      include: [
        {
          model: Laboratorista,
          as: 'Laboratorista',
          attributes: ['id', 'nombres', 'apellidos', 'cedula']
        },
        {
          model: Examen,
          as: 'Examen',
          attributes: ['id', 'nombre']
        },
        {
          model: Subexamen,
          as: 'Subexamen',
          attributes: ['id', 'nombre']
        }
      ],
      attributes: [
        'id', 
        'fechaRegistro', 
        'horaRegistro', 
        'laboratorio', 
        'laboratoristaId',
        'examenId',
        'subexamenId'
      ]
    });

    if (!detalle) {
      return res.status(404).json({
        success: false,
        mensaje: 'No se encontró el registro del examen'
      });
    }

    // Determinar nombre del examen
    let nombreExamen = 'Examen no especificado';
    if (detalle.Examen) {
      nombreExamen = detalle.Examen.nombre;
    } else if (detalle.Subexamen) {
      nombreExamen = detalle.Subexamen.nombre;
    }

    const informacionRegistro = {
      id: detalle.id,
      nombreExamen,
      registradoPor: detalle.Laboratorista ? 
        `${detalle.Laboratorista.nombres} ${detalle.Laboratorista.apellidos}` : 
        'No asignado',
      cedulaLaboratorista: detalle.Laboratorista ? detalle.Laboratorista.cedula : 'N/A',
      fechaRegistro: detalle.fechaRegistro ? 
        new Date(detalle.fechaRegistro).toLocaleDateString('es-ES') : 
        'No registrada',
      horaRegistro: detalle.horaRegistro ? 
        new Date(`1970-01-01T${detalle.horaRegistro}`).toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit' 
        }) : 
        'No registrada',
      laboratorio: detalle.laboratorio || 'Laboratorio Central',
      laboratoristaId: detalle.laboratoristaId,
      tipo: detalle.subexamenId ? 'Subexamen' : 'Examen Principal'
    };

    res.json({
      success: true,
      data: informacionRegistro
    });

  } catch (error) {
    console.error('❌ Error obteniendo información de registro:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor',
      error: error.message
    });
  }
};

// OBTENER DETALLES CON LABORATORISTA POR PACIENTE
const obtenerDetallesConLaboratoristaPorPaciente = async (req, res) => {
  try {
    const { pacienteId } = req.params;

    const examenes = await ExamenPaciente.findAll({
      where: { pacienteId },
      include: [
        {
          model: Laboratorista,
          as: 'Laboratorista',
          attributes: ['id', 'nombres', 'apellidos']
        },
        {
          model: Paciente,
          as: 'Paciente',
          attributes: ['id', 'nombres', 'apellidos', 'cedula']
        },
        {
          model: ExamenPacienteDetalle,
          as: 'Detalles',
          include: [
            {
              model: Laboratorista,
              as: 'Laboratorista',
              attributes: ['id', 'nombres', 'apellidos', 'usuario']
            },
            {
              model: Examen,
              as: 'Examen',
              attributes: ['id', 'nombre'],
              include: [
                {
                  model: Area,
                  as: 'Area',
                  attributes: ['id', 'nombre']
                }
              ]
            },
            {
              model: Subexamen,
              as: 'Subexamen',
              attributes: ['id', 'nombre', 'metodo'],
              include: [
                {
                  model: Examen,
                  as: 'ExamenPadre',
                  attributes: ['id', 'nombre']
                }
              ]
            }
          ]
        }
      ],
      order: [['fechaAsignacion', 'DESC']]
    });

    // Estadísticas
    const totalExamenes = examenes.reduce((total, examen) => 
      total + (examen.Detalles ? examen.Detalles.length : 0), 0
    );

    const examenesConLaboratorista = examenes.reduce((total, examen) => {
      if (!examen.Detalles) return total;
      return total + examen.Detalles.filter(detalle => detalle.laboratoristaId).length;
    }, 0);

    res.json({
      success: true,
      data: examenes,
      estadisticas: {
        totalCabeceras: examenes.length,
        totalExamenes,
        examenesConLaboratorista,
        examenesSinLaboratorista: totalExamenes - examenesConLaboratorista,
        porcentajeAsignacion: totalExamenes > 0 ? 
          Math.round((examenesConLaboratorista / totalExamenes) * 100) : 0
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo detalles con laboratorista:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error interno del servidor',
      error: error.message
    });
  }
};

// 📊 REPORTES Y ESTADÍSTICAS

// OBTENER ESTADÍSTICAS DE LABORATORISTAS
const obtenerEstadisticasLaboratoristas = async (req, res) => {
  try {
    const estadisticas = await Laboratorista.findAll({
      attributes: [
        'id',
        'nombres',
        'apellidos',
        'cedula',
        [
          Sequelize.literal(`(
            SELECT COUNT(*) 
            FROM "examen_paciente_detalles" 
            WHERE "examen_paciente_detalles"."laboratoristaId" = "Laboratorista"."id"
          )`),
          'totalExamenesRegistrados'
        ],
        [
          Sequelize.literal(`(
            SELECT COUNT(*) 
            FROM "examen_paciente_detalles" 
            WHERE "examen_paciente_detalles"."laboratoristaId" = "Laboratorista"."id"
            AND "examen_paciente_detalles"."estado" = 'completado'
          )`),
          'examenesCompletados'
        ],
        [
          Sequelize.literal(`(
            SELECT COUNT(*) 
            FROM "examen_paciente_detalles" 
            WHERE "examen_paciente_detalles"."laboratoristaId" = "Laboratorista"."id"
            AND DATE("examen_paciente_detalles"."createdAt") = CURRENT_DATE
          )`),
          'examenesHoy'
        ]
      ],
      include: [{
        model: Sucursal,
        as: 'Sucursal',
        attributes: ['id', 'nombre']
      }],
      where: { activo: true },
      order: [[Sequelize.literal('"totalExamenesRegistrados"'), 'DESC']]
    });

    // Estadísticas generales
    const totalLaboratoristas = estadisticas.length;
    const totalExamenesRegistrados = estadisticas.reduce((sum, lab) => 
      sum + (parseInt(lab.get('totalExamenesRegistrados')) || 0), 0
    );
    const totalExamenesCompletados = estadisticas.reduce((sum, lab) => 
      sum + (parseInt(lab.get('examenesCompletados')) || 0), 0
    );

    res.json({
      success: true,
      data: {
        laboratoristas: estadisticas,
        resumen: {
          totalLaboratoristas,
          totalExamenesRegistrados,
          totalExamenesCompletados,
          porcentajeCompletados: totalExamenesRegistrados > 0 ? 
            Math.round((totalExamenesCompletados / totalExamenesRegistrados) * 100) : 0
        }
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas de laboratoristas:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error al obtener estadísticas',
      error: error.message
    });
  }
};

// 🔧 FUNCIONES DE DIAGNÓSTICO Y MIGRACIÓN

// DIAGNÓSTICO DE SUCURSALES Y LABORATORISTAS
const diagnosticarSucursales = async (req, res) => {
  try {
    console.log('🔍 DIAGNÓSTICO COMPLETO DE SUCURSALES Y LABORATORISTAS');
    
    // 1. Verificar estructura de tablas
    const estructura = await db.sequelize.query(`
      SELECT table_name, column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name IN ('Sucursales', 'Laboratorista', 'examen_paciente_detalles')
      ORDER BY table_name, ordinal_position;
    `);

    // 2. Contar registros
    const totalSucursales = await Sucursal.count();
    const totalLaboratoristas = await Laboratorista.count();
    const laboratoristasConSucursal = await Laboratorista.count({
      where: { sucursalId: { [Op.ne]: null } }
    });
    const detallesConLaboratorista = await ExamenPacienteDetalle.count({
      where: { laboratoristaId: { [Op.ne]: null } }
    });

    // 3. Obtener ejemplos
    const sucursalesEjemplo = await Sucursal.findAll({
      limit: 5,
      attributes: ['id', 'nombre', 'ciudad', 'activo']
    });

    const laboratoristasEjemplo = await Laboratorista.findAll({
      where: { sucursalId: { [Op.ne]: null } },
      limit: 5,
      include: [{
        model: Sucursal,
        as: 'Sucursal',
        attributes: ['id', 'nombre']
      }],
      attributes: ['id', 'nombres', 'apellidos', 'sucursalId']
    });

    res.json({
      success: true,
      diagnostico: {
        tablas: estructura[0],
        estadisticas: {
          totalSucursales,
          totalLaboratoristas,
          laboratoristasConSucursal,
          detallesConLaboratorista,
          porcentajeLaboratoristasConSucursal: ((laboratoristasConSucursal / totalLaboratoristas) * 100).toFixed(2) + '%',
          porcentajeDetallesConLaboratorista: ((detallesConLaboratorista / await ExamenPacienteDetalle.count()) * 100).toFixed(2) + '%'
        },
        sucursalesEjemplo,
        laboratoristasEjemplo
      }
    });

  } catch (error) {
    console.error('❌ Error en diagnóstico de sucursales:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
};

// MIGRAR LABORATORISTAS EXISTENTES A SUCURSALES
const migrarLaboratoristasASucursales = async (req, res) => {
  try {
    console.log('🔄 INICIANDO MIGRACIÓN DE LABORATORISTAS A SUCURSALES');
    
    // 1. Crear sucursal por defecto si no existe
    const [sucursalPrincipal, created] = await Sucursal.findOrCreate({
      where: { nombre: 'Sucursal Principal' },
      defaults: {
        nombre: 'Sucursal Principal',
        direccion: 'Dirección principal',
        ciudad: 'Guayaquil',
        activo: true
      }
    });

    console.log(`🏥 Sucursal principal: ${sucursalPrincipal.nombre} (ID: ${sucursalPrincipal.id})`);

    // 2. Actualizar laboratoristas existentes
    const resultado = await Laboratorista.update({
      sucursalId: sucursalPrincipal.id
    }, {
      where: {
        sucursalId: null
      }
    });

    console.log(`✅ Laboratoristas actualizados: ${resultado[0]}`);

    // 3. Verificar resultado
    const laboratoristasActualizados = await Laboratorista.findAll({
      where: { sucursalId: sucursalPrincipal.id },
      attributes: ['id', 'nombres', 'apellidos', 'sucursalId'],
      limit: 10
    });

    res.json({
      success: true,
      mensaje: `Migración completada: ${resultado[0]} laboratoristas asignados a sucursal principal`,
      sucursal: sucursalPrincipal,
      ejemplos: laboratoristasActualizados
    });

  } catch (error) {
    console.error('❌ Error en migración:', error);
    res.status(500).json({
      success: false,
      mensaje: 'Error en migración',
      error: error.message
    });
  }
};

module.exports = {
  // GESTIÓN DE SUCURSALES
  obtenerSucursales,
  obtenerSucursalesConEstadisticas,
  crearSucursal,
  actualizarSucursal,
  eliminarSucursal,
  
  // GESTIÓN DE LABORATORISTAS
  obtenerLaboratoristas,
  obtenerLaboratoristasPorSucursal,
  obtenerLaboratoristaPorId,
  crearLaboratorista,
  actualizarLaboratorista,
  
  // ASIGNACIÓN Y REGISTROS
  asignarLaboratorista,
  obtenerInformacionRegistro,
  obtenerDetallesConLaboratoristaPorPaciente,
  
  // REPORTES Y ESTADÍSTICAS
  obtenerEstadisticasLaboratoristas,
  
  // DIAGNÓSTICO Y MIGRACIÓN
  diagnosticarSucursales,
  migrarLaboratoristasASucursales
};