/**
 * MÓDULO: exportacion.js
 * ──────────────────────────────────────────────────────────────
 * Exporta la lista de productos en distintos formatos.
 * Cada función es pura: recibe datos, devuelve/descarga archivo.
 *
 * API PÚBLICA:
 *   exportar(items, formato, config) → descarga el archivo
 *   copiarAlPortapapeles(items)      → Promise<void>
 *
 * Formatos soportados: 'pdf' | 'excel' | 'csv' | 'json' | 'txt'
 *
 * Dependencias externas (deben estar cargadas en el HTML):
 *   - jsPDF       (window.jspdf.jsPDF)
 *   - jsPDF-AutoTable
 *   - SheetJS     (window.XLSX)
 */

import { formatearMoneda } from './calculadora.js';

// ── HELPERS ───────────────────────────────────────────────────

/**
 * Genera un nombre de archivo con fecha/hora actual.
 * @param {string} base    - Nombre base
 * @param {string} extension
 * @returns {string}
 */
function nombreArchivo(base, extension) {
  const ahora = new Date();
  const fecha = ahora.toLocaleDateString('es-AR').replace(/\//g, '-');
  const hora  = ahora.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h');
  return `${base}_${fecha}_${hora}.${extension}`;
}

/**
 * Descarga un Blob como archivo en el navegador.
 * @param {Blob}   blob
 * @param {string} nombre
 */
function descargarBlob(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Prepara las filas de datos para exportación.
 * @param {Array<Object>} items
 * @returns {Array<Array>} Filas como arrays de strings
 */
function prepararFilas(items) {
  return items.map((item, i) => [
    (i + 1).toString(),
    item.producto   || '',
    item.categoria  || '',
    formatearMoneda(item.precioOriginal || 0),
    item.cantidad   ? String(item.cantidad) : '-',
    `${item.porcentaje || 0}%`,
    formatearMoneda(item.precioFinal    || 0),
    formatearMoneda(item.subtotal       || 0),
    item.dudoso     ? '⚠ Revisar' : '✓ OK',
    item.notas      || '',
  ]);
}

const ENCABEZADOS = [
  '#', 'Producto', 'Categoría', 'Precio original',
  'Cant./Bulto', '% Aplicado', 'Precio final',
  'Subtotal', 'Estado', 'Notas',
];

// ── EXPORTAR PDF ──────────────────────────────────────────────

/**
 * Exporta la tabla como PDF usando jsPDF + AutoTable.
 * @param {Array<Object>} items
 * @param {Object}        meta  - { titulo?, negocio? }
 */
export function exportarPDF(items, meta = {}) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const titulo   = meta.titulo  || 'Lista de Precios';
  const negocio  = meta.negocio || 'Mi Negocio';
  const fecha    = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  // Encabezado del documento
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 297, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(negocio, 10, 10);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(titulo, 10, 16);
  doc.text(fecha, 287, 16, { align: 'right' });

  // Total general
  const totalGeneral = items.reduce((a, i) => a + (i.subtotal || 0), 0);

  // Tabla
  doc.autoTable({
    head: [ENCABEZADOS],
    body: prepararFilas(items),
    startY: 26,
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.5,
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0:  { cellWidth: 8  },   // #
      3:  { cellWidth: 28 },   // Precio original
      6:  { cellWidth: 28 },   // Precio final
      7:  { cellWidth: 28 },   // Subtotal
      8:  { cellWidth: 18 },   // Estado
    },
    didParseCell(data) {
      // Resaltar filas dudosas
      if (data.row.raw && data.row.raw[8] === '⚠ Revisar') {
        data.cell.styles.fillColor = [254, 243, 199];
      }
    },
  });

  // Total al pie
  const finalY = doc.lastAutoTable.finalY + 5;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(37, 99, 235);
  doc.text(`TOTAL GENERAL: ${formatearMoneda(totalGeneral)}`, 287, finalY, { align: 'right' });

  // Pie de página
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150);
  doc.text('Generado con Calculadora de Precios', 10, doc.internal.pageSize.height - 5);

  doc.save(nombreArchivo('lista-precios', 'pdf'));
}

// ── EXPORTAR EXCEL ────────────────────────────────────────────

/**
 * Exporta como archivo .xlsx usando SheetJS.
 * @param {Array<Object>} items
 * @param {Object}        meta
 */
