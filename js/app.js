/**
 * app.js — Orquestador principal
 * ──────────────────────────────────────────────────────────────
 * Conecta todos los módulos: UI ↔ Calculadora ↔ OCR ↔ Storage ↔ Exportación.
 * Este archivo ES el punto de entrada del módulo "Calculadora de Precios".
 *
 * Para integrar en un sistema mayor:
 *   import { iniciarModuloPrecios } from './js/app.js';
 *   iniciarModuloPrecios({ contenedor: '#mi-div', config: { porcentaje: 40 } });
 */

import {
  calcularPrecios,
  CATEGORIAS,
} from './modules/calculadora.js';

import {
  procesarVariasImagenes,
} from './modules/ocr.js';

import {
  exportar,
} from './modules/exportacion.js';

import {
  guardarItems, cargarItems,
  guardarConfig, cargarConfig,
  limpiarTodo,
} from './modules/storage.js';

import {
  renderTabla,
  mostrarToast,
  actualizarTotalGeneral,
  actualizarResumenCategorias,
  mostrarOCRStatus,
  ocultarOCRStatus,
  leerConfigFormulario,
  aplicarConfigFormulario,
  toggleGrupoBulto,
  agregarPrevisualizacion,
  limpiarPrevisualizaciones,
} from './modules/ui.js';

// ── ESTADO GLOBAL DEL MÓDULO ──────────────────────────────────
// Todo el estado vive aquí; los módulos no tienen estado propio.

let estado = {
  items:      [],   // Lista de ítems (con precios calculados)
  imagenes:   [],   // Archivos de imagen cargados
  filtro:     '',   // Texto del filtro de búsqueda
  ordenCol:   null, // Columna de ordenamiento actual
  ordenAsc:   true, // Dirección del ordenamiento
};

// ── HELPERS ───────────────────────────────────────────────────

/** ID único para nuevos ítems */
const nuevoId = () => crypto.randomUUID();

/** Genera un ítem vacío para agregar manualmente */
function itemVacio() {
  return {
    id:             nuevoId(),
    producto:       '',
    categoria:      'Otros',
    precioOriginal: 0,
    porcentaje:     null,
    cantidad:       1,
    precioFinal:    0,
    subtotal:       0,
    dudoso:         false,
    notas:          '',
  };
}

// ── CICLO PRINCIPAL ───────────────────────────────────────────

/**
 * Recalcula todos los precios con la configuración actual
 * y re-renderiza la tabla.
 */
function recalcularYRenderizar() {
  const config = leerConfigFormulario();
  estado.items = calcularPrecios(estado.items, config);

  // Ordenar si hay columna activa
  if (estado.ordenCol) {
    estado.items.sort((a, b) => {
      const av = a[estado.ordenCol] ?? '';
      const bv = b[estado.ordenCol] ?? '';
      if (typeof av === 'number') {
        return estado.ordenAsc ? av - bv : bv - av;
      }
      return estado.ordenAsc
        ? String(av).localeCompare(String(bv), 'es')
        : String(bv).localeCompare(String(av), 'es');
    });
  }

  renderTabla(estado.items, onCeldaCambia, estado.filtro);
  guardarItems(estado.items);
  guardarConfig(config);
}

/**
 * Callback cuando el usuario edita una celda de la tabla.
 * Actualiza el ítem en estado y recalcula.
 * @param {string} campo  - Nombre del campo
 * @param {string} valor  - Nuevo valor (siempre string desde el DOM)
 * @param {string} id     - ID del ítem
 */
function onCeldaCambia(campo, valor, id) {
  const idx = estado.items.findIndex(i => i.id === id);
  if (idx === -1) return;

  // Convertir tipos numéricos
  const numerico = ['precioOriginal', 'porcentaje', 'cantidad'];
  const v = numerico.includes(campo) ? (parseFloat(valor) || 0) : valor;

  // Porcentaje vacío → null (usa el global)
  estado.items[idx] = {
    ...estado.items[idx],
    [campo]: campo === 'porcentaje' && valor === '' ? null : v,
  };

  // Si cambió el porcentaje individual o precio original, marcar como no dudoso
  if (['precioOriginal', 'porcentaje', 'producto'].includes(campo)) {
    estado.items[idx].dudoso = false;
    estado.items[idx].notas  = '';
  }

  recalcularYRenderizar();
}

// ── EVENTOS DE IMAGEN ─────────────────────────────────────────

function manejarArchivos(archivos) {
  if (!archivos || archivos.length === 0) return;

  Array.from(archivos).forEach(archivo => {
    const reader = new FileReader();
    reader.onload = e => {
      agregarPrevisualizacion(e.target.result, archivo.name, () => {
        // Al quitar imagen de la previsualización, no eliminamos ítems ya extraídos
      });
    };
    reader.readAsDataURL(archivo);
    estado.imagenes.push(archivo);
  });

  procesarImagenes(archivos);
}

async function procesarImagenes(archivos) {
  mostrarOCRStatus('⏳ Iniciando reconocimiento de texto...', 'info');

  try {
    const itemsNuevos = await procesarVariasImagenes(archivos, (pct, msg) => {
      mostrarOCRStatus(`⏳ ${msg} (${pct}%)`, 'info');
    });

    if (itemsNuevos.length === 0) {
      mostrarOCRStatus('⚠ No se detectaron productos. Podés agregarlos manualmente.', 'error');
      mostrarToast('No se detectaron productos en la imagen', 'error');
      return;
    }

    // Agregar nuevos ítems al estado existente
    estado.items = [...estado.items, ...itemsNuevos];
    recalcularYRenderizar();

    ocultarOCRStatus();
    mostrarToast(`✓ ${itemsNuevos.length} producto(s) detectado(s)`, 'success');

  } catch (err) {
    console.error('[OCR]', err);
    mostrarOCRStatus(`✕ Error: ${err.message}`, 'error');
    mostrarToast('Error al procesar la imagen', 'error');
  }
}

