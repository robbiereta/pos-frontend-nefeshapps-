# Products CRUD Feature - Documentation

## Overview

The Products CRUD feature provides a comprehensive interface for managing product inventory in the nefapi-cfdis system. This feature includes product creation, editing, deletion, stock management, search, filtering, and inventory analytics.

## Features Implemented

### 1. Product List View
- Paginated table displaying products (20 items per page)
- Column headers: SKU, Name, Category, Sale Price, Cost, Margin, Stock, Status, Actions
- Responsive design with horizontal scroll on mobile devices
- Real-time stock status indicators (OK, Low Stock, Out of Stock)
- Profit margin calculation and display

### 2. Search & Filtering
- **Real-time search**: Search by product name, SKU, or description
- **Category filter**: Dropdown to filter by product category
- **Status filter**: Filter active/inactive products
- All filters update the product list dynamically

### 3. Inventory Dashboard
- **Total Products**: Count of all products in the system
- **Total Stock**: Sum of all product quantities
- **Low Stock Count**: Number of products below minimum threshold
- **Inventory Value**: Total value of inventory (cost × quantity)

### 4. Low Stock Alerts
- Visual alert card showing products with stock below minimum threshold
- Displays up to 5 low-stock products with current and minimum quantities
- Persistent warning until stock is replenished

### 5. Create Product
- Modal form with comprehensive product fields
- **Required fields**: Name, Unit Price
- **Optional fields**: SKU, Description, Category, Subcategory, Sale Price, Cost, Initial Quantity, Min/Max Quantity, Unit, SAT Unit Code, Tags
- **Validation**: Client-side validation for required fields
- **Auto-calculate**: Profit margin calculated on save

### 6. Edit Product
- Pre-filled modal form with existing product data
- All fields editable except system-generated fields
- Same validation as create form
- Updates reflected immediately in the product list

### 7. Delete Product (Soft Delete)
- Confirmation dialog before deletion
- Soft delete (sets `activo: false` instead of removing from database)
- Deleted products can be recovered by updating status

### 8. Stock Management
- **Quantity Adjustment Modal** with three operations:
  - **Increase**: Add to current stock
  - **Decrease**: Subtract from current stock (minimum 0)
  - **Set**: Set exact quantity
- Real-time preview of resulting quantity
- Visual operation buttons for intuitive interaction

### 9. Bulk Actions
- Select multiple products via checkboxes
- Bulk operations:
  - Activate products
  - Deactivate products
- Selection counter showing number of selected products
- "Select All" checkbox in table header

### 10. Pagination
- Previous/Next navigation buttons
- Page indicator (Page X of Y)
- Item count display (Showing X-Y of Z products)
- Maintains filters and search when changing pages

## File Structure

```
frontend/src/
├── pages/
│   ├── Products.jsx           # Main products page component
│   └── Products.css           # Products page styles
├── components/
│   ├── ProductModal.jsx       # Create/Edit product modal
│   ├── QuantityModal.jsx      # Stock adjustment modal
│   └── Modal.css              # Shared modal styles
├── services/
│   └── productService.js      # API client for products
└── App.jsx                    # Updated with Products route
```

## API Integration

The frontend integrates with the following backend endpoints:

### Read Operations (No Auth Required)
- `GET /api/products` - List products with pagination, filters, search
- `GET /api/products/:id` - Get single product by ID
- `GET /api/products/sku/:sku` - Get product by SKU
- `GET /api/products/stats/inventory` - Get inventory statistics
- `GET /api/products/stock/low` - Get low stock products
- `GET /api/products/search` - Search products
- `GET /api/products/categoria/:categoria` - Get products by category

### Write Operations (Require JWT Auth)
- `POST /api/products` - Create new product
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Soft delete product
- `PATCH /api/products/:id/quantity` - Update product quantity
- `PATCH /api/products/bulk/update` - Bulk update products

## Authentication

All write operations (Create, Update, Delete, Quantity Update, Bulk Update) require JWT authentication. The token is automatically included in requests via the `productService` which uses the stored token from `localStorage`.

## Data Model

### Product Schema
```javascript
{
  nombre: String,               // Product name (required)
  descripcion: String,          // Description
  sku: String,                  // Stock Keeping Unit (unique)
  precioUnitario: Number,       // Unit price/cost (required)
  precioVenta: Number,          // Sale price
  costoPorUnidad: Number,       // Cost per unit
  cantidad: Number,             // Current quantity (default: 0)
  cantidadMinima: Number,       // Minimum quantity threshold
  cantidadMaxima: Number,       // Maximum quantity limit
  categoria: String,            // Category
  subcategoria: String,         // Subcategory
  unidad: String,               // Unit (e.g., Pieza, Kilogramo)
  claveUnidad: String,          // SAT unit code (e.g., H87)
  activo: Boolean,              // Active status (default: true)
  tags: [String],               // Tags array
  margenGanancia: Number,       // Profit margin % (virtual field)
  imagenes: [{                  // Product images
    url: String,
    descripcion: String,
    principal: Boolean
  }]
}
```

