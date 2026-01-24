const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../models');
const Usuario = db.Usuario;
const Laboratorista = db.Laboratorista;
const Paciente = db.Paciente;
const Sucursal = db.Sucursal;

const JWT_SECRET = process.env.JWT_SECRET || 'salvatore_secret_key';

// ============================================================
// 🔵 LOGIN ADMIN / SUPERADMIN / LABORATORISTA (DESDE BD)
// ============================================================
exports.login = async (req, res) => {
  try {
    const { username, password, sucursalId } = req.body;

    if (!username || !password) {
      return res.status(400).json({ mensaje: 'Usuario y contraseña son obligatorios' });
    }

    console.log('🔍 INICIO LOGIN:', {
      username,
      tieneSucursalId: !!sucursalId,
      sucursalId
    });

    // ============================================================
    // 1) BUSCAR EN USUARIOS (ADMIN / SUPERADMIN)
    // ============================================================
    const admin = await Usuario.findOne({
      where: { usuario: username, estado: true }
    });

    if (admin) {
      const ok = await bcrypt.compare(password, admin.contrasena);
      if (!ok) return res.status(401).json({ mensaje: 'Credenciales incorrectas' });

      let sucursalActual = null;
      
      // ✅ PARA ADMINISTRADORES: OBTENER/MANEJAR SUCURSAL
      if (admin.rol === 'administrador' || admin.rol === 'superadmin') {
        console.log('👨‍💼 Usuario es administrador, procesando sucursal...');
        
        if (sucursalId) {
          // Validar que la sucursal exista
          const sucursal = await Sucursal.findByPk(sucursalId);
          if (!sucursal) {
            return res.status(400).json({ 
              mensaje: 'La sucursal seleccionada no existe' 
            });
          }
          sucursalActual = {
            id: sucursal.id,
            nombre: sucursal.nombre
          };
          console.log('🏢 Sucursal seleccionada:', sucursalActual);
        } else {
          // Si no viene sucursal, usar primera disponible
          const sucursalDefault = await Sucursal.findOne({
            order: [['id', 'ASC']]
          });
          if (sucursalDefault) {
            sucursalActual = {
              id: sucursalDefault.id,
              nombre: sucursalDefault.nombre
            };
            console.log('🏢 Sucursal por defecto asignada:', sucursalActual);
          } else {
            console.warn('⚠️ No hay sucursales en el sistema');
          }
        }
      }

      // Crear token con información de sucursal
      const tokenPayload = {
        id: admin.id,
        nombres: admin.nombres,
        apellidos: admin.apellidos,
        tipoUsuario: admin.rol,
        sucursalActual: sucursalActual,
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 10) // 10 horas
      };

      const token = jwt.sign(tokenPayload, JWT_SECRET);

      return res.json({
        ok: true,
        token,
        usuario: {
          id: admin.id,
          nombres: admin.nombres,
          apellidos: admin.apellidos,
          tipoUsuario: admin.rol,
          sucursalActual: sucursalActual // ✅ Incluir en respuesta
        }
      });
    }

    // ============================================================
    // 2) BUSCAR EN LABORATORISTAS
    // ============================================================
    const lab = await Laboratorista.findOne({ 
      where: { usuario: username },
      include: [{ 
        model: Sucursal, 
        as: 'Sucursal',
        attributes: ['id', 'nombre'] 
      }]
    });

    if (!lab) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }

    const passwordValida = await bcrypt.compare(password, lab.contrasena);
    if (!passwordValida) {
      return res.status(401).json({ mensaje: 'Credenciales incorrectas' });
    }

    // Para laboratoristas, usar su sucursal asignada
    const sucursalActual = lab.Sucursal ? {
      id: lab.Sucursal.id,
      nombre: lab.Sucursal.nombre
    } : null;

    const token = jwt.sign(
      { 
        id: lab.id, 
        nombres: lab.nombres,
        apellidos: lab.apellidos,
        tipoUsuario: 'laboratorista',
        sucursalActual: sucursalActual
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      ok: true,
      token,
      usuario: {
        id: lab.id,
        nombres: lab.nombres,
        apellidos: lab.apellidos,
        tipoUsuario: 'laboratorista',
        sucursalActual: sucursalActual // ✅ Incluir en respuesta
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

    const passEsperada = paciente.fechaNacimiento?.split('-')?.reverse()?.join('');

    if (passEsperada !== password) {
      return res.status(401).json({ mensaje: 'Contraseña incorrecta' });
    }

    const token = jwt.sign(
      { 
        id: paciente.id, 
        tipoUsuario: 'paciente',
        nombres: paciente.nombres,
        apellidos: paciente.apellidos
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({ 
      ok: true, 
      token, 
      paciente: {
        id: paciente.id,
        nombres: paciente.nombres,
        apellidos: paciente.apellidos,
        cedula: paciente.cedula,
        tipoUsuario: 'paciente'
      }
    });

  } catch (error) {
    console.error('❌ ERROR LOGIN PACIENTE:', error);
    return res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

// ============================================================
// ✅ VERIFICAR TOKEN
// ============================================================
exports.verificarToken = (req, res) => {
  return res.json({
    ok: true,
    usuario: req.usuario
  });
};

// ============================================================
// 🔄 CAMBIAR SUCURSAL (PARA ADMINISTRADORES)
// ============================================================
exports.cambiarSucursal = async (req, res) => {
  try {
    const { sucursalId } = req.body;

    if (!req.usuario) {
      return res.status(401).json({ 
        ok: false, 
        mensaje: 'No autenticado' 
      });
    }

    // Solo administradores pueden cambiar sucursal
    if (req.usuario.tipoUsuario !== 'administrador' && 
        req.usuario.tipoUsuario !== 'superadmin') {
      return res.status(403).json({ 
        ok: false, 
        mensaje: 'Solo administradores pueden cambiar sucursal' 
      });
    }

    // Validar sucursal
    const sucursal = await Sucursal.findByPk(sucursalId);
    if (!sucursal) {
      return res.status(404).json({ 
        ok: false, 
        mensaje: 'Sucursal no encontrada' 
      });
    }

    // Actualizar usuario en request
    req.usuario.sucursalActual = {
      id: sucursal.id,
      nombre: sucursal.nombre
    };

    // Generar nuevo token si se quiere
    const nuevoToken = jwt.sign(
      req.usuario,
      JWT_SECRET,
      { expiresIn: '10h' }
    );

    return res.json({
      ok: true,
      token: nuevoToken,
      mensaje: `Sucursal cambiada a ${sucursal.nombre}`,
      sucursalActual: req.usuario.sucursalActual
    });

  } catch (error) {
    console.error('❌ ERROR CAMBIAR SUCURSAL:', error);
    return res.status(500).json({ 
      ok: false, 
      mensaje: 'Error interno del servidor' 
    });
  }
};

// ============================================================
// 🔍 DIAGNÓSTICO DE SESIÓN
// ============================================================
exports.diagnosticarSesion = async (req, res) => {
  try {
    console.log('🔍 DIAGNÓSTICO DE SESIÓN - Usuario:', req.usuario);
    
    return res.json({
      success: true,
      usuario: req.usuario,
      timestamp: new Date(),
      detalles: {
        id: req.usuario?.id,
        tipo: req.usuario?.tipoUsuario,
        nombres: req.usuario?.nombres,
        apellidos: req.usuario?.apellidos,
        sucursalActual: req.usuario?.sucursalActual
      }
    });
  } catch (error) {
    console.error('❌ Error en diagnóstico:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};