// ── INICIALIZACIÓN ────────────────────────────────────────────

/**
 * Punto de entrada principal del módulo.
 * Se puede llamar desde el sistema mayor con configuración inicial.
 *
 * @param {Object} opciones - { config?: Object }
 */
export function iniciarModuloPrecios(opciones = {}) {

  // 1. Restaurar estado desde localStorage
  const configGuardada = { ...cargarConfig(), ...(opciones.config || {}) };
  aplicarConfigFormulario(configGuardada);

  estado.items = cargarItems();
  recalcularYRenderizar();

  // ── ZONA DE DROP ─────────────────────────────────────────
  const zonaDrop = document.getElementById('zona-drop');

  zonaDrop.addEventListener('dragover', e => {
    e.preventDefault();
    zonaDrop.classList.add('over');
  });
  zonaDrop.addEventListener('dragleave', () => zonaDrop.classList.remove('over'));
  zonaDrop.addEventListener('drop', e => {
    e.preventDefault();
    zonaDrop.classList.remove('over');
    manejarArchivos(e.dataTransfer.files);
  });
  zonaDrop.addEventListener('click', () => document.getElementById('input-archivo').click());
  zonaDrop.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') document.getElementById('input-archivo').click();
  });

  // ── INPUTS DE ARCHIVO ─────────────────────────────────────
  document.getElementById('input-archivo').addEventListener('change', e => {
    manejarArchivos(e.target.files);
    e.target.value = ''; // reset para permitir mismo archivo
  });

  document.getElementById('input-camara').addEventListener('change', e => {
    manejarArchivos(e.target.files);
    e.target.value = '';
  });

  // ── TIPO DE VENTA → mostrar/ocultar campo bulto ───────────
  document.getElementById('sel-tipo-venta').addEventListener('change', () => {
    toggleGrupoBulto();
    recalcularYRenderizar();
  });

  // ── BOTÓN CALCULAR ────────────────────────────────────────
  document.getElementById('btn-calcular').addEventListener('click', () => {
    recalcularYRenderizar();
    mostrarToast('✓ Precios actualizados', 'success');
  });

  // ── BOTÓN AGREGAR FILA ────────────────────────────────────
  document.getElementById('btn-agregar-fila').addEventListener('click', () => {
    estado.items.push(itemVacio());
    recalcularYRenderizar();
  });

  // ── ELIMINAR FILA (delegación de eventos) ─────────────────
  document.getElementById('tbody-productos').addEventListener('click', e => {
    const btn = e.target.closest('.btn-fila-del');
    if (!btn) return;
    const id = btn.dataset.id;
    estado.items = estado.items.filter(i => i.id !== id);
    recalcularYRenderizar();
    mostrarToast('Producto eliminado', 'info');
  });

  // ── RECALCULAR AUTOMÁTICO AL CAMBIAR CONFIGURACIÓN ────────
  ['input-porcentaje', 'sel-modo', 'sel-redondeo', 'input-cantidad-bulto'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => {
      if (estado.items.length > 0) recalcularYRenderizar();
    });
  });

  // ── FILTRO DE BÚSQUEDA ────────────────────────────────────
  document.getElementById('input-filtro').addEventListener('input', e => {
    estado.filtro = e.target.value;
    renderTabla(estado.items, onCeldaCambia, estado.filtro);
  });

  // ── ORDENAMIENTO POR COLUMNAS ─────────────────────────────
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (estado.ordenCol === col) {
        estado.ordenAsc = !estado.ordenAsc;
      } else {
        estado.ordenCol = col;
        estado.ordenAsc = true;
      }
      recalcularYRenderizar();
    });

    th.addEventListener('keydown', e => {
      if (e.key === 'Enter') th.click();
    });
  });

  // ── EXPORTACIÓN ───────────────────────────────────────────
  document.querySelectorAll('.btn-export').forEach(btn => {
    btn.addEventListener('click', async () => {
      const formato = btn.dataset.formato;
      if (estado.items.length === 0) {
        mostrarToast('No hay productos para exportar', 'error');
        return;
      }
      try {
        await exportar(estado.items, formato, {
          meta: { titulo: 'Lista de Precios', negocio: 'Mi Negocio' },
        });
        if (formato === 'clipboard') {
          mostrarToast('✓ Copiado al portapapeles', 'success');
        } else {
          mostrarToast(`✓ Exportado como ${formato.toUpperCase()}`, 'success');
        }
      } catch (err) {
        console.error('[Exportación]', err);
        mostrarToast(`Error al exportar: ${err.message}`, 'error');
      }
    });
  });

  // ── LIMPIAR TODO ──────────────────────────────────────────
  document.getElementById('btn-limpiar-todo').addEventListener('click', () => {
    const confirmar = window.confirm('¿Seguro que querés borrar todos los productos y empezar de cero?');
    if (!confirmar) return;
    estado.items   = [];
    estado.imagenes = [];
    estado.filtro  = '';
    limpiarTodo();
    limpiarPrevisualizaciones();
    ocultarOCRStatus();
    recalcularYRenderizar();
    mostrarToast('Todo limpiado', 'info');
  });

  console.log('[Calculadora de Precios] Módulo iniciado correctamente.');
}

// ── AUTO-INICIO ───────────────────────────────────────────────
// Si el módulo se abre directamente (no integrado), se inicia solo.
iniciarModuloPrecios();
