const configuraciones = [
  // Básicos
  { tipoMuestra: 'sangre', tipoTubo: 'Tubo rojo' },
  { tipoMuestra: 'orina', tipoTubo: 'Frasco estéril' },
  { tipoMuestra: 'heces', tipoTubo: 'Frasco con paleta' },
  { tipoMuestra: 'hisopado', tipoTubo: 'Hisopo estéril' },

  // Nuevos según descripción y Excel:
  { tipoMuestra: 'suero', tipoTubo: 'Tubo rojo' },
  { tipoMuestra: 'plasma', tipoTubo: 'Tubo verde' },
  { tipoMuestra: 'coagulación', tipoTubo: 'Tubo azul' },
  { tipoMuestra: 'hematología', tipoTubo: 'Tubo lila/morado' },
  { tipoMuestra: 'química clínica', tipoTubo: 'Tubo amarillo' },
  { tipoMuestra: 'química sanguínea', tipoTubo: 'Tubo rojo' },
  { tipoMuestra: 'inmunología', tipoTubo: 'Tubo rojo' },
  { tipoMuestra: 'serología', tipoTubo: 'Tubo rojo' },
  { tipoMuestra: 'glucosa', tipoTubo: 'Tubo gris' },
  { tipoMuestra: 'glicólisis', tipoTubo: 'Tubo gris' },
  { tipoMuestra: 'grupo sanguíneo', tipoTubo: 'Tubo lila/morado' },
  { tipoMuestra: 'gasometría', tipoTubo: 'Tubo verde' },
  { tipoMuestra: 'cultivo', tipoTubo: 'Frasco estéril' }
];

function obtenerTuboPorTipoMuestra(tipoMuestra) {
  if (!tipoMuestra || typeof tipoMuestra !== 'string') return '';

  const limpio = tipoMuestra.trim().toLowerCase();

  const encontrado = configuraciones.find(c =>
    limpio.includes(c.tipoMuestra.toLowerCase())
  );

  return encontrado ? encontrado.tipoTubo : '';
}

module.exports = { obtenerTuboPorTipoMuestra };
