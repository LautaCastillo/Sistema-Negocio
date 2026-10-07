# 🏷️ Calculadora de Precios

Módulo web autónomo para calcular y exportar listas de precios.
Parte de un sistema mayor para negocio multiproducto.

---

## 📁 Estructura de carpetas

```
calculadora-precios/
│
├── index.html                  ← Punto de entrada principal
│
├── css/
│   └── styles.css              ← Estilos (variables CSS, mobile-first)
│
├── js/
│   ├── app.js                  ← Orquestador: conecta todos los módulos
│   └── modules/
│       ├── calculadora.js      ← Lógica PURA de cálculo (sin DOM)
│       ├── ocr.js              ← Procesamiento de imágenes con Tesseract.js
│       ├── exportacion.js      ← Exportar en PDF, Excel, CSV, JSON, TXT
│       ├── storage.js          ← Persistencia con localStorage
│       └── ui.js               ← Render del DOM, tabla, toast, etc.
│
└── README.md                   ← Este archivo
```

---

## 🚀 Cómo usarlo

### Opción 1 — Abrir directamente en el navegador (más simple)

1. Descargá o copiá toda la carpeta `calculadora-precios/`
2. Abrí `index.html` con Chrome o Firefox
3. Listo. No necesitás instalar nada ni tener internet

> **En el celular:** pasá la carpeta por USB, WhatsApp o Google Drive,
> abrí `index.html` con Chrome para Android.

### Opción 2 — Servidor local (recomendado para desarrollo)

```bash
# Con Python (viene instalado en Mac/Linux):
cd calculadora-precios
python3 -m http.server 8080
# Abrí http://localhost:8080

# Con Node.js:
npx serve .
```

> Los módulos ES (`import/export`) requieren un servidor HTTP cuando
> estás en desarrollo. Para producción, basta con abrir el HTML.

---

## 📦 Dependencias (cargadas desde CDN, sin instalación)

| Librería | Uso |
|---|---|
| Tesseract.js 4.1 | OCR en el navegador |
| jsPDF 2.5 | Generar PDF |
| jsPDF-AutoTable | Tablas en PDF |
| SheetJS 0.18 | Exportar Excel (.xlsx) |

Todas se cargan automáticamente desde `cdnjs.cloudflare.com`.
Para uso offline, descargalas y reemplazá los `<script src="...">` en `index.html`.

---

## 🔌 API interna — Funciones exportadas

### `calculadora.js`
```js
calcularPrecios(items, config)     // Calcula toda la lista
calcularItem(item, config)         // Calcula un ítem
calcularPrecioFinal(precio, %, modo, redondeo)
calcularTotalGeneral(items)
calcularSubtotalesPorCategoria(items)
formatearMoneda(valor)             // "$1.250,50"
```

### `ocr.js`
```js
procesarImagen(file, onProgreso)          // Promise → { texto, items }
procesarVariasImagenes(archivos, onProg)  // Promise → items[]
parsearTextoEnItems(texto)                // Analiza texto crudo OCR
```

### `exportacion.js`
```js
exportar(items, formato, config)   // 'pdf'|'excel'|'csv'|'json'|'txt'|'clipboard'
exportarPDF(items, meta)
exportarExcel(items, meta)
exportarCSV(items)
exportarJSON(items, meta)
exportarTXT(items, meta)
copiarAlPortapapeles(items)
```

### `storage.js`
```js
guardarItems(items)
cargarItems()               // → Array
guardarConfig(config)
cargarConfig()              // → Object
limpiarTodo()
```

### `app.js`
```js
iniciarModuloPrecios(opciones)   // Punto de entrada para integración
```

---

## 🔗 Guía de integración futura

### Insertar dentro de otro sistema

