const jwt = require('jsonwebtoken');
const db = require('../models');
const Usuario = db.Usuario;
const Laboratorista = db.Laboratorista;
const Paciente = db.Paciente;
const Sucursal = db.Sucursal;

const verificarAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ mensaje: 'Token no proporcionado' });
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'salvatore_secret_key');

    console.log('🔍 TOKEN DECODIFICADO:', {
      id: decoded.id,
      tipoUsuario: decoded.tipoUsuario,
      nombres: decoded.nombres,
      sucursalActual: decoded.sucursalActual,
      exp: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null
    });

    let usuarioFinal = null;

    // ✅ BUSCAR EN LA BASE DE DATOS SEGÚN EL TIPO DE USUARIO
    if (decoded.tipoUsuario === 'laboratorista') {
      const lab = await Laboratorista.findByPk(decoded.id, {
        include: [{ 
          model: Sucursal, 
          as: 'Sucursal',
          attributes: ['id', 'nombre'] 
        }]
      });
      
      if (!lab) {
        console.error('❌ Laboratorista no encontrado con ID:', decoded.id);
        return res.status(401).json({ mensaje: 'Laboratorista no encontrado' });
      }
      
      usuarioFinal = {
        id: lab.id,
        tipoUsuario: 'laboratorista',
        nombres: lab.nombres,
        apellidos: lab.apellidos,
        usuario: lab.usuario,
        email: lab.email || null,
        sucursalActual: lab.Sucursal ? {
          id: lab.Sucursal.id,
          nombre: lab.Sucursal.nombre
        } : null
      };
      
      console.log('✅ Laboratorista encontrado:', {
        id: lab.id,
        nombre: `${lab.nombres} ${lab.apellidos}`,
        sucursal: usuarioFinal.sucursalActual?.nombre || 'Sin sucursal'
      });

    } else if (decoded.tipoUsuario === 'administrador' || decoded.tipoUsuario === 'superadmin') {
      const admin = await Usuario.findByPk(decoded.id);
      if (!admin) {
        console.error('❌ Administrador no encontrado con ID:', decoded.id);
        return res.status(401).json({ mensaje: 'Administrador no encontrado' });
      }
      
      // ✅ PARA ADMINISTRADORES: USAR SUCURSAL DEL TOKEN O BUSCAR UNA
      let sucursalActual = decoded.sucursalActual;
      
      if (!sucursalActual) {
        // Si no hay en token, buscar una por defecto
        const sucursalDefault = await Sucursal.findOne({
          order: [['id', 'ASC']]
        });
        
        if (sucursalDefault) {
          sucursalActual = {
            id: sucursalDefault.id,
            nombre: sucursalDefault.nombre
          };
          console.log('🏢 Sucursal por defecto asignada para admin:', sucursalActual.nombre);
        }
      }
      
      usuarioFinal = {
        id: admin.id,
        tipoUsuario: admin.rol,
        nombres: admin.nombres,
        apellidos: admin.apellidos,
        usuario: admin.usuario,
        email: admin.email || null,
        sucursalActual: sucursalActual
      };

      console.log('✅ Administrador encontrado:', {
        id: admin.id,
        nombre: `${admin.nombres} ${admin.apellidos}`,
        rol: admin.rol,
        sucursal: sucursalActual?.nombre || 'Sin sucursal asignada'
      });

    } else if (decoded.tipoUsuario === 'paciente') {
      const paciente = await Paciente.findByPk(decoded.id);
      if (!paciente) {
        console.error('❌ Paciente no encontrado con ID:', decoded.id);
        return res.status(401).json({ mensaje: 'Paciente no encontrado' });
      }
      
      usuarioFinal = {
        id: paciente.id,
        tipoUsuario: 'paciente',
        nombres: paciente.nombres,
        apellidos: paciente.apellidos,
        usuario: paciente.cedula,
        cedula: paciente.cedula
      };

    } else {
      console.error('❌ Tipo de usuario desconocido:', decoded.tipoUsuario);
      return res.status(401).json({ mensaje: 'Tipo de usuario inválido' });
    }

    // ✅ VALIDACIÓN FINAL DEL USUARIO
    if (!usuarioFinal || !usuarioFinal.id || usuarioFinal.id <= 0) {
      console.error('❌ Usuario final inválido:', usuarioFinal);
      return res.status(401).json({ mensaje: 'Usuario inválido' });
    }

    // ✅ CONFIRMAR QUE EL ID SEA NUMÉRICO
    const userId = parseInt(usuarioFinal.id);
    if (isNaN(userId) || userId <= 0) {
      console.error('❌ ID de usuario no es numérico:', usuarioFinal.id);
      return res.status(401).json({ mensaje: 'ID de usuario inválido' });
    }

    usuarioFinal.id = userId; // ✅ Asegurar que sea número

    console.log('✅ USUARIO AUTENTICADO FINAL:', {
      id: usuarioFinal.id,
      tipoUsuario: usuarioFinal.tipoUsuario,
      nombres: usuarioFinal.nombres,
      sucursal: usuarioFinal.sucursalActual?.nombre || 'N/A',
      timestamp: new Date().toISOString()
    });

    req.usuario = usuarioFinal;
    next();

  } catch (error) {
    console.error("❌ Error en verificarAuth:", error);
    
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