export function exportarExcel(items, meta = {}) {
  const wb  = XLSX.utils.book_new();

  // Hoja principal
  const filas = [ENCABEZADOS, ...prepararFilas(items)];
  const ws    = XLSX.utils.aoa_to_sheet(filas);

  // Anchos de columna
  ws['!cols'] = [
    { wch: 4  },  // #
    { wch: 30 },  // Producto
    { wch: 15 },  // Categoría
    { wch: 16 },  // Precio original
    { wch: 10 },  // Cant/Bulto
    { wch: 10 },  // %
    { wch: 16 },  // Precio final
    { wch: 16 },  // Subtotal
    { wch: 12 },  // Estado
    { wch: 25 },  // Notas
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Precios');

  // Hoja de resumen por categoría
  const cats = {};
  items.forEach(i => {
    const cat = i.categoria || 'Sin categoría';
    cats[cat] = (cats[cat] || 0) + (i.subtotal || 0);
  });

  const resumenFilas = [
    ['Categoría', 'Total'],
    ...Object.entries(cats).map(([cat, total]) => [cat, formatearMoneda(total)]),
    [],
    ['TOTAL GENERAL', formatearMoneda(items.reduce((a, i) => a + (i.subtotal || 0), 0))],
  ];

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenFilas);
  wsResumen['!cols'] = [{ wch: 20 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

  XLSX.writeFile(wb, nombreArchivo('lista-precios', 'xlsx'));
}

// ── EXPORTAR CSV ──────────────────────────────────────────────

/**
 * Exporta como CSV (UTF-8 con BOM para que Excel lo abra bien en Windows).
 * @param {Array<Object>} items
 */
export function exportarCSV(items) {
  const escapar = v => `"${String(v).replace(/"/g, '""')}"`;
  const filas   = [ENCABEZADOS, ...prepararFilas(items)]
    .map(fila => fila.map(escapar).join(','))
    .join('\r\n');

  // BOM para compatibilidad con Excel en Windows
  const bom  = '\uFEFF';
  const blob = new Blob([bom + filas], { type: 'text/csv;charset=utf-8;' });
  descargarBlob(blob, nombreArchivo('lista-precios', 'csv'));
}

// ── EXPORTAR JSON ─────────────────────────────────────────────

/**
 * Exporta como JSON estructurado.
 * @param {Array<Object>} items
 * @param {Object}        meta
 */
export function exportarJSON(items, meta = {}) {
  const payload = {
    meta: {
      version:      '1.0',
      generado:     new Date().toISOString(),
      totalItems:   items.length,
      totalGeneral: items.reduce((a, i) => a + (i.subtotal || 0), 0),
      ...meta,
    },
    items: items.map(item => ({
      id:              item.id,
      producto:        item.producto,
      categoria:       item.categoria,
      precioOriginal:  item.precioOriginal,
      porcentaje:      item.porcentaje,
      precioFinal:     item.precioFinal,
      subtotal:        item.subtotal,
      cantidad:        item.cantidad,
      dudoso:          item.dudoso,
      notas:           item.notas,
    })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  descargarBlob(blob, nombreArchivo('lista-precios', 'json'));
}

// ── EXPORTAR TXT ──────────────────────────────────────────────

/**
 * Exporta como texto plano con formato legible.
 * @param {Array<Object>} items
 * @param {Object}        meta
 */
export function exportarTXT(items, meta = {}) {
  const linea = (char, largo = 60) => char.repeat(largo);
  const col   = (str, largo) => String(str ?? '').padEnd(largo).substring(0, largo);

  const totalGeneral = items.reduce((a, i) => a + (i.subtotal || 0), 0);
  const fecha        = new Date().toLocaleString('es-AR');

  const lineas = [
    linea('='),
    `  ${(meta.negocio || 'MI NEGOCIO').toUpperCase()}`,
    `  ${meta.titulo   || 'LISTA DE PRECIOS'}`,
    `  Fecha: ${fecha}`,
    linea('='),
    '',
    `${col('#', 3)} ${col('PRODUCTO', 24)} ${col('CATEGORÍA', 13)} ${col('P.ORIGINAL', 12)} ${col('P.FINAL', 12)} ${col('SUBTOTAL', 12)}`,
    linea('-'),
  ];

  items.forEach((item, i) => {
    const marcaDudoso = item.dudoso ? ' ⚠' : '';
    lineas.push(
      `${col(i + 1, 3)} ${col((item.producto || '') + marcaDudoso, 24)} ` +
      `${col(item.categoria  || '', 13)} ` +
      `${col(formatearMoneda(item.precioOriginal || 0), 12)} ` +
      `${col(formatearMoneda(item.precioFinal    || 0), 12)} ` +
      `${col(formatearMoneda(item.subtotal       || 0), 12)}`
    );
  });

  lineas.push(
    linea('-'),
    `${'TOTAL GENERAL:'.padStart(55)} ${formatearMoneda(totalGeneral)}`,
    '',
    linea('='),
    '⚠ = Producto detectado automáticamente, requiere revisión.',
    `Generado por Calculadora de Precios`,
    linea('='),
  );

  const blob = new Blob([lineas.join('\n')], { type: 'text/plain;charset=utf-8;' });
  descargarBlob(blob, nombreArchivo('lista-precios', 'txt'));
}

// ── COPIAR AL PORTAPAPELES ────────────────────────────────────

/**
 * Copia la tabla como texto tabulado al portapapeles.
 * @param {Array<Object>} items
 * @returns {Promise<void>}
 */
export async function copiarAlPortapapeles(items) {
  const filas = [ENCABEZADOS, ...prepararFilas(items)]
    .map(fila => fila.join('\t'))
    .join('\n');

  await navigator.clipboard.writeText(filas);
}

// ── FUNCIÓN UNIFICADA ─────────────────────────────────────────

/**
 * Punto de entrada único para exportar en cualquier formato.
 * Ideal para integración con el sistema mayor.
 *
 * @param {Array<Object>} items    - Lista de ítems calculados
 * @param {string}        formato  - 'pdf'|'excel'|'csv'|'json'|'txt'|'clipboard'
 * @param {Object}        config   - { meta: { titulo, negocio } }
 * @returns {Promise<void>}
 */
export async function exportar(items, formato, config = {}) {
  const meta = config.meta || {};

  if (!items || items.length === 0) {
    throw new Error('No hay productos para exportar');
  }

  switch (formato) {
    case 'pdf':       exportarPDF(items, meta);           break;
    case 'excel':     exportarExcel(items, meta);         break;
    case 'csv':       exportarCSV(items);                 break;
    case 'json':      exportarJSON(items, meta);          break;
    case 'txt':       exportarTXT(items, meta);           break;
    case 'clipboard': await copiarAlPortapeles(items);    break;
    default:
      throw new Error(`Formato no soportado: ${formato}`);
  }
}
