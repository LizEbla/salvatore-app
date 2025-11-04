// auth.controller.js - VERSIÓN CON JWT REAL
const { Laboratorista } = require('../models');
const { Op } = require('sequelize');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken'); // 👈 IMPORTAR JWT

// Usuarios simulados como fallback (pero con JWT real)
const usuariosSimulados = [
  { 
    username: 'admin', 
    password: 'admin123', 
    rol: 'administrador',
    id: 9991,
    nombres: 'Administrador',
    apellidos: 'Sistema'
  },
  { 
    username: 'lab', 
    password: 'lab123', 
    rol: 'laboratorista',
    id: 9992,
    nombres: 'Laboratorista',
    apellidos: 'Principal'
  },
  { 
    username: 'root', 
    password: 'root123', 
    rol: 'programador',
    id: 9993,
    nombres: 'Super',
    apellidos: 'Usuario'
  }
];

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    console.log("=== 🔍 LOGIN INICIADO ===");
    console.log("📥 Datos recibidos:", { username, password });

    let usuarioEncontrado = null;
    let esUsuarioReal = false;

    // 1️⃣ PRIMERO: Buscar en Laboratorista (Base de Datos REAL)
    const usuarioBD = await Laboratorista.findOne({
      where: { usuario: { [Op.iLike]: username.trim() } }
    });

    if (usuarioBD) {
      console.log("✅ Usuario encontrado en BD:", usuarioBD.usuario);
      
      // Verificar contraseña
      const esValido = await bcrypt.compare(password, usuarioBD.contrasena);
      console.log("🔐 Resultado bcrypt.compare:", esValido);

      if (esValido) {
        usuarioEncontrado = usuarioBD;
        esUsuarioReal = true;
        console.log("✅ Login exitoso - Usuario BD");
      } else {
        console.log("❌ Contraseña incorrecta");
        return res.status(401).json({ message: 'Credenciales incorrectas' });
      }
    } else {
      // 2️⃣ SEGUNDO: Buscar en usuarios simulados
      const usuarioSimulado = usuariosSimulados.find(
        u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
      );

      if (usuarioSimulado) {
        usuarioEncontrado = usuarioSimulado;
        esUsuarioReal = false;
        console.log("✅ Usuario simulado:", usuarioSimulado.username);
      } else {
        console.log("❌ Usuario no encontrado");
        return res.status(401).json({ message: 'Credenciales incorrectas' });
      }
    }

    // 🎫 CREAR JWT REAL (PARA AMBOS CASOS)
    const tokenPayload = {
      id: usuarioEncontrado.id,
      usuario: usuarioEncontrado.usuario,
      nombres: usuarioEncontrado.nombres,
      apellidos: usuarioEncontrado.apellidos,
      rol: usuarioEncontrado.rol,
      esUsuarioReal: esUsuarioReal, // Para saber si es de BD o simulado
      tipo: esUsuarioReal ? 'laboratorista_bd' : 'usuario_simulado'
    };

    // 🔐 GENERAR TOKEN JWT REAL
    const token = jwt.sign(
      tokenPayload, 
      process.env.JWT_SECRET || 'clave-secreta-para-desarrollo', // Clave secreta
      { expiresIn: '24h' } // ⏰ Token expira en 24 horas
    );

    console.log("🎫 JWT GENERADO:", {
      id: usuarioEncontrado.id,
      usuario: usuarioEncontrado.usuario,
      expiraEn: '24 horas'
    });

    res.json({
      token: token, // 👈 ESTE ES EL JWT REAL
      rol: usuarioEncontrado.rol,
      usuario: {
        id: usuarioEncontrado.id,
        nombres: usuarioEncontrado.nombres,
        apellidos: usuarioEncontrado.apellidos,
        usuario: usuarioEncontrado.usuario,
        tipo: esUsuarioReal ? 'BD Real' : 'Simulado'
      },
      message: 'Login exitoso'
    });

  } catch (error) {
    console.error("💥 Error en login:", error);
    res.status(500).json({ message: 'Error del servidor: ' + error.message });
  }
};


// En auth.controller.js - agregar esta función
exports.verificarToken = async (req, res) => {
  try {
    console.log('🔐 Verificando token JWT...');
    
    res.json({
      valido: true,
      usuario: req.user,
      message: 'Token JWT válido',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(401).json({ 
      valido: false, 
      message: 'Token inválido' 
    });
  }
};

