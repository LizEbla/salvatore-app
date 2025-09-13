const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./models'); // 👈 Asegúrate que todos los modelos estén definidos correctamente

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
const tipoExamenRoutes = require('./routes/tipoexamen.routes'); // ✅ Incluye todas las rutas necesarias

app.use('/api/auth', authRoutes);
app.use('/api/laboratoristas', laboratoristasRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/tipoexamenes', tipoExamenRoutes);

// Sincronización con base de datos (⚠️ fuerza recreación total de tablas)
db.sequelize.sync().then(() => {
  console.log('✅ Base de datos sincronizada desde cero (force: true)');
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('❌ Error al conectar con la base de datos:', err);
});

// Ruta de prueba
app.get('/api/test', (req, res) => {
  res.json({ mensaje: 'Funciona' });
});
