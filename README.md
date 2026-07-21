# mercadostock_lite

🚀 **[Abrir la aplicación (GitHub Pages)](https://bryansuarezdev.github.io/mercadostock_lite/)**

`mercadostock_lite` es una herramienta ligera y rápida que te permite sincronizar automáticamente el stock de tu bodega con las publicaciones de Mercado Libre.

Toma el archivo Excel de publicaciones exportado desde Mercado Libre y el archivo Excel con el stock actual de tu bodega, cruza la información utilizando el **SKU**, aplica unas reglas predefinidas y genera un nuevo archivo de Mercado Libre con la columna de stock actualizada. ¡Todo listo para que simplemente lo reimportes en Mercado Libre!

---

## 🛠️ ¿Cómo se usa?

1. **Entra a la aplicación web**: Accede a [https://bryansuarezdev.github.io/mercadostock_lite/](https://bryansuarezdev.github.io/mercadostock_lite/).
2. **Carga el Excel de Mercado Libre**: Arrastra o selecciona el archivo descargado desde Mercado Libre (suele llamarse `Publicaciones-FECHA.xlsx`).
3. **Carga el Excel de tu bodega**: Arrastra o selecciona tu archivo de stock (suele llamarse `Stock-actual_BODEGA_FECHA.xlsx`).
4. **Configura y revisa**: Ajusta las reglas de stock (cuánto publicar dependiendo del stock real) si lo necesitas. Mira la vista previa para comprobar los cambios.
5. **Descarga**: Presiona "Descargar Excel actualizado". Obtendrás un archivo `..._SYNC.xlsx` que puedes subir directamente de vuelta a Mercado Libre.

> 🔒 **Privacidad y Seguridad**: Todo el procesamiento se hace directamente en tu navegador. **Ningún archivo se sube a ningún servidor**, garantizando que tu información comercial permanezca privada y segura en tu equipo local.

---

## ⚙️ Reglas de Stock

Para no publicar todo tu stock real y tener un margen de seguridad, la app permite configurar "reglas" lógicas. Las reglas se evalúan en orden (de arriba hacia abajo) y se aplica la primera que se cumpla.

Por defecto vienen configuradas así:

| Si el stock en bodega es... | Se publica en Mercado Libre... |
| ------------------------- | ---------------------------- |
| Mayor a `20`                | `10` unidades                  |
| Mayor a `10`                | `5` unidades                   |
| Mayor o igual a `5`         | `1` unidad                     |
| Si no aplica ninguna regla| `0` unidades (fallback)        |

Todas estas reglas son completamente **editables en pantalla** (puedes cambiar la condición, la cantidad o borrarlas) y se guardan en tu navegador automáticamente para la próxima vez que entres.

---

## 🧠 Detalles Técnicos y Lógica

- **Intacto por diseño**: La aplicación edita directamente el archivo `.xlsx` (tratándolo como ZIP + XML) modificando **únicamente las celdas de la columna de stock**. Todo lo demás (formato, ID interno de cuenta en las hojas ocultas, etc.) se mantiene intacto, lo que asegura que Mercado Libre acepte el archivo de vuelta sin dar errores.
- **Cruce por SKU**: El sistema mapea cada publicación con la bodega usando la columna `SKU`.
- **Productos no encontrados**: Si una publicación de Mercado Libre tiene un SKU que no existe en el Excel de tu bodega, esa fila se ignora por completo (no se actualiza) y se te avisa en la vista previa.
- **Variantes múltiples**: Si varias publicaciones distintas comparten el mismo SKU, todas recibirán la misma actualización de stock basada en tus reglas.

---

## 📁 Estructura del Proyecto

Esta es la versión modular del proyecto:

- `index.html`: La interfaz principal.
- `assets/styles.css`: Estilos visuales.
- `assets/app.js`: La lógica central de carga, cruce de datos y generación.
- `assets/xlsx-io.js`: Módulo para leer y modificar los ficheros `.xlsx` (ZIP/XML).
- `assets/fflate.js`: Librería externa para manejo de archivos comprimidos.

---

### Aviso de Desarrollo
*Nota: Los archivos Excel de ejemplo de publicaciones y stock (`.xlsx`, `.csv`, etc.) están incluidos en el archivo `.gitignore` para asegurar que datos de costos y márgenes no sean expuestos públicamente en el repositorio.*
