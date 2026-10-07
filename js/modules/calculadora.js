/**
 * MÓDULO: calculadora.js
 * ──────────────────────────────────────────────────────────────
 * Lógica PURA de cálculo. Sin referencias al DOM.
 * Se puede reutilizar en cualquier entorno (Node, React, Vue, etc.)
 *
 * API PÚBLICA:
 *   calcularItem(item, config) → item enriquecido con precios calculados
 *   calcularPrecios(items, config) → lista completa calculada
 *   aplicarRedondeo(valor, modo) → número redondeado según configuración
 *   calcularTotalGeneral(items) → número
 *   calcularSubtotalesPorCategoria(items) → { categoria: total }
 */

// ── CONSTANTES ────────────────────────────────────────────────

/** Categorías disponibles. Se pueden ampliar desde el sistema mayor. */
export const CATEGORIAS = [
  'Comestibles',
  'Limpieza',
  'Librería',
  'Fiambrería',
  'Bebidas',
  'Regalería',
  'Bisutería',
  'Bebidas alcohólicas',
  'Higiene y perfumería',
  'Otros',
];

/** Modos de cálculo disponibles */
export const MODOS = {
  AUMENTO: 'aumento',
  DESCUENTO: 'descuento',
  MARGEN: 'margen',
  IVA: 'iva',
};

/** Modos de redondeo disponibles */
export const REDONDEO = {
  DOS_DECIMALES: '2',
  ENTERO: '0',
  NOVENTA_Y_NUEVE: '99',
  CINCUENTA: '50',
};

// ── FUNCIONES PURAS ───────────────────────────────────────────

/**
 * Aplica redondeo según el modo configurado.
 * @param {number} valor - Valor a redondear
 * @param {string} modo  - Clave de REDONDEO
 * @returns {number}
 */
export function aplicarRedondeo(valor, modo) {
  switch (modo) {
    case REDONDEO.ENTERO:
      return Math.round(valor);

    case REDONDEO.NOVENTA_Y_NUEVE: {
      const entero = Math.floor(valor);
      return entero + 0.99;
    }

    case REDONDEO.CINCUENTA: {
      const entero = Math.floor(valor);
      return valor - entero < 0.5 ? entero + 0.50 : entero + 1.50;
    }

    case REDONDEO.DOS_DECIMALES:
    default:
      return Math.round(valor * 100) / 100;
  }
}

/**
 * Calcula el precio de venta final a partir de un precio base y configuración.
 *
 * @param {number} precioOriginal  - Precio de costo
 * @param {number} porcentaje      - Porcentaje numérico (ej: 30 para 30%)
 * @param {string} modo            - Clave de MODOS
 * @param {string} redondeo        - Clave de REDONDEO
 * @returns {number} Precio final redondeado
 *
 * Fórmulas:
 *   AUMENTO  → precio * (1 + p/100)            Ej: $100 + 30% = $130
 *   DESCUENTO→ precio * (1 - p/100)            Ej: $100 - 30% = $70
 *   MARGEN   → precio / (1 - p/100)            Ej: quiero ganar 30% sobre venta
 *   IVA      → precio * (1 + p/100)            Igual que aumento, semánticamente distinto
 */
export function calcularPrecioFinal(precioOriginal, porcentaje, modo, redondeo = REDONDEO.DOS_DECIMALES) {
  if (typeof precioOriginal !== 'number' || isNaN(precioOriginal) || precioOriginal < 0) return 0;
  if (typeof porcentaje !== 'number' || isNaN(porcentaje)) return precioOriginal;

  const p = porcentaje / 100;
  let resultado;

  switch (modo) {
    case MODOS.DESCUENTO:
      resultado = precioOriginal * (1 - p);
      break;

    case MODOS.MARGEN:
      // Evitar división por cero o margen >= 100%
      if (p >= 1) return Infinity;
      resultado = precioOriginal / (1 - p);
      break;

    case MODOS.IVA:
    case MODOS.AUMENTO:
    default:
      resultado = precioOriginal * (1 + p);
      break;
  }

  return aplicarRedondeo(resultado, redondeo);
}

/**
 * Calcula el subtotal de un ítem según el tipo de venta.
 *
 * @param {number} precioFinal     - Precio ya calculado por unidad
 * @param {string} tipoVenta       - 'unidad' | 'bulto' | 'peso'
 * @param {number} cantidadBulto   - Unidades en un bulto (solo aplica a 'bulto')
 * @returns {number}
 */
export function calcularSubtotal(precioFinal, tipoVenta, cantidadBulto = 1) {
  switch (tipoVenta) {
    case 'bulto':
      return precioFinal * cantidadBulto;
    case 'peso':
    case 'unidad':
    default:
      return precioFinal;
  }
}

/**
 * Enriquece un ítem con sus precios calculados.
 * Esta es la función central del módulo.
 *
 * @param {Object} item   - { precioOriginal, porcentaje?, ... }
 * @param {Object} config - { modo, redondeo, tipoVenta, cantidadBulto, porcentajeGlobal }
 * @returns {Object} Ítem enriquecido con precioFinal y subtotal
 */
export function calcularItem(item, config) {
  const {
    modo = MODOS.AUMENTO,
    redondeo = REDONDEO.DOS_DECIMALES,
    tipoVenta = 'unidad',
    cantidadBulto = 1,
    porcentajeGlobal = 30,
  } = config;

  // El ítem puede tener su propio % o usa el global
  const porcentaje = typeof item.porcentaje === 'number' && !isNaN(item.porcentaje)
    ? item.porcentaje
    : porcentajeGlobal;

  const precioFinal = calcularPrecioFinal(
    Number(item.precioOriginal) || 0,
    porcentaje,
    modo,
    redondeo
  );

  const subtotal = calcularSubtotal(precioFinal, tipoVenta, cantidadBulto);

  return {
    ...item,
    porcentaje,
    precioFinal,
    subtotal,
  };
}

/**
 * Procesa una lista completa de ítems.
 *
 * @param {Array<Object>} items  - Lista de ítems
 * @param {Object}        config - Configuración global
 * @returns {Array<Object>} Lista calculada
 *
 * Punto de integración: llamar desde cualquier sistema mayor
 * con la lista y configuración deseadas.
 */
export function calcularPrecios(items, config) {
  if (!Array.isArray(items)) return [];
  return items.map(item => calcularItem(item, config));
}

/**
 * Suma el subtotal de todos los ítems.
 * @param {Array<Object>} items - Lista con subtotal calculado
 * @returns {number}
 */
export function calcularTotalGeneral(items) {
  return items.reduce((acc, item) => acc + (Number(item.subtotal) || 0), 0);
}

/**
 * Agrupa y suma subtotales por categoría.
 * @param {Array<Object>} items
 * @returns {Object} { 'Comestibles': 1500, 'Limpieza': 800, ... }
 */
export function calcularSubtotalesPorCategoria(items) {
  return items.reduce((acc, item) => {
    const cat = item.categoria || 'Sin categoría';
    acc[cat] = (acc[cat] || 0) + (Number(item.subtotal) || 0);
    return acc;
  }, {});
}

/**
 * Formatea un número como moneda argentina.
 * @param {number} valor
 * @returns {string} Ej: "$1.250,50"
 */
export function formatearMoneda(valor) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(valor);
}
