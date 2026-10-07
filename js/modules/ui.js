/**
 * MÓDULO: ui.js
 * ──────────────────────────────────────────────────────────────
 * Todo lo relacionado con el DOM: render de tabla, toast,
 * actualización de totales, gestión de filas, etc.
 *
 * Este módulo SÍ toca el DOM, pero lo hace de forma controlada
 * y separada de la lógica de cálculo y exportación.
 *
 * API PÚBLICA:
 *   renderTabla(items, onCambio)
 *   mostrarToast(mensaje, tipo, duracion)
 *   actualizarTotalGeneral(items)
 *   actualizarResumenCategorias(items)
 *   mostrarOCRStatus(mensaje, tipo)
 *   ocultarOCRStatus()
 *   leerConfigFormulario() → Object
 *   aplicarConfigFormulario(config)
 */

import { CATEGORIAS, formatearMoneda, calcularSubtotalesPorCategoria } from './calculadora.js';

// ── REFERENCIAS AL DOM ────────────────────────────────────────
// Se obtienen una sola vez al importar el módulo.

const $ = id => document.getElementById(id);

const EL = {
  tbody:          $('tbody-productos'),
  total:          $('celda-total'),
  resumenCats:    $('resumen-categorias'),
  ocrStatus:      $('ocr-status'),
  toast:          $('toast'),
  porcentaje:     $('input-porcentaje'),
  modo:           $('sel-modo'),
  tipoVenta:      $('sel-tipo-venta'),
  cantidadBulto:  $('input-cantidad-bulto'),
  redondeo:       $('sel-redondeo'),
  grupoCantBulto: $('grupo-cantidad-bulto'),
  filtro:         $('input-filtro'),
};

// ── TOAST ─────────────────────────────────────────────────────

let _toastTimeout = null;

/**
 * Muestra una notificación flotante.
 * @param {string} mensaje
 * @param {'info'|'success'|'error'} tipo
 * @param {number} duracion - ms
 */
export function mostrarToast(mensaje, tipo = 'info', duracion = 3000) {
  const el = EL.toast;
  el.textContent = mensaje;
  el.className   = `toast ${tipo}`;
  clearTimeout(_toastTimeout);
  _toastTimeout = setTimeout(() => { el.className = 'toast hidden'; }, duracion);
}

// ── OCR STATUS ────────────────────────────────────────────────

export function mostrarOCRStatus(mensaje, tipo = 'info') {
  EL.ocrStatus.textContent = mensaje;
  EL.ocrStatus.className   = `ocr-status ${tipo === 'error' ? 'error' : ''}`;
  EL.ocrStatus.classList.remove('hidden');
}

export function ocultarOCRStatus() {
  EL.ocrStatus.classList.add('hidden');
}

// ── FORMULARIO ────────────────────────────────────────────────

/**
 * Lee los valores actuales del formulario de configuración.
 * @returns {Object} Configuración activa
 */
export function leerConfigFormulario() {
  return {
    porcentaje:    parseFloat(EL.porcentaje.value)    || 30,
    modo:          EL.modo.value                      || 'aumento',
    tipoVenta:     EL.tipoVenta.value                 || 'unidad',
    cantidadBulto: parseInt(EL.cantidadBulto.value, 10) || 12,
    redondeo:      EL.redondeo.value                  || '2',
    porcentajeGlobal: parseFloat(EL.porcentaje.value) || 30,
  };
}

/**
 * Aplica una configuración al formulario (para restaurar desde storage).
 * @param {Object} config
 */
export function aplicarConfigFormulario(config) {
  if (config.porcentaje    != null) EL.porcentaje.value    = config.porcentaje;
  if (config.modo          != null) EL.modo.value          = config.modo;
  if (config.tipoVenta     != null) EL.tipoVenta.value     = config.tipoVenta;
  if (config.cantidadBulto != null) EL.cantidadBulto.value = config.cantidadBulto;
  if (config.redondeo      != null) EL.redondeo.value      = config.redondeo;

  toggleGrupoBulto();
}

/** Muestra/oculta el campo de unidades por bulto según tipo de venta */
export function toggleGrupoBulto() {
  const mostrar = EL.tipoVenta.value === 'bulto';
  EL.grupoCantBulto.style.display = mostrar ? '' : 'none';
}

// ── TABLA ─────────────────────────────────────────────────────

/** Genera el HTML del select de categorías */
function selectCategorias(valorActual) {
  const opts = CATEGORIAS.map(cat => {
    const sel = cat === valorActual ? ' selected' : '';
    return `<option value="${cat}"${sel}>${cat}</option>`;
  }).join('');
  return `<select class="celda-editable" data-campo="categoria">${opts}</select>`;
}

