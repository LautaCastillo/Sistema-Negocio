/**
 * MÓDULO: ocr.js
 * ──────────────────────────────────────────────────────────────
 * Procesamiento de imágenes mediante OCR (Tesseract.js).
 * Sin referencias al DOM de la UI — solo recibe archivos y
 * devuelve datos estructurados.
 *
 * API PÚBLICA:
 *   procesarImagen(file, onProgreso) → Promise<{ texto, items }>
 *   parsearTextoEnItems(texto)       → Array<Item>
 *
 * EXTENSIÓN FUTURA (Claude Vision):
 *   procesarImagenConClaude(file)    → Promise<{ items }>
 *   (ver comentario al final del archivo)
 */

// ── HELPERS ───────────────────────────────────────────────────

/**
 * Convierte un File a data URL (base64).
 * @param {File} file
 * @returns {Promise<string>}
 */
function fileADataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

// ── PARSEO DE TEXTO OCR ───────────────────────────────────────

/**
 * Patrones para detectar precios en texto extraído por OCR.
 * Cubre formatos: $1.234,56  /  1234.56  /  1.234  /  $ 1234
 */
const REGEX_PRECIO = /\$?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g;

/**
 * Normaliza un string de precio a número.
 * Maneja formato argentino (punto=miles, coma=decimal)
 * y formato internacional (coma=miles, punto=decimal).
 * @param {string} str
 * @returns {number}
 */
function normalizarPrecio(str) {
  // Remover símbolo $ y espacios
  let s = str.replace(/[$\s]/g, '');

  // Detectar formato: si tiene coma seguida de exactamente 2 dígitos al final → decimal
  if (/,\d{2}$/.test(s)) {
    // Formato argentino: 1.234,56
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (/\.\d{2}$/.test(s)) {
    // Formato con punto decimal: 1234.56 o 1,234.56
    s = s.replace(/,/g, '');
  } else {
    // Sin decimales claros, eliminar separadores de miles
    s = s.replace(/[.,]/g, '');
  }

  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
}

/**
 * Analiza el texto crudo del OCR y extrae ítems detectados.
 * Heurística: una línea que contiene texto + precio es un producto.
 *
 * @param {string} texto - Texto crudo extraído por Tesseract
 * @returns {Array<Object>} Lista de ítems con { producto, precioOriginal, dudoso }
 */
export function parsearTextoEnItems(texto) {
  if (!texto || typeof texto !== 'string') return [];

  const lineas = texto
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 2);

  const items = [];

  for (const linea of lineas) {
    // Buscar todos los precios en la línea
    const matches = [...linea.matchAll(REGEX_PRECIO)];
    if (matches.length === 0) continue;

    // Tomar el último número como precio (convención en facturas y remitos)
    const ultimoMatch = matches[matches.length - 1];
    const precio = normalizarPrecio(ultimoMatch[0]);

    // Ignorar precios irrealmente bajos o altos (posiblemente cantidades)
    if (precio <= 0 || precio > 9_999_999) continue;

    // El nombre del producto es todo lo anterior al precio
    const nombreRaw = linea
      .substring(0, ultimoMatch.index)
      .replace(/[$\d.,\s]+$/, '')
      .trim();

    // Un nombre muy corto o solo números → dudoso
    const dudoso = nombreRaw.length < 3 || /^\d+$/.test(nombreRaw);

    items.push({
      id: crypto.randomUUID(),
      producto: nombreRaw || `Producto detectado`,
      categoria: 'Otros',
      precioOriginal: precio,
      porcentaje: null, // usará el global
      dudoso,
      notas: dudoso ? 'Revisar: detección dudosa' : '',
    });
  }

  return items;
}

// ── FUNCIÓN PRINCIPAL ─────────────────────────────────────────

/**
 * Procesa una imagen con Tesseract.js (OCR local en el navegador).
 * No requiere conexión a internet.
 *
 * @param {File}     file        - Archivo de imagen
 * @param {Function} onProgreso  - Callback(porcentaje: number, mensaje: string)
 * @returns {Promise<{ texto: string, items: Array }>}
 */
export async function procesarImagen(file, onProgreso = () => {}) {
  if (!file) throw new Error('No se proporcionó ningún archivo');

  // Verificar que Tesseract esté disponible
  if (typeof Tesseract === 'undefined') {
    throw new Error('Tesseract.js no está disponible. Verificá que el script esté cargado.');
  }

  onProgreso(5, 'Cargando imagen...');

  const dataURL = await fileADataURL(file);

  onProgreso(15, 'Iniciando reconocimiento de texto...');

  const resultado = await Tesseract.recognize(dataURL, 'spa+eng', {
    logger: info => {
      if (info.status === 'recognizing text') {
        const pct = Math.round((info.progress || 0) * 80) + 15;
        onProgreso(pct, `Procesando imagen: ${Math.round((info.progress || 0) * 100)}%`);
      }
    },
  });

  onProgreso(95, 'Analizando texto detectado...');

  const texto = resultado.data.text || '';
  const items = parsearTextoEnItems(texto);

  onProgreso(100, `Detección completa. ${items.length} producto(s) encontrado(s).`);

  return { texto, items };
}

/**
 * Procesa múltiples imágenes de forma secuencial.
 *
 * @param {FileList|Array<File>} archivos
 * @param {Function}             onProgreso  - Callback(porcentaje, mensaje, indice)
 * @returns {Promise<Array>} Lista de todos los ítems detectados (sin duplicados de ids)
 */
export async function procesarVariasImagenes(archivos, onProgreso = () => {}) {
  const lista = Array.from(archivos);
  let todosItems = [];

  for (let i = 0; i < lista.length; i++) {
    const archivo = lista[i];
    onProgreso(0, `Procesando imagen ${i + 1} de ${lista.length}...`, i);

    const { items } = await procesarImagen(archivo, (pct, msg) => {
      onProgreso(pct, msg, i);
    });

    todosItems = [...todosItems, ...items];
  }

  return todosItems;
}

// ── EXTENSIÓN FUTURA: CLAUDE VISION ───────────────────────────
/**
 * TODO: procesarImagenConClaude(file)
 *
 * Cuando se implemente el backend Node.js/Express:
 *
 * export async function procesarImagenConClaude(file) {
 *   const formData = new FormData();
 *   formData.append('imagen', file);
 *
 *   const resp = await fetch('/api/ocr/claude', {
 *     method: 'POST',
 *     body: formData,
 *   });
 *
 *   if (!resp.ok) throw new Error('Error en el servidor OCR');
 *   const data = await resp.json();
 *   return { items: data.items }; // mismo formato que procesarImagen
 * }
 *
 * La función devuelve exactamente el mismo formato que procesarImagen,
 * por lo que el código que la consume NO necesita cambios.
 */
