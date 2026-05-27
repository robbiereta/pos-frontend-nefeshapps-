# Frontend API Connection Guide

**Frontend**: React + Vite  
**API**: nefapi-cfdis REST API  
**Status**: ✅ **Fully Connected**

---

## Quick Start

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Configure Environment

**Development** (`.env.development`):
```bash
VITE_API_URL=http://localhost:5002
VITE_ENV=development
```

**Production** (`.env.production`):
```bash
VITE_API_URL=https://cfdis.nefeshapps.site
VITE_ENV=production
```

### 3. Run Frontend

**Development Mode**:
```bash
npm run dev
# Opens at http://localhost:5173
```

**Production Build**:
```bash
npm run build
npm run preview
```

---

## API Service Architecture

### Core Service (`src/services/api.js`)

The API service provides a unified interface for all backend communication with:
- **Automatic JWT token management**
- **Error handling with 401 redirects**
- **Consistent request/response formatting**

```javascript
// Base request function
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Auto-logout on unauthorized
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  return await response.json();
}
```

---

## Available Services

### 🔐 Authentication Service

```javascript
import { authService } from './services/api';

// Login
await authService.login(email, password);
// Stores: token, refreshToken, user in localStorage

// Logout
authService.logout();
// Clears all auth data

// Check authentication
authService.isAuthenticated(); // Returns boolean

// Get current user
const user = authService.getCurrentUser(); // Returns user object or null
```

**API Endpoints Used**:
- `POST /api/auth/login`

---

### 👤 User Service

```javascript
import { userService } from './services/api';

// Get current user profile
const profile = await userService.getCurrentUser();

// Get emisor (issuer) configuration
const config = await userService.getEmisorConfig();

// Update emisor configuration
await userService.updateEmisorConfig({
  rfc: 'ABC123456XYZ',
  nombre: 'MI EMPRESA SA',
  regimenFiscal: '601',
  codigoPostal: '87000',
  tokenProd: 'sw_token',
  emailFacturacion: 'email@example.com'
});
```

**API Endpoints Used**:
- `GET /api/users/me`
- `GET /api/users/me/emisor-config`
- `PUT /api/users/me/emisor-config`

---

### 💰 Sales Service

```javascript
import { salesService } from './services/api';

// Create a new sale
await salesService.createSale({
  folio: 'TICKET-001',
  saleDate: new Date().toISOString(),
  customer: {
    rfc: 'XAXX010101000',
    nombre: 'PUBLICO EN GENERAL'
  },
  items: [
    {
      descripcion: 'Product Name',
      cantidad: 1,
      valorUnitario: 100,
      importe: 100
    }
  ],
  formaPago: '01', // Cash
  total: 100
});

// Get all sales (with pagination)
const sales = await salesService.getAllSales({
  limit: 50,
  page: 1
});

// Get specific sale
const sale = await salesService.getSaleById(saleId);

// Update sale status
await salesService.updateSaleStatus(saleId, 'invoiced', 'Optional notes');

// Get sales statistics
const stats = await salesService.getSalesStats({
  dateFrom: '2026-05-01',
  dateTo: '2026-05-31'
});

// Search sales
const results = await salesService.searchSales('TEST', 'folio');
```

**API Endpoints Used**:
- `POST /api/sales`
- `GET /api/sales?limit=50&page=1`
- `GET /api/sales/:id`
- `PUT /api/sales/:id/status`
- `GET /api/sales/stats`
- `GET /api/sales/search?q=TERM&field=folio`

---

### 📄 Invoice Service

```javascript
import { invoiceService } from './services/api';

// Generate global invoice (PUBLICO EN GENERAL)
const globalInvoice = await invoiceService.generateGlobal({
  notasPartidas: [
    {
      pu: 1000,              // Unit price
      cantidad: 1,           // Quantity
      Descripcion: 'Service' // Description
    }
  ],
  FormaPago: '01',          // Payment method (01=Cash)
  MetodoPago: 'PUE',        // Payment type (PUE=Single payment)
  periodicidad: '04',       // Periodicity (04=Monthly)
  mes: '05',                // Month
  año: '2026'               // Year
});

// Generate client-specific invoice
const clientInvoice = await invoiceService.generateClient({
  notasPartidas: [
    {
      pu: 5000,
      cantidad: 1,
      Descripcion: 'Consulting Service',
      CodigoSat: '86101500',
      ClaveUnidad: 'E48',
      Unidad: 'Servicio'
    }
  ],
  receptorRfc: 'XEXX010101000',
  receptorNombre: 'CLIENTE SA',
  receptorRegimen: '616',
  DomicilioFiscalReceptor: '87000',
  UsoCFDI: 'G01',
  FormaPago: '02',
  MetodoPago: 'PUE'
});

// Generate ISR retention invoice
const retentionInvoice = await invoiceService.generateIsrRetention({
  notasPartidas: [
    {
      pu: 10000,
      cantidad: 1,
      Descripcion: 'Professional Services'
    }
  ],
  receptorRfc: 'XEXX010101000',
  receptorNombre: 'PROFESSIONAL',
  receptorRegimen: '616',
  DomicilioFiscalReceptor: '87000',
  UsoCFDI: 'P01'
});

// Stamp invoice via SW.com.mx
const stamped = await invoiceService.stampInvoice({
  jsonFactura: { /* CFDI structure */ },
  tokenProd_sw: 'your_sw_token',
  email: 'your_email@example.com'
});
```

**API Endpoints Used**:
- `POST /api/invoices/global`
- `POST /api/invoices/client`
- `POST /api/invoices/retencion-isr`
- `POST /api/invoices/timbra`

