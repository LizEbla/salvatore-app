// laboratorista.controller.js - VERSIÓN COMPLETA CORREGIDA

const { Op } = require('sequelize');
const bcrypt = require('bcrypt');

// ✅ IMPORTAR CORRECTAMENTE DESDE models/index.js
const db = require('../models');

// ✅ USAR LOS MODELOS DEL db
const Laboratorista = db.Laboratorista;
const Sucursal = db.Sucursal;

console.log('🔍 Verificando modelos en controlador:');
console.log('   db.Laboratorista:', !!db.Laboratorista);
console.log('   db.Sucursal:', !!db.Sucursal);
console.log('   Laboratorista (variable):', !!Laboratorista);
console.log('   Sucursal (variable):', !!Sucursal);

// Si por alguna razón no se cargaron, cargarlos manualmente
if (!Laboratorista || !Sucursal) {
  console.log('⚠️ Modelos no cargados desde db, cargando manualmente...');
  const { DataTypes } = require('sequelize');
  const sequelize = require('../config/db');
  
  if (!Laboratorista) {
    const Laboratorista = require('../models/Laboratorista')(sequelize, DataTypes);
  }
  
  if (!Sucursal) {
    const Sucursal = require('../models/sucursal.model')(sequelize, DataTypes);
  }
}

// Crear un nuevo laboratorista
exports.crearLaboratorista = async (req, res) => {
  try {
    // Verificar que Laboratorista esté definido
    if (!Laboratorista) {
      return res.status(500).json({
        success: false,
        message: 'Error: Modelo Laboratorista no disponible'
      });
    }

    const { nombres, apellidos, cedula, celular, correo, usuario, contrasena, especialidad, sucursalId } = req.body;

    if (!nombres || !apellidos || !cedula || !celular || !correo || !usuario || !contrasena) {
      return res.status(400).json({ 
        success: false,
        message: 'Todos los campos obligatorios son requeridos.' 
      });
    }

    const existeCedula = await Laboratorista.findOne({ where: { cedula } });
    if (existeCedula) {
      return res.status(400).json({ 
        success: false,
        message: 'La cédula ya está registrada.' 
      });
    }

    const existeUsuario = await Laboratorista.findOne({ where: { usuario } });
    if (existeUsuario) {
      return res.status(400).json({ 
        success: false,
        message: 'El nombre de usuario ya está en uso.' 
      });
    }

    // Encriptar la contraseña
    const hashedPassword = await bcrypt.hash(contrasena, 10);

    const nuevo = await Laboratorista.create({
      nombres,
      apellidos,
      cedula,
      celular,
      correo,
      usuario,
      contrasena: hashedPassword,
      especialidad: especialidad || null,
      sucursalId: sucursalId || null,
      rol: 'laboratorista',
      activo: true
    });

    res.status(201).json({
      success: true,
      message: 'Laboratorista creado exitosamente',
      data: nuevo
    });
  } catch (error) {
    console.error('Error al crear laboratorista:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error interno del servidor.',
      error: error.message 
    });
  }
};

// Editar un laboratorista por ID
exports.editarLaboratoristas = async (req, res) => {
  try {
    if (!Laboratorista) {
      return res.status(500).json({
        success: false,
        message: 'Error: Modelo Laboratorista no disponible'
      });
    }

    const id = req.params.id;
    const {
      nombres,
      apellidos,
      cedula,
      celular,
      correo,
      usuario,
      contrasena,
      especialidad,
      sucursalId 
    } = req.body;

    const laboratorista = await Laboratorista.findByPk(id);
    if (!laboratorista) {
      return res.status(404).json({ 
        success: false,
        message: 'Laboratorista no encontrado.' 
      });
    }

    // Actualizar campos
    laboratorista.nombres = nombres;
    laboratorista.apellidos = apellidos;
    laboratorista.cedula = cedula;
    laboratorista.celular = celular;
    laboratorista.correo = correo;
    laboratorista.usuario = usuario;
    laboratorista.especialidad = especialidad || null;
    laboratorista.sucursalId = sucursalId || null;

    // Cambiar contraseña si se proporciona
    if (contrasena && contrasena.trim() !== '') {
      const hashedPassword = await bcrypt.hash(contrasena, 10);
      laboratorista.contrasena = hashedPassword;
    }

    await laboratorista.save();
    res.status(200).json({ 
      success: true,
      message: 'Laboratorista actualizado correctamente.',
      data: laboratorista 
    });

  } catch (error) {
    console.error('Error al editar laboratorista:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al editar laboratorista.' 
    });
  }
};