## Usage Examples

### Access the Products Page
1. Log in to the application
2. Click "Productos" in the navigation bar
3. The products page will load with inventory dashboard

### Create a Product
1. Click "+ Nuevo Producto" button
2. Fill in required fields (Name, Unit Price)
3. Optionally fill in other fields
4. Click "Crear" to save

### Search Products
1. Type in the search box (searches name, SKU, description)
2. Results update in real-time as you type
3. Combine with category/status filters for refined search

### Adjust Stock
1. Click the 📦 icon in the Actions column
2. Select operation (Increase/Decrease/Set)
3. Enter quantity value
4. Preview shows resulting quantity
5. Click operation button to confirm

### Bulk Update
1. Check boxes next to products to select
2. Or use "Select All" checkbox in header
3. Choose bulk action (Activate/Deactivate)
4. Changes apply to all selected products

### Filter by Category
1. Use the category dropdown filter
2. Only products in selected category will display
3. Clear filter by selecting "Todas las categorías"

## Styling & Design

The Products feature follows the existing design system:

### Colors (CSS Variables)
- `--primary`: Primary blue (#1e40af)
- `--success`: Green for positive states (#059669)
- `--warning`: Orange for alerts (#d97706)
- `--danger`: Red for errors/danger (#dc2626)
- `--gray-*`: Grayscale palette for UI elements

### Components
- Cards with subtle shadows
- Rounded corners (4px, 8px)
- Hover effects on interactive elements
- Modal overlays with backdrop blur
- Responsive tables with overflow scroll
- Button styles matching existing UI

### Responsive Breakpoints
- Desktop: > 1024px (full layout)
- Tablet: 768px - 1024px (adapted grid)
- Mobile: < 768px (stacked layout, horizontal scroll tables)

## Error Handling

The application provides user-friendly error messages for:
- Network failures
- Authentication errors (redirects to login)
- Validation errors (inline field errors)
- API errors (displayed in error banner)
- Empty states (friendly messages)

Success messages auto-dismiss after 3 seconds. Error messages persist until dismissed or auto-clear after 3 seconds.

## Performance Considerations

- **Pagination**: Only loads 20 products at a time
- **Lazy loading**: Stats and low-stock data loaded separately
- **Debouncing**: Search has built-in React state batching
- **Caching**: Uses browser localStorage for auth tokens
- **Optimistic UI**: Forms submit immediately, errors handled gracefully

## Future Enhancements

Potential improvements for future versions:

1. **Image Upload**: Add product images with drag-drop upload
2. **Export**: Export product list to CSV/Excel
3. **Import**: Bulk import products from CSV
4. **Categories Management**: CRUD for categories/subcategories
5. **Advanced Filters**: Filter by price range, stock level, tags
6. **Sorting**: Sort table columns (name, price, stock, etc.)
7. **Product History**: Track quantity changes over time
8. **Barcode Scanner**: Scan SKU barcodes for quick lookup
9. **Print Labels**: Generate printable product labels
10. **Inventory Reports**: Detailed analytics and reports

## Troubleshooting

### Products Not Loading
- Check browser console for errors
- Verify JWT token is valid (not expired)
- Ensure backend API is running on correct port
- Check VITE_API_URL environment variable

### Search Not Working
- Clear browser cache and reload
- Check network tab for API requests
- Verify searchQuery parameter is sent to backend

### Modal Not Opening
- Check browser console for React errors
- Ensure components are properly imported
- Verify modal CSS is loaded

### Authentication Errors
- Log out and log back in to refresh token
- Check token expiration in localStorage
- Verify JWT_SECRET matches between frontend/backend

## Testing Checklist

- [ ] Products list loads with data
- [ ] Pagination works (next/previous)
- [ ] Search filters products correctly
- [ ] Category filter works
- [ ] Status filter (active/inactive) works
- [ ] Create product form validates required fields
- [ ] Create product saves successfully
- [ ] Edit product pre-fills form correctly
- [ ] Edit product updates successfully
- [ ] Delete product shows confirmation
- [ ] Delete product soft-deletes (sets activo: false)
- [ ] Quantity adjustment modal opens
- [ ] Increase operation works correctly
- [ ] Decrease operation prevents negative values
- [ ] Set operation sets exact quantity
- [ ] Bulk selection checkbox works
- [ ] Bulk activate/deactivate works
- [ ] Low stock alert displays correctly
- [ ] Inventory stats calculate correctly
- [ ] Profit margin displays accurately
- [ ] Stock badges show correct status
- [ ] Error messages display and auto-clear
- [ ] Success messages display and auto-clear
- [ ] Responsive design works on mobile
- [ ] Authentication redirects work

## API Environment Variables

Ensure `.env` file in frontend directory contains:

```bash
VITE_API_URL=http://localhost:5002
```

For production, update to your production API URL.

## Support

For issues or questions about the Products CRUD feature, check:
1. Browser console for JavaScript errors
2. Network tab for failed API requests
3. Backend logs for server errors
4. This documentation for usage guidance