---

### 📦 Product Service

```javascript
import { productService } from './services/api';

// Get all products
const products = await productService.getProducts();
```

**API Endpoints Used**:
- `GET /api/productos`

---

## Testing the Connection

### Built-in API Test Page

Navigate to `/api-test` in the frontend to access the interactive API testing dashboard:

**Features**:
- ✅ Visual connection status
- ✅ One-click endpoint testing
- ✅ Detailed response inspection
- ✅ Run all tests at once
- ✅ Error handling demonstration

**Access**:
```
http://localhost:5173/api-test
```

**Tests Available**:
1. User Profile - `GET /api/users/me`
2. Emisor Config - `GET /api/users/me/emisor-config`
3. Sales List - `GET /api/sales`
4. Sales Stats - `GET /api/sales/stats`
5. Create Test Sale - `POST /api/sales`
6. Generate Global Invoice - `POST /api/invoices/global`

---

## Error Handling

### Automatic Token Refresh

```javascript
// 401 responses automatically:
// 1. Clear localStorage (token, refreshToken, user)
// 2. Redirect to /login
```

### Manual Error Handling

```javascript
try {
  const data = await salesService.createSale(saleData);
  console.log('Success:', data);
} catch (error) {
  console.error('Error:', error.message);
  // Display user-friendly error message
}
```

---

## CFDI Reference Codes

### Payment Methods (FormaPago)
```javascript
'01' = Efectivo (Cash)
'02' = Cheque (Check)
'03' = Transferencia (Wire Transfer)
'04' = Tarjeta de crédito (Credit Card)
```

### Payment Type (MetodoPago)
```javascript
'PUE' = Pago en una sola exhibición (Single payment)
'PPD' = Pago en parcialidades (Installments)
```

### Tax Regime (RegimenFiscal)
```javascript
'601' = General de Ley Personas Morales
'605' = Pequeños Contribuyentes
'616' = Régimen Simplificado de Confianza
'620' = Cauponistas
```

### CFDI Usage (UsoCFDI)
```javascript
'G01' = Adquisición de mercancías
'G02' = Devoluciones/descuentos
'G03' = Gastos en general
'P01' = Por definir
'S01' = Sin efecto fiscal
```

---

## Component Examples

### Using Sales Service in a Component

```jsx
import { useState, useEffect } from 'react';
import { salesService } from '../services/api';

function SalesList() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    try {
      const data = await salesService.getAllSales({ limit: 10, page: 1 });
      setSales(data.sales);
    } catch (error) {
      console.error('Error loading sales:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {sales.map(sale => (
        <div key={sale.id}>
          <p>Folio: {sale.folio}</p>
          <p>Total: ${sale.total}</p>
          <p>Status: {sale.status}</p>
        </div>
      ))}
    </div>
  );
}
```

### Creating an Invoice

```jsx
import { useState } from 'react';
import { invoiceService } from '../services/api';

function GlobalInvoiceForm() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const invoice = await invoiceService.generateGlobal({
        notasPartidas: [
          {
            pu: 1000,
            cantidad: 1,
            Descripcion: 'Service'
          }
        ],
        FormaPago: '01',
        MetodoPago: 'PUE',
        periodicidad: '04',
        mes: '05',
        año: '2026'
      });

      alert('Invoice generated! Folio: ' + invoice.data.Folio);
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <button type="submit" disabled={loading}>
        {loading ? 'Generating...' : 'Generate Invoice'}
      </button>
    </form>
  );
}
```

---

## Deployment

### Build for Production

```bash
npm run build
# Creates optimized build in /dist
```

### Environment Variables

Production builds automatically use `.env.production`:
- `VITE_API_URL=https://cfdis.nefeshapps.site`

---

## Troubleshooting

### Issue: CORS Errors

**Solution**: Ensure backend has CORS configured for frontend domain:
```javascript
// Backend: app.js
app.use(cors({
  origin: ['http://localhost:5173', 'https://your-frontend-domain.com']
}));
```

### Issue: 401 Unauthorized

**Cause**: Token expired or invalid

**Solution**:
1. Check if login is successful
2. Verify token is stored: `localStorage.getItem('token')`
3. Re-login to get fresh token

### Issue: Network Error

**Cause**: API not running or wrong URL

**Solution**:
1. Verify API is running: `curl https://cfdis.nefeshapps.site/api/health`
2. Check `.env` file has correct `VITE_API_URL`
3. Restart frontend: `npm run dev`

### Issue: Empty Response

**Cause**: Missing authentication or data

**Solution**:
1. Login first at `/login`
2. Check user has necessary permissions
3. Verify emisor config is set up

---

## API Response Format

All endpoints return standardized responses:

**Success**:
```json
{
  "success": true,
  "data": { /* actual data */ },
  "message": "Operation successful"
}
```

**Error**:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error"
}
```

---

## Next Steps

1. **Customize UI** - Modify pages in `/src/pages/`
2. **Add Features** - Extend services in `/src/services/api.js`
3. **Styling** - Update styles for branding
4. **Testing** - Use `/api-test` page for validation
5. **Deploy** - Build and deploy to hosting platform

---

## Resources

- **API Documentation**: `/API_TEST_GUIDE.md`
- **Backend API**: `https://cfdis.nefeshapps.site`
- **Swagger Docs**: `https://cfdis.nefeshapps.site/api-docs`

---

**Last Updated**: 2026-05-26  
**Frontend**: React 18 + Vite 5  
**Status**: ✅ Production Ready
