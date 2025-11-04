// middleware/auth.js
const jwt = require('jsonwebtoken');
const { Laboratorista } = require('../models');


const verificarAuth = async (req, res, next) => {
  try {
    console.log('🔐 MIDDLEWARE AUTH - Verificando JWT...');
    
    // Obtener el token del header
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No hay token JWT en el header');
      return res.status(401).json({ mensaje: 'Token no proporcionado' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
      console.log('❌ Token vacío');
      return res.status(401).json({ mensaje: 'Token vacío' });
    }

    // 🎫 VERIFICAR JWT REAL
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'clave-secreta-para-desarrollo');
    console.log('✅ JWT VÁLIDO - Datos decodificados:', {
      id: decoded.id,
      usuario: decoded.usuario,
      nombres: decoded.nombres,
      expira: new Date(decoded.exp * 1000).toLocaleString()
    });

    // Si es usuario de BD real, verificar que aún existe
    if (decoded.esUsuarioReal) {
      const usuarioBD = await Laboratorista.findByPk(decoded.id, {
        attributes: { exclude: ['contrasena'] }
      });

      if (!usuarioBD) {
        console.log('❌ Usuario de BD ya no existe');
        return res.status(401).json({ mensaje: 'Usuario no encontrado' });
      }

      req.user = {
        id: usuarioBD.id,
        nombres: usuarioBD.nombres,
        apellidos: usuarioBD.apellidos,
        usuario: usuarioBD.usuario,
        tipoUsuario: 'laboratorista_bd'
      };
    } else {
      // Usuario simulado
      req.user = {
        id: decoded.id,
        nombres: decoded.nombres,
        apellidos: decoded.apellidos,
        usuario: decoded.usuario,
        tipoUsuario: 'usuario_simulado'
      };
    }

    console.log('👤 USUARIO AUTENTICADO:', req.user);
    next();

  } catch (error) {
    console.error('❌ Error en autenticación JWT:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ mensaje: 'Token expirado' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ mensaje: 'Token inválido' });
    }
    
    res.status(401).json({ mensaje: 'Error de autenticación' });
  }
};


module.exports = verificarAuth;