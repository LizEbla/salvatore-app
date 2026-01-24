// middleware/role.js
module.exports = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ mensaje: 'No autenticado' });
    }

    const rol = req.usuario.tipoUsuario;

    if (!rolesPermitidos.includes(rol)) {
      return res.status(403).json({ mensaje: 'No tiene permisos para esta acción' });
    }

    next();
  };
};
