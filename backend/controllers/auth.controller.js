// controllers/auth.controller.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


// ✅ IMPORTACIÓN CORRECTA DESDE index.js
const db = require('../models');
const Laboratorista = db.Laboratorista;
const Paciente = db.Paciente;

const JWT_SECRET = process.env.JWT_SECRET || 'salvatore_secret_key';

// ============================================================
// 🔵 USUARIOS FIJOS (ADMIN, LAB, PACIENTE)
// ============================================================
const usuariosFijos = [
  {
    usuario: "admin",
    contrasena: "admin123",
    rol: "administrador",
    nombres: "Usuario",
    apellidos: "Administrador"
  },
  {
    usuario: "lab",
    contrasena: "lab123",
    rol: "laboratorista",
    nombres: "Usuario",
    apellidos: "Laboratorista"
  },
  {
    usuario: "paciente",
    contrasena: "paciente123",
    rol: "paciente",
    nombres: "Usuario",
    apellidos: "Paciente"
  }
];


// ============================================================
// 🔵 LOGIN LABORATORISTA / ADMINISTRADOR / SUPERADMIN
// ============================================================
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ mensaje: 'Usuario y contraseña son obligatorios' });
    }


    const usuarioFijo = usuariosFijos.find(u => u.usuario === username);

    if (usuarioFijo) {
      if (password !== usuarioFijo.contrasena) {
        return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
      }

      const token = jwt.sign(
        {
          id: usuarioFijo.usuario, // usa el username como ID
          tipoUsuario: usuarioFijo.rol
        },
        JWT_SECRET,
        { expiresIn: '10h' }
      );

      return res.json({
        ok: true,
        token,
        usuario: {
          id: usuarioFijo.usuario,
          nombres: usuarioFijo.nombres,
          apellidos: usuarioFijo.apellidos,
          tipoUsuario: usuarioFijo.rol
        }
      });
    }


    // 🔍 Buscar usuario por campo username
    const usuario = await Laboratorista.findOne({ where: { usuario: username } });

    if (!usuario) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }

    const passwordValida = await bcrypt.compare(password, usuario.contrasena);

    if (!passwordValida) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      {
        id: usuario.id,
        tipoUsuario: usuario.rol
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      ok: true,
      token,
      usuario: {
        id: usuario.id,
        nombres: usuario.nombres,
        apellidos: usuario.apellidos,
        tipoUsuario: usuario.rol
      }
    });

  } catch (error) {
    console.error('❌ ERROR LOGIN:', error);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};


// ============================================================
// 🟢 LOGIN PACIENTES
// ============================================================
exports.loginPaciente = async (req, res) => {
  try {
    const { cedula, password } = req.body;

    if (!cedula || !password) {
      return res.status(400).json({ mensaje: 'Cédula y contraseña son obligatorias' });
    }

    const paciente = await Paciente.findOne({ where: { cedula } });

    if (!paciente) {
      return res.status(404).json({ mensaje: 'Paciente no encontrado' });
    }

    const passEsperada =
      paciente.fechaNacimiento?.split('-')?.reverse()?.join('');

    if (passEsperada !== password) {
      return res.status(401).json({ mensaje: 'Contraseña incorrecta' });
    }

    const token = jwt.sign(
      {
        id: paciente.id,
        tipoUsuario: 'paciente'
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      ok: true,
      token,
      paciente
    });

  } catch (error) {
    console.error('❌ ERROR LOGIN PACIENTE:', error);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};




exports.verificarToken = (req, res) => {
  return res.json({
    ok: true,
    usuario: req.usuario
  });
};
