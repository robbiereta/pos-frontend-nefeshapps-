# Frontend Quick Start Guide

## 🚀 Get Started in 3 Steps

### 1️⃣ Install
```bash
cd frontend
npm install
```

### 2️⃣ Configure
```bash
# Development uses http://localhost:5002
# No changes needed if API running locally

# For production, edit .env.production:
VITE_API_URL=https://cfdis.nefeshapps.site
```

### 3️⃣ Run
```bash
npm run dev
```

**Frontend**: http://localhost:5173  
**API Test Page**: http://localhost:5173/api-test

---

## 📋 What's Connected

✅ **Authentication** - Login/logout with JWT tokens  
✅ **User Management** - Profile and emisor config  
✅ **Sales** - Create, list, search, stats  
✅ **Invoices** - Global, client, ISR retention  
✅ **Auto Token Management** - Automatic 401 handling

---

## 🧪 Test the Connection

1. Start the backend API:
   ```bash
   cd /home/robbie/Documentos/nefapi-cfdis
   npm run dev
   ```

2. Start the frontend:
   ```bash
   cd /home/robbie/Documentos/nefapi-cfdis/frontend
   npm run dev
   ```

3. Navigate to: http://localhost:5173/api-test

4. Click **"Run All Tests"** to verify all endpoints

---

## 📁 Key Files

```
frontend/
├── src/
│   ├── services/
│   │   └── api.js          # 🔑 All API services
│   ├── pages/
│   │   ├── ApiTest.jsx     # 🧪 API testing dashboard
│   │   ├── Login.jsx       # 🔐 Authentication
│   │   ├── Dashboard.jsx   # 📊 Main dashboard
│   │   ├── Pos.jsx         # 🛒 Point of sale
│   │   ├── GlobalInvoice.jsx # 📄 Global invoices
│   │   ├── ClientInvoice.jsx # 📄 Client invoices
│   │   └── listSales.jsx   # 📋 Sales list
│   └── App.jsx             # 🗺️ Routes
├── .env.development        # 🔧 Dev config
├── .env.production         # 🚀 Prod config
└── API_CONNECTION_GUIDE.md # 📖 Full documentation
```

---

## 🎯 Available Pages

| Route | Description |
|-------|-------------|
| `/login` | User authentication |
| `/dashboard` | Main dashboard |
| `/pos` | Point of sale |
| `/global-invoice` | Generate global invoices |
| `/client-invoice` | Generate client invoices |
| `/list-sales` | View all sales |
| `/api-test` | 🧪 **Test API connection** |

---

## 🔧 Environment Variables

### Development (.env.development)
```bash
VITE_API_URL=http://localhost:5002
VITE_ENV=development
```

### Production (.env.production)
```bash
VITE_API_URL=https://cfdis.nefeshapps.site
VITE_ENV=production
```

---

## 📦 API Services Overview

### authService
```javascript
authService.login(email, password)
authService.logout()
authService.isAuthenticated()
authService.getCurrentUser()
```

### userService
```javascript
userService.getCurrentUser()
userService.getEmisorConfig()
userService.updateEmisorConfig(config)
```

### salesService
```javascript
salesService.createSale(data)
salesService.getAllSales({ limit, page })
salesService.getSaleById(id)
salesService.updateSaleStatus(id, status)
salesService.getSalesStats(params)
salesService.searchSales(query, field)
```

### invoiceService
```javascript
invoiceService.generateGlobal(data)
invoiceService.generateClient(data)
invoiceService.generateIsrRetention(data)
invoiceService.stampInvoice(data)
```

---

## 🛠️ Build for Production

```bash
npm run build
# Output: dist/

npm run preview
# Preview production build locally
```

---

## ⚡ Quick Tips

1. **Login First**: Most features require authentication
2. **Use API Test Page**: Test connection before debugging
3. **Check Console**: Errors logged to browser console
4. **Token Storage**: JWT stored in localStorage
5. **Auto Logout**: 401 errors trigger automatic logout

---

## 🆘 Troubleshooting

### Can't connect to API?
```bash
# Check API is running:
curl http://localhost:5002/api/health

# Or production:
curl https://cfdis.nefeshapps.site/api/health
```

### Login not working?
1. Check `.env.development` has correct API_URL
2. Verify backend is running
3. Check browser console for errors
4. Try clearing localStorage: `localStorage.clear()`

### CORS errors?
Backend must allow frontend origin in CORS config.

---

## 📚 Full Documentation

For complete API documentation, see:
- **[API_CONNECTION_GUIDE.md](./API_CONNECTION_GUIDE.md)** - Complete API reference
- **[API_TEST_GUIDE.md](../API_TEST_GUIDE.md)** - Backend API testing
- **[TEST_QUICK_REFERENCE.md](../TEST_QUICK_REFERENCE.md)** - Quick API reference

---

**Ready to develop!** 🎉
