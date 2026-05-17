# Inventario de Libros

Aplicacion estatica para administrar libros en inventario.

- Inventario con nombre, autor opcional, paginas, precio, stock y valor.
- Crear libro con formulario, autor opcional, cliente opcional y telefono del cliente.
- Asignar cliente reserva solo una unidad del libro, dejando el resto como stock libre.
- Inventario separado visualmente entre unidades sin cliente y unidades asignadas a clientes.
- Agregar unidades a libros existentes y asignar una de esas unidades a un cliente.
- Vender libros y descontar automaticamente el stock libre o la unidad asignada.
- Guardar e importar respaldos en formato JSON.
- Modificar o eliminar libros con clave.
- Resumen con valor total, stock, paginas acumuladas e ideas del inventario.

La clave por defecto para modificar o eliminar es `1234`. Para cambiarla, edita `ADMIN_PASSWORD` en `app.js`.

Para abrirlo con servidor local:

```bash
node server.js
```