// Eliminar un laboratorista por ID
exports.eliminarLaboratorista = async (req, res) => {
  try {
    if (!Laboratorista) {
      return res.status(500).json({
        success: false,
        message: 'Error: Modelo Laboratorista no disponible'
      });
    }

    const id = req.params.id;

    const laboratorista = await Laboratorista.findByPk(id);
    if (!laboratorista) {
      return res.status(404).json({ 
        success: false,
        message: 'Laboratorista no encontrado.' 
      });
    }

    await laboratorista.destroy();
    res.status(200).json({ 
      success: true,
      message: 'Laboratorista eliminado correctamente.' 
    });
  } catch (error) {
    console.error('Error al eliminar laboratorista:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al eliminar laboratorista.' 
    });
  }
};

// Obtener un laboratorista por ID
exports.obtenerLaboratoristasPorId = async (req, res) => {
  try {
    if (!Laboratorista || !Sucursal) {
      return res.status(500).json({
        success: false,
        message: 'Error: Modelos no disponibles'
      });
    }

    const { id } = req.params;
    console.log('Solicitud para obtener laboratorista con ID:', id);

    const laboratorista = await Laboratorista.findByPk(id, {
      attributes: { exclude: ['contrasena'] },
      include: [
        {
          model: Sucursal,
          as: 'Sucursal',
          attributes: ['id', 'nombre', 'ciudad']
        }
      ]
    });
    
    console.log('Resultado de la consulta:', laboratorista);

    if (laboratorista) {
      res.json({
        success: true,
        data: laboratorista
      });
    } else {
      res.status(404).json({ 
        success: false,
        message: 'Laboratorista no encontrado' 
      });
    }
  } catch (error) {
    console.error('Error al obtener laboratorista por ID:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error del servidor',
      error: error.message 
    });
  }
};

// Verificar cédula duplicada
exports.verificarCedulaDuplicada = async (req, res) => {
  try {
    if (!Laboratorista) {
      return res.status(500).json({
        success: false,
        message: 'Error: Modelo Laboratorista no disponible'
      });
    }

    const { cedula } = req.params;
    const existente = await Laboratorista.findOne({ where: { cedula } });
    res.json({ 
      success: true,
      existe: !!existente 
    });
  } catch (error) {
    console.error('Error al verificar cédula:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error en el servidor',
      error: error.message 
    });
  }
};

// Verificar usuario duplicado
exports.verificarUsuarioDuplicado = async (req, res) => {
  try {
    if (!Laboratorista) {
      return res.status(500).json({
        success: false,
        message: 'Error: Modelo Laboratorista no disponible'
      });
    }

    const { usuario } = req.params;
    const existe = await Laboratorista.findOne({ where: { usuario } });
    res.json({ 
      success: true,
      existe: !!existe 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error del servidor al verificar usuario.',
      error: error.message 
    });
  }
};

