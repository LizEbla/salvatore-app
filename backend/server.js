const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./models'); // 👈 Importa los modelos correctamente

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
const authRoutes = require('./routes/auth.routes');
const laboratoristasRoutes = require('./routes/laboratoristas.routes');
const pacienteRoutes = require('./routes/paciente.routes');

app.use('/api/auth', authRoutes);
app.use('/api/laboratoristas', laboratoristasRoutes);
app.use('/api/pacientes', pacienteRoutes);

// Sincronización con base de datos
db.sequelize.sync({ alter: true }).then(() => {
  console.log('✅ Base de datos sincronizada');
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('❌ Error al conectar con la base de datos:', err);
});

app.get('/api/test', (req, res) => {
  res.json({ mensaje: 'Funciona' });
});
