/**
 * MÓDULO: storage.js
 * ──────────────────────────────────────────────────────────────
 * Persistencia local usando localStorage.
 * Abstrae el mecanismo de guardado para facilitar
 * migración futura a IndexedDB, backend o nube.
 *
 * API PÚBLICA:
 *   guardarItems(items)       → void
 *   cargarItems()             → Array
 *   guardarConfig(config)     → void
 *   cargarConfig()            → Object
 *   limpiarTodo()             → void
 */

const CLAVES = {
  ITEMS:  'calc_precios_items',
  CONFIG: 'calc_precios_config',
};

// ── CONFIGURACIÓN POR DEFECTO ─────────────────────────────────

export const CONFIG_DEFAULT = {
  porcentaje:     30,
  modo:           'aumento',
  tipoVenta:      'unidad',
  cantidadBulto:  12,
  redondeo:       '2',
};

// ── HELPERS INTERNOS ──────────────────────────────────────────

function leer(clave, valorDefault = null) {
  try {
    const raw = localStorage.getItem(clave);
    if (raw === null) return valorDefault;
    return JSON.parse(raw);
  } catch {
    console.warn(`[storage] No se pudo leer "${clave}"`);
    return valorDefault;
  }
}

function escribir(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch (e) {
    console.warn(`[storage] No se pudo guardar "${clave}":`, e);
  }
}

// ── ÍTEMS ─────────────────────────────────────────────────────

/**
 * Guarda la lista de ítems en localStorage.
 * @param {Array<Object>} items
 */
export function guardarItems(items) {
  escribir(CLAVES.ITEMS, items);
}

/**
 * Carga la lista de ítems desde localStorage.
 * @returns {Array<Object>}
 */
export function cargarItems() {
  return leer(CLAVES.ITEMS, []);
}

// ── CONFIGURACIÓN ─────────────────────────────────────────────

/**
 * Guarda la configuración activa.
 * @param {Object} config
 */
export function guardarConfig(config) {
  escribir(CLAVES.CONFIG, config);
}

/**
 * Carga la configuración guardada, o la por defecto.
 * @returns {Object}
 */
export function cargarConfig() {
  const guardada = leer(CLAVES.CONFIG, {});
  // Mezcla: lo guardado tiene prioridad sobre los defaults
  return { ...CONFIG_DEFAULT, ...guardada };
}

// ── LIMPIEZA ──────────────────────────────────────────────────

/**
 * Elimina todos los datos guardados por este módulo.
 */
export function limpiarTodo() {
  Object.values(CLAVES).forEach(clave => localStorage.removeItem(clave));
}
