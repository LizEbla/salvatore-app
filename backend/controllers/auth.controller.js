// backend/controllers/auth.controller.js

// Simulación de usuarios
const usuarios = [
    { username: 'admin', password: 'admin123', rol: 'administrador' },
    { username: 'lab', password: 'lab123', rol: 'laboratorista' },
    { username: 'root', password: 'root123', rol: 'programador' }
  ];
  
  exports.login = (req, res) => {
    const { username, password } = req.body;
    const usuario = usuarios.find(u => u.username === username && u.password === password);
  
    if (usuario) {
      res.json({ token: 'fake-jwt-token', rol: usuario.rol });
    } else {
      res.status(401).json({ message: 'Credenciales incorrectas' });
    }
  };
  