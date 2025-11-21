const jwt = require('jsonwebtoken');
const db = require('../models');

const Laboratorista = db.Laboratorista;
const Paciente = db.Paciente;

const verificarAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ mensaje: 'Token no proporcionado' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'salvatore_secret_key');

    let usuarioFinal = {
      id: decoded.id,
      tipoUsuario: decoded.tipoUsuario
    };

    // ============================================================
    // 🔵 USUARIOS FIJOS - CORREGIDO: Asignar IDs numéricos válidos
    // ============================================================
    if (["administrador", "laboratorista", "paciente"].includes(decoded.tipoUsuario)) {
      // ✅ CORREGIDO: Asignar IDs numéricos para usuarios fijos
      const usuariosFijos = {
        'administrador': { id: 1, nombres: 'Administrador', apellidos: 'Sistema' },
        'laboratorista': { id: 2, nombres: 'Laboratorista', apellidos: 'General' },
        'paciente': { id: 3, nombres: 'Paciente', apellidos: 'Invitado' }
      };
      
      const usuarioFijo = usuariosFijos[decoded.tipoUsuario];
      if (usuarioFijo) {
        usuarioFinal = {
          id: usuarioFijo.id, // ✅ Ahora es un número
          tipoUsuario: decoded.tipoUsuario,
          nombres: usuarioFijo.nombres,
          apellidos: usuarioFijo.apellidos,
          usuario: decoded.tipoUsuario
        };
      }
      
      req.usuario = usuarioFinal;
      return next();
    }

    // LABORATORISTA / ADMIN / SUPERADMIN
    if (['laboratorista', 'administrador', 'superadmin'].includes(decoded.tipoUsuario)) {
      const lab = await Laboratorista.findByPk(decoded.id);
      if (!lab) return res.status(401).json({ mensaje: 'Laboratorista no encontrado' });

      usuarioFinal = {
        id: lab.id, // ✅ Esto ya es un número de la BD
        tipoUsuario: lab.rol,
        nombres: lab.nombres,
        apellidos: lab.apellidos,
        usuario: lab.usuario
      };
    }

    // PACIENTE
    if (decoded.tipoUsuario === 'paciente') {
      const paciente = await Paciente.findByPk(decoded.id);
      if (paciente) {
        usuarioFinal = {
          id: paciente.id, // ✅ Esto ya es un número de la BD
          tipoUsuario: 'paciente',
          nombres: paciente.nombres,
          apellidos: paciente.apellidos,
          usuario: paciente.cedula
        };
      }
    }

    // ✅ VALIDACIÓN FINAL: Asegurar que el ID sea numérico
    if (isNaN(parseInt(usuarioFinal.id))) {
      console.error('❌ ID de usuario no es numérico:', usuarioFinal.id);
      return res.status(401).json({ mensaje: 'ID de usuario inválido' });
    }

    req.usuario = usuarioFinal;
    next();

  } catch (error) {
    console.error("❌ Error en verificarAuth:", error);
    res.status(401).json({ mensaje: 'Token inválido o expirado' });
  }
};

module.exports = verificarAuth;