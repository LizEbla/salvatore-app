const express = require('express');
const cors = require('cors');
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Importar rutas
const pacienteRoutes = require('./routes/paciente.routes');

// Montar rutas
app.use('/api/pacientes', pacienteRoutes);

// Iniciar servidor
app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});
