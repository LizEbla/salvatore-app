//PARA COMPROBAR SI LA CONTRASEÑA INGRESADA COINCIDE CON EL HASH GUARDADO EN LA BD


const bcrypt = require('bcrypt');

// 🔹 Simula los datos de tu tabla
const usuarioBD = {
  usuario: "NANCY", // el mismo valor que tienes en la columna "usuario"
  contrasena: "$2b$10$4DgAuSff6DkNihonbVYMmuFtGTRUYvOr688tUOrLEMBLObcetxO9W" // hash que está en la BD
};

// 🔹 Contraseña en texto plano que usaste al registrar
const passwordIngresada = "NANCY123"; // <-- aquí escribe la clave real que usaste al crear este usuario

(async () => {
  try {
    console.log("👉 Usuario BD:", usuarioBD.usuario);
    console.log("👉 Hash en BD:", usuarioBD.contrasena);
    console.log("👉 Password ingresada:", passwordIngresada);

    const esValida = await bcrypt.compare(passwordIngresada, usuarioBD.contrasena);

    if (esValida) {
      console.log("✅ La contraseña coincide con el hash guardado.");
    } else {
      console.log("❌ La contraseña NO coincide con el hash guardado.");
    }
  } catch (error) {
    console.error("💥 Error comparando contraseña:", error);
  }
})();
