// controllers/usuario.controller.js
const bcrypt = require('bcryptjs');
const db = require('../models');
const Usuario = db.Usuario;

exports.crearAdministrador = async (req, res) => {
  try {
    const { nombres, apellidos, usuario, contrasena } = req.body;

    if (!nombres || !apellidos || !usuario || !contrasena) {
      return res.status(400).json({ mensaje: 'Todos los campos son obligatorios' });
    }

    const existe = await Usuario.findOne({ where: { usuario } });
    if (existe) return res.status(400).json({ mensaje: 'Ese usuario ya existe' });

    const hash = await bcrypt.hash(contrasena, 10);

    const nuevo = await Usuario.create({
      nombres,
      apellidos,
      usuario,
      contrasena: hash,
      rol: 'administrador',
      estado: true
    });

    return res.json({
      ok: true,
      mensaje: 'Administrador creado',
      data: { id: nuevo.id, usuario: nuevo.usuario }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};
