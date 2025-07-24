const { DataTypes, Op } = require('sequelize');
const bcrypt = require('bcrypt');
const sequelize = require('../config/db');
const Laboratorista = require('../models/Laboratorista')(sequelize, DataTypes);



// Crear un nuevo laboratorista
exports.crearLaboratorista = async (req, res) => {
  try {
    const { nombres, apellidos, cedula, celular, correo, usuario, contrasena } = req.body;

    if (!nombres || !apellidos || !cedula || !celular || !correo || !usuario || !contrasena) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
    }

    const existeCedula = await Laboratorista.findOne({ where: { cedula } });
    if (existeCedula) {
      return res.status(400).json({ message: 'La cédula ya está registrada.' });
    }

    const existeUsuario = await Laboratorista.findOne({ where: { usuario } });
    if (existeUsuario) {
      return res.status(400).json({ message: 'El nombre de usuario ya está en uso.' });
    }

    // ✅ Encriptar la contraseña antes de guardar
    const hashedPassword = await bcrypt.hash(contrasena, 10);

    const nuevo = await Laboratorista.create({
      nombres,
      apellidos,
      cedula,
      celular,
      correo,
      usuario,
      contrasena: hashedPassword
    });

    res.status(201).json(nuevo);
  } catch (error) {
    console.error('Error al crear laboratorista:', error);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
};




// Editar un laboratorista por ID
exports.editarLaboratoristas = async (req, res) => {
  try {
    const id = req.params.id;
    const {
      nombres,
      apellidos,
      cedula,
      celular,
      correo,
      usuario,
      contrasena
    } = req.body;

    const laboratorista = await Laboratorista.findByPk(id);
    if (!laboratorista) {
      return res.status(404).json({ message: 'Laboratorista no encontrado.' });
    }

    // Actualizar campos básicos
    laboratorista.nombres = nombres;
    laboratorista.apellidos = apellidos;
    laboratorista.cedula = cedula;
    laboratorista.celular = celular;
    laboratorista.correo = correo;
    laboratorista.usuario = usuario;

    // Si se desea cambiar la contraseña
    if (contrasena && contrasena.trim() !== '') {
      const hashedPassword = await bcrypt.hash(contrasena, 10);
      laboratorista.contrasena = hashedPassword;
    }

    await laboratorista.save();
    res.status(200).json({ message: 'Laboratorista actualizado correctamente.' });

  } catch (error) {
    console.error('Error al editar laboratorista:', error);
    res.status(500).json({ message: 'Error al editar laboratorista.' });
  }
};

// Eliminar un laboratorista por ID
exports.eliminarLaboratorista = async (req, res) => {
  try {
    const id = req.params.id;

    const laboratorista = await Laboratorista.findByPk(id);
    if (!laboratorista) {
      return res.status(404).json({ message: 'Laboratorista no encontrado.' });
    }

    await laboratorista.destroy();
    res.status(200).json({ message: 'Laboratorista eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar laboratorista:', error);
    res.status(500).json({ message: 'Error al eliminar laboratorista.' });
  }
};

// Obtener un laboratorista por ID
exports.obtenerLaboratoristasPorId = async (req, res) => {
  const { id } = req.params;
  console.log('Solicitud para obtener laboratorista con ID:', id);

  try {
    const laboratorista = await Laboratorista.findByPk(id);
    console.log('Resultado de la consulta:', laboratorista);

    if (laboratorista) {
      res.json(laboratorista);
    } else {
      res.status(404).json({ message: 'Laboratorista no encontrado' });
    }
  } catch (error) {
    console.error('Error al obtener laboratorista por ID:', error);
    res.status(500).json({ message: 'Error del servidor' });
  }
};

//verifica cedula duplicada
// En controllers/laboratorista.controller.js

exports.verificarCedulaDuplicada = async (req, res) => {
  const { cedula } = req.params;
  try {
    const existente = await Laboratorista.findOne({ where: { cedula } });
    if (existente) {
      return res.json({ existe: true });
    } else {
      return res.json({ existe: false });
    }
  } catch (error) {
    console.error('Error al verificar cédula:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

//verificar usuario duplicado
// Verifica si el usuario ya está registrado
exports.verificarUsuarioDuplicado = async (req, res) => {
  try {
    const { usuario } = req.params;
    const existe = await Laboratorista.findOne({ where: { usuario } });
    res.json({ existe: !!existe });
  } catch (error) {
    res.status(500).json({ message: 'Error del servidor al verificar usuario.' });
  }
};


// Listar laboratoristas con paginación y búsqueda, usando los parámetros del frontend
exports.listarLaboratoristas = async (req, res) => {
  try {
    // Acepta los parámetros como los envía el frontend
    const { pagina = 1, limite = 5, busqueda = '' } = req.query;

    const offset = (parseInt(pagina) - 1) * parseInt(limite);

    const { count, rows } = await Laboratorista.findAndCountAll({
      where: {
        [Op.or]: [
          { nombres: { [Op.iLike]: `%${busqueda}%` } },
          { apellidos: { [Op.iLike]: `%${busqueda}%` } },
          { cedula: { [Op.iLike]: `%${busqueda}%` } }
        ]
      },
      limit: parseInt(limite),
      offset: offset,
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      total: count,
      pagina: parseInt(pagina),
      limite: parseInt(limite),
      data: rows
    });

  } catch (error) {
    console.error('Error al listar laboratoristas:', error);
    res.status(500).json({ message: 'Error al obtener los laboratoristas.' });
  }
};






