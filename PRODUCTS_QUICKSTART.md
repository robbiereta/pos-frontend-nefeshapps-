# Products CRUD - Quick Start Guide

## Installation & Setup

### 1. Install Dependencies (if not already done)

```bash
cd /home/robbie/Documentos/nefapi-cfdis/frontend
npm install
```

### 2. Configure Environment

Ensure `.env.development` exists with:

```bash
VITE_API_URL=http://localhost:5002
```

For production, use `.env.production`:

```bash
VITE_API_URL=https://your-production-api.com
```

### 3. Start Development Server

```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

### 4. Build for Production

```bash
npm run build
```

Built files will be in `dist/` directory.

## Quick Navigation

After logging in, click **"Productos"** in the navigation bar to access the Products CRUD page.

## Key Components

### Files Created/Modified

#### New Files
1. `/src/pages/Products.jsx` - Main products page
2. `/src/pages/Products.css` - Products page styles
3. `/src/components/ProductModal.jsx` - Create/Edit modal
4. `/src/components/QuantityModal.jsx` - Stock adjustment modal
5. `/src/components/Modal.css` - Modal styles
6. `/src/services/productService.js` - Products API client

#### Modified Files
1. `/src/App.jsx` - Added Products route and navigation link

## Common Tasks

### Create a Product

```javascript
// Manual API call example (via productService)
import { productService } from './services/productService';

const newProduct = {
  nombre: "Laptop Dell Inspiron",
  descripcion: "Laptop para oficina",
  sku: "DELL-INS-001",
  precioUnitario: 8500,
  precioVenta: 12000,
  costoPorUnidad: 8000,
  cantidad: 10,
  cantidadMinima: 2,
  categoria: "Electrónica",
  unidad: "Pieza",
  claveUnidad: "H87",
  activo: true,
  tags: ["laptop", "dell", "oficina"]
};

const response = await productService.createProduct(newProduct);
```

### Search Products

```javascript
// Search by name, SKU, or description
const results = await productService.searchProducts("laptop");
```

### Update Stock

```javascript
// Increase stock by 5
await productService.updateQuantity(productId, "increase", 5);

// Decrease stock by 3
await productService.updateQuantity(productId, "decrease", 3);

// Set exact quantity to 100
await productService.updateQuantity(productId, "set", 100);
```

### Get Inventory Stats

```javascript
const stats = await productService.getInventoryStats();
// Returns: { totalProducts, totalStock, lowStockCount, totalInventoryValue }
```

## API Endpoints Reference

### Public Endpoints (No Auth)
- `GET /api/products` - List products
- `GET /api/products/:id` - Get product details
- `GET /api/products/stats/inventory` - Inventory stats
- `GET /api/products/stock/low` - Low stock products

### Protected Endpoints (Requires JWT)
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product
- `PATCH /api/products/:id/quantity` - Update quantity
- `PATCH /api/products/bulk/update` - Bulk update

## Testing the Feature

### 1. Backend Setup
Make sure the backend is running:

```bash
cd /home/robbie/Documentos/nefapi-cfdis
npm run dev
# Backend should be on port 5002
```

### 2. Create Test User
Use the existing auth endpoint or create via API:

```bash
curl -X POST http://localhost:5002/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "nombre": "Test User"
  }'
```

### 3. Login
1. Open `http://localhost:5173/login`
2. Enter credentials
3. Navigate to Products page

### 4. Test Product Creation
1. Click "+ Nuevo Producto"
2. Fill in:
   - Name: "Test Product"
   - Unit Price: 100
   - Category: "Test"
3. Click "Crear"
4. Verify product appears in list

### 5. Test Stock Adjustment
1. Click 📦 icon on a product
2. Select "Increase"
3. Enter quantity: 10
4. Confirm the preview shows correct calculation
5. Click "Aumentar"
6. Verify stock updated in table

### 6. Test Search
1. Type product name in search box
2. Verify results filter in real-time

### 7. Test Bulk Actions
1. Select multiple products via checkboxes
2. Click "Desactivar"
3. Verify products now show "Inactivo" status

## Troubleshooting

### Issue: "CORS Error"
**Solution**: Ensure backend CORS is configured to allow frontend origin:

```javascript
// In backend app.js
const cors = require('cors');
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
```

### Issue: "401 Unauthorized"
**Solution**: 
1. Check if JWT token exists in localStorage
2. Try logging out and logging back in
3. Verify backend JWT_SECRET is configured

### Issue: "Products Not Loading"
**Solution**:
1. Check backend is running: `curl http://localhost:5002/api/products`
2. Check VITE_API_URL in .env file
3. Check browser console for errors
4. Verify MongoDB connection in backend

### Issue: "Modal Not Closing"
**Solution**:
1. Click outside modal to close
2. Click X button in top-right
3. Press ESC key (if implemented)
4. Check console for JavaScript errors

## Performance Tips

1. **Pagination**: Default 20 items per page - adjust in Products.jsx if needed
2. **Search Debouncing**: Add `useDebounce` hook for better search performance
3. **Image Loading**: Use lazy loading for product images when implemented
4. **Caching**: Consider implementing React Query for better caching

## Security Notes

1. JWT tokens stored in localStorage (consider httpOnly cookies for production)
2. All write operations require authentication
3. Input validation on both frontend and backend
4. XSS prevention via React's built-in escaping
5. CSRF protection recommended for production

## Next Steps

After the Products feature is working:

1. **Add Product Images**: Implement image upload functionality
2. **Export Data**: Add CSV export for products list
3. **Advanced Search**: Implement filters by price range, tags, etc.
4. **Product Categories**: Create separate CRUD for categories
5. **Inventory Reports**: Add analytics dashboard

## Support & Documentation

- **Full Feature Docs**: See `PRODUCTS_FEATURE.md`
- **API Docs**: Visit `http://localhost:5002/api-docs` when backend is running
- **Backend Code**: `/controllers/productController.js` and `/routes/productRoutes.js`
- **Frontend Code**: `/frontend/src/pages/Products.jsx` and related components

## Useful Commands

```bash
# Frontend
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview production build

# Backend (from project root)
npm run dev          # Development server with nodemon
npm start            # Production server
npm run docs         # Show API documentation URL

# Testing
curl http://localhost:5002/api/products  # Test products endpoint
curl http://localhost:5173               # Test frontend
```

## Quick Reference

### Product Status
- ✅ **Active** (activo: true) - Product visible and available
- ⚠️ **Inactive** (activo: false) - Product hidden, soft deleted

### Stock Status
- 🟢 **Stock OK** - Quantity above minimum threshold
- 🟡 **Low Stock** - Quantity at or below minimum threshold
- 🔴 **Out of Stock** - Quantity is 0

### Operations
- ➕ **Increase** - Add to current stock
- ➖ **Decrease** - Subtract from current stock
- 🔢 **Set** - Set exact quantity

## Contact

For questions or issues with the Products CRUD feature, consult:
1. This documentation
2. API documentation at `/api-docs`
3. CLAUDE.md files in the project
4. Backend logs for debugging