/** Genera una fila <tr> para un ítem */
function crearFilaHTML(item, index) {
  const estadoBadge = item.dudoso
    ? `<span class="badge-dudoso" title="${item.notas || ''}">⚠ Revisar</span>`
    : `<span class="badge-ok">✓ OK</span>`;

  return `
    <tr data-id="${item.id}" class="${item.dudoso ? 'dudoso' : ''}">
      <td class="num-fila">${index + 1}</td>
      <td>
        <input class="celda-editable" data-campo="producto"
               value="${(item.producto || '').replace(/"/g, '&quot;')}"
               placeholder="Nombre del producto" />
      </td>
      <td>${selectCategorias(item.categoria)}</td>
      <td>
        <input class="celda-editable" type="number" data-campo="precioOriginal"
               value="${item.precioOriginal || 0}" min="0" step="0.01" />
      </td>
      <td>
        <input class="celda-editable" type="number" data-campo="cantidad"
               value="${item.cantidad || 1}" min="1" step="1"
               placeholder="1" style="width:56px;" />
      </td>
      <td>
        <input class="celda-editable" type="number" data-campo="porcentaje"
               value="${item.porcentaje ?? ''}" min="0" step="0.5"
               placeholder="Global" style="width:64px;" />
      </td>
      <td class="precio-final-cell">${formatearMoneda(item.precioFinal || 0)}</td>
      <td>${formatearMoneda(item.subtotal || 0)}</td>
      <td>${estadoBadge}</td>
      <td>
        <button class="btn-fila-del" data-id="${item.id}" title="Eliminar fila">✕</button>
      </td>
    </tr>
  `;
}

/**
 * Renderiza la tabla completa.
 *
 * @param {Array<Object>} items     - Lista de ítems ya calculados
 * @param {Function}      onCambio  - Callback(campo, valor, id) cuando el usuario edita
 * @param {string}        filtro    - Texto de búsqueda
 */
export function renderTabla(items, onCambio, filtro = '') {
  const filtroMin = filtro.toLowerCase();
  const itemsFiltrados = filtroMin
    ? items.filter(i =>
        (i.producto  || '').toLowerCase().includes(filtroMin) ||
        (i.categoria || '').toLowerCase().includes(filtroMin)
      )
    : items;

  if (itemsFiltrados.length === 0) {
    EL.tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align:center;padding:24px;color:var(--color-text-3);">
          ${filtroMin ? '🔍 Sin resultados para ese filtro.' : '📋 Todavía no hay productos. Cargá una imagen o agregá uno manualmente.'}
        </td>
      </tr>`;
    actualizarTotalGeneral(items);
    actualizarResumenCategorias(items);
    return;
  }

  EL.tbody.innerHTML = itemsFiltrados.map((item, i) => crearFilaHTML(item, i)).join('');

  // Eventos de edición
  EL.tbody.querySelectorAll('.celda-editable').forEach(input => {
    const evento = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(evento, e => {
      const campo = e.target.dataset.campo;
      const fila  = e.target.closest('tr');
      const id    = fila?.dataset.id;
      if (campo && id) onCambio(campo, e.target.value, id);
    });
  });

  actualizarTotalGeneral(items);
  actualizarResumenCategorias(items);
}

// ── TOTALES ───────────────────────────────────────────────────

/**
 * Actualiza la celda de total general en el <tfoot>.
 * @param {Array<Object>} items
 */
export function actualizarTotalGeneral(items) {
  const total = items.reduce((a, i) => a + (Number(i.subtotal) || 0), 0);
  EL.total.textContent = formatearMoneda(total);
}

/**
 * Actualiza el resumen de chips por categoría.
 * @param {Array<Object>} items
 */
export function actualizarResumenCategorias(items) {
  const subs = calcularSubtotalesPorCategoria(items);
  const html = Object.entries(subs)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, total]) =>
      `<span class="cat-chip">${cat}: <strong>${formatearMoneda(total)}</strong></span>`
    )
    .join('');
  EL.resumenCats.innerHTML = html || '';
}

// ── VISTA PREVIA DE IMÁGENES ──────────────────────────────────

/**
 * Agrega una previsualización de imagen al contenedor.
 * @param {string}   dataURL  - Base64 de la imagen
 * @param {string}   nombre   - Nombre del archivo
 * @param {Function} onRemove - Callback cuando se elimina
 * @returns {HTMLElement} El elemento creado
 */
export function agregarPrevisualizacion(dataURL, nombre, onRemove) {
  const contenedor = $('previsualizaciones');
  const div  = document.createElement('div');
  div.className = 'preview-item';
  div.title     = nombre;

  const img = document.createElement('img');
  img.src = dataURL;
  img.alt = nombre;

  const btn = document.createElement('button');
  btn.className = 'preview-remove';
  btn.title     = 'Quitar imagen';
  btn.innerHTML = '✕';
  btn.addEventListener('click', () => {
    contenedor.removeChild(div);
    onRemove();
  });

  div.appendChild(img);
  div.appendChild(btn);
  contenedor.appendChild(div);
  return div;
}

/**
 * Limpia todas las previsualizaciones.
 */
export function limpiarPrevisualizaciones() {
  $('previsualizaciones').innerHTML = '';
}