// Listar laboratoristas con paginación y búsqueda
exports.listarLaboratoristas = async (req, res) => {
  try {
    console.log('📋 Listando laboratoristas...');
    
    if (!Laboratorista || !Sucursal) {
      console.error('❌ Modelos no disponibles');
      return res.status(500).json({
        success: false,
        message: 'Error: Modelos no disponibles'
      });
    }

    const { pagina = 1, limite = 5, busqueda = '' } = req.query;
    const offset = (parseInt(pagina) - 1) * parseInt(limite);

    // Configurar búsqueda
    const whereCondition = {};
    if (busqueda) {
      whereCondition[Op.or] = [
        { nombres: { [Op.iLike]: `%${busqueda}%` } },
        { apellidos: { [Op.iLike]: `%${busqueda}%` } },
        { cedula: { [Op.iLike]: `%${busqueda}%` } },
        { especialidad: { [Op.iLike]: `%${busqueda}%` } }
      ];
    }

    // Verificar si la asociación existe
    let queryOptions = {
      where: whereCondition,
      limit: parseInt(limite),
      offset: offset,
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['contrasena'] }
    };

    // Intentar usar include solo si la asociación existe
    if (Laboratorista.associations && Laboratorista.associations.Sucursal) {
      console.log('✅ Usando include con asociación Sucursal');
      queryOptions.include = [
        {
          model: Sucursal,
          as: 'Sucursal',
          attributes: ['id', 'nombre', 'ciudad']
        }
      ];
    } else {
      console.log('⚠️ Asociación Sucursal no encontrada, omitiendo include');
    }

    const { count, rows } = await Laboratorista.findAndCountAll(queryOptions);

    // Transformar datos
    const laboratoristasTransformados = rows.map(lab => {
      const sucursalInfo = lab.Sucursal || {};
      
      return {
        id: lab.id,
        nombres: lab.nombres,
        apellidos: lab.apellidos,
        cedula: lab.cedula,
        celular: lab.celular || '',
        correo: lab.correo,
        usuario: lab.usuario,
        especialidad: lab.especialidad || '',
        estado: lab.activo ? 'activo' : 'inactivo',
        sucursalId: lab.sucursalId,
        sucursalNombre: sucursalInfo.nombre || 'Sin sucursal',
        sucursalCiudad: sucursalInfo.ciudad || '',
        createdAt: lab.createdAt
      };
    });

    console.log(`✅ Encontrados ${count} laboratoristas`);

    res.status(200).json({
      success: true,
      total: count,
      pagina: parseInt(pagina),
      limite: parseInt(limite),
      totalPaginas: Math.ceil(count / parseInt(limite)),
      data: laboratoristasTransformados,
      message: 'Laboratoristas obtenidos correctamente'
    });

  } catch (error) {
    console.error('❌ Error al listar laboratoristas:', error.message);
    
    // Datos de prueba para desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️ Enviando datos de prueba (modo desarrollo)...');
      res.status(200).json({
        success: true,
        total: 2,
        pagina: 1,
        limite: 5,
        totalPaginas: 1,
        data: [
          {
            id: 1,
            nombres: 'NANCY',
            apellidos: 'YEROVI',
            cedula: '0602334477',
            celular: '',
            correo: 'nancy.yerovi@yahoo.es',
            usuario: 'NANCY',
            especialidad: '',
            estado: 'activo',
            sucursalId: 1,
            sucursalNombre: 'Sucursal Central',
            sucursalCiudad: 'Quito',
            createdAt: new Date()
          },
          {
            id: 2,
            nombres: 'JOSELINE',
            apellidos: 'EBLA',
            cedula: '0604516955',
            celular: '',
            correo: 'joselineebla@gmail.com',
            usuario: 'JOS',
            especialidad: '',
            estado: 'activo',
            sucursalId: 2,
            sucursalNombre: 'Sucursal Norte',
            sucursalCiudad: 'Guayaquil',
            createdAt: new Date()
          }
        ],
        message: 'Datos de prueba (modo desarrollo)'
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Error al obtener los laboratoristas',
        error: error.message
      });
    }
  }
};

// Método para estadísticas
exports.obtenerEstadisticas = async (req, res) => {
  try {
    console.log('📊 Obteniendo estadísticas de laboratoristas...');
    
    if (!Laboratorista) {
      console.error('❌ Modelo Laboratorista no disponible');
      return res.status(500).json({
        success: false,
        error: 'Modelo Laboratorista no disponible'
      });
    }

    const total = await Laboratorista.count();
    const activos = await Laboratorista.count({ where: { activo: true } });
    
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const registrosHoy = await Laboratorista.count({
      where: {
        createdAt: {
          [Op.gte]: hoy
        }
      }
    });

    console.log(`📈 Estadísticas: Total=${total}, Activos=${activos}, Hoy=${registrosHoy}`);

    res.json({
      success: true,
      total,
      activos,
      registrosHoy,
      message: 'Estadísticas obtenidas correctamente'
    });
  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error interno del servidor',
      message: error.message 
    });
  }
};