# mercadostock_lite

Sincroniza el stock de bodega con las publicaciones de Mercado Libre.

Toma el Excel de publicaciones que exporta Mercado Libre y el Excel de stock de bodega,
los cruza por **SKU**, aplica reglas configurables de stock y devuelve **el mismo archivo
de Mercado Libre** con la columna de stock actualizada, listo para reimportar.

## Cómo se usa

1. Abre `index.html` (doble clic, o desde GitHub Pages).
2. Arrastra el Excel de Mercado Libre (`Publicaciones-FECHA.xlsx`).
3. Arrastra el Excel de stock de bodega (`Stock-actual_BODEGA_FECHA.xlsx`).
4. Ajusta las reglas si hace falta y revisa la vista previa.
5. Descarga `..._SYNC.xlsx` y súbelo a Mercado Libre.

Todo ocurre en el navegador. No hay servidor, no hay base de datos y ningún archivo sale del equipo.

## Reglas

Se evalúan de arriba hacia abajo y gana la primera que se cumple. Por defecto:

| Stock en bodega | Se publica en Meli |
| --------------- | ------------------ |
| > 20            | 10                 |
| > 10            | 5                  |
| >= 5            | 1                  |
| resto           | 0                  |

Son editables en pantalla (operador, umbral y valor) y quedan guardadas en el
navegador vía `localStorage`.

## Detalles de implementación

- El `.xlsx` se abre como ZIP y se editan **solo las celdas de la columna de stock**
  en el XML de la hoja. El resto del archivo (formato, hojas, la hoja `hidden` con el
  identificador de la cuenta) queda intacto, que es lo que Mercado Libre necesita
  para aceptar la reimportación.
- El cruce es por la columna `SKU` de ambos archivos.
- Si un SKU de una publicación no existe en bodega, esa fila **se deja sin tocar**
  en vez de mandarla a 0, y se lista aparte en la vista previa.
- Varias publicaciones pueden compartir el mismo SKU (variantes): todas reciben
  el mismo valor calculado.

## Estructura

```
index.html            marcado
assets/styles.css     estilos
assets/xlsx-io.js     lectura/escritura de .xlsx (ZIP + XML), sin lógica de negocio
assets/app.js         carga de archivos, reglas, vista previa y descarga
assets/fflate.js      librería de compresión (vendor)
```

## Publicar en GitHub Pages

Settings → Pages → Source: `Deploy from a branch` → rama `main`, carpeta `/ (root)`.

## Aviso

Los Excel de stock y publicaciones están en `.gitignore`: contienen costos, márgenes
y precios de compra. No los subas al repositorio.
