# CFDI Frontend

Frontend simple en Vite + React para el API de facturación CFDI 4.0.

## Requisitos

- Node.js 18+
- API backend ejecutándose en http://localhost:5000

## Instalación

```bash
cd frontend
npm install
```

## Desarrollo

```bash
npm run dev
```

El frontend estará disponible en http://localhost:3000 con proxy al API en puerto 5000.

## Estructura

```
src/
├── services/api.js      # Cliente axios con interceptores
├── pages/
│   ├── Login.jsx        # Login con JWT
│   ├── Dashboard.jsx    # Resumen de facturas
│   ├── GlobalInvoice.jsx # Generar factura global
│   └── InvoiceList.jsx  # Lista de facturas
├── App.jsx              # Router y navegación
└── index.css            # Estilos básicos
```

## Endpoints del API

- POST /api/auth/login - Autenticación JWT
- GET /api/invoices - Listar facturas
- POST /api/invoices/global - Generar factura global
- POST /api/invoices/client - Generar factura para cliente
- POST /api/invoices/timbraJSON - Timbrar factura
- GET /api/productos - Catálogo de productos
