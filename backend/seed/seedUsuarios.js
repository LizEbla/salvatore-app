// seed/seedUsuarios.js
const bcrypt = require('bcryptjs');
const db = require('../models');

async function seedUsuarios() {
  try {
    await db.sequelize.authenticate();

    const Usuario = db.Usuario;
    if (!Usuario) {
      console.log('❌ No existe db.Usuario. Revisa models/Usuario.js y models/index.js');
      process.exit(1);
    }

    const usuarios = [
      {
        nombres: 'Lizbeth Rocio',
        apellidos: 'Ebla Yerovi',
        usuario: 'lrey',
        rol: 'superadmin',
        passwordPlano: 'Lizbeth@691'
      },
      {
        nombres: 'Veronica Paola',
        apellidos: 'Jarrin Yerovi',
        usuario: 'veroja',
        rol: 'administrador',
        passwordPlano: 'Veronica@123Salva'
      },
      {
        nombres: 'Luis',
        apellidos: 'Cargua',
        usuario: 'luis',
        rol: 'administrador',
        passwordPlano: 'Luchin@123Salva'
      }
    ];

    for (const u of usuarios) {
      const existe = await Usuario.findOne({ where: { usuario: u.usuario } });

      if (existe) {
        console.log(`⚠️ Ya existe usuario: ${u.usuario} (no se vuelve a crear)`);
        continue;
      }

      const hash = await bcrypt.hash(u.passwordPlano, 10);

      await Usuario.create({
        nombres: u.nombres,
        apellidos: u.apellidos,
        usuario: u.usuario,
        contrasena: hash,
        rol: u.rol,
        estado: true
      });

      console.log(`✅ Creado: ${u.usuario} (${u.rol})`);
    }

    console.log('🎉 Seed de usuarios terminado.');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error seedUsuarios:', error);
    process.exit(1);
  }
}

seedUsuarios();