```html
<!-- En tu sistema mayor, donde quieras el módulo -->
<div id="modulo-precios">
  <!-- El contenido del módulo va aquí -->
</div>

<!-- Importar los estilos -->
<link rel="stylesheet" href="calculadora-precios/css/styles.css" />

<!-- Iniciar el módulo con configuración personalizada -->
<script type="module">
  import { iniciarModuloPrecios } from './calculadora-precios/js/app.js';

  iniciarModuloPrecios({
    config: {
      porcentaje: 40,       // % default distinto
      modo: 'margen',       // modo distinto
    }
  });
</script>
```

### Usar solo la lógica de cálculo (sin UI)

```js
import { calcularPrecios } from './calculadora-precios/js/modules/calculadora.js';

const miLista = [
  { id: '1', producto: 'Detergente', precioOriginal: 1500 },
  { id: '2', producto: 'Jabón',      precioOriginal: 800  },
];

const resultado = calcularPrecios(miLista, {
  porcentajeGlobal: 35,
  modo: 'aumento',
  redondeo: '2',
  tipoVenta: 'unidad',
});

console.log(resultado);
// [{ ..., precioFinal: 2025, subtotal: 2025 }, ...]
```

### Usar solo la exportación

```js
import { exportar } from './calculadora-precios/js/modules/exportacion.js';

await exportar(misItems, 'excel', { meta: { negocio: 'La Esquina' } });
```

---

## ⚙️ Configuración disponible

| Campo | Valores | Default | Descripción |
|---|---|---|---|
| `porcentaje` | 0–999 | 30 | % de ajuste |
| `modo` | `aumento` `descuento` `margen` `iva` | `aumento` | Tipo de cálculo |
| `tipoVenta` | `unidad` `bulto` `peso` | `unidad` | Cómo se vende |
| `cantidadBulto` | 1–999 | 12 | Unidades en un bulto |
| `redondeo` | `2` `0` `99` `50` | `2` | Modo de redondeo |

### Fórmulas de cálculo

| Modo | Fórmula | Ejemplo (+30%) |
|---|---|---|
| Aumento | `precio × (1 + %/100)` | $100 → $130 |
| Descuento | `precio × (1 - %/100)` | $100 → $70 |
| Margen | `precio / (1 - %/100)` | $100 → $142.86 |
| IVA | `precio × (1 + %/100)` | $100 → $121 |

---

## 🔮 Próximos pasos y extensiones

### Corto plazo
- [ ] Integración con Claude Vision API para OCR más preciso
- [ ] Campo "nombre del negocio" configurable (aparece en PDF)
- [ ] Historial de listas guardadas

### Mediano plazo
- [ ] Módulo de stock: conectar precio de venta con inventario
- [ ] Sincronización con el sistema mayor vía API REST
- [ ] Modo offline completo (Service Worker + PWA)
- [ ] Soporte para múltiples monedas

### Backend para Claude Vision (cuando lo necesites)
```
backend/
├── server.js          ← Express + multer
├── routes/
│   └── ocr.js         ← POST /api/ocr/claude
└── package.json
```

El módulo `ocr.js` ya tiene el stub con el código comentado.
Solo hay que descomentar y apuntar al servidor.

---

## ⚠️ Limitaciones actuales

1. **OCR con Tesseract.js**: funciona bien en textos claros e impresos.
   Puede tener dificultades con letras escritas a mano, fondos complejos
   o imágenes de baja resolución.

2. **Sin backend**: todo corre en el navegador. Los datos se pierden
   si el usuario borra el localStorage del navegador.

3. **Formatos de precio**: el parser detecta la mayoría de los formatos
   comunes (1.234,56 y 1234.56), pero facturas con formatos muy inusuales
   pueden requerir corrección manual.

4. **Una moneda**: actualmente solo maneja pesos argentinos (ARS).
   El símbolo y el formato están hardcodeados en `formatearMoneda()`.

---

## 🛠️ Tecnologías utilizadas

- **HTML5 + CSS3 + JavaScript ES2022** (módulos nativos)
- **Sin frameworks** — vanilla JS puro para máxima portabilidad
- **Mobile-first** — probado en Chrome para Android

---

*Calculadora de Precios v1.0 — Módulo del Sistema de Gestión de Negocio*
