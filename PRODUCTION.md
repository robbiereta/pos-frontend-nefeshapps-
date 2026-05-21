# Frontend Production Guide

## Build Status ✓

```
✓ Vite build successful
✓ 42 modules transformed
✓ Bundle optimized with terser
✓ Console logs removed in production
✓ Manual chunks configured (vendor split)
```

### Build Artifacts

- **index.html**: 0.42 KB (gzipped: 0.29 KB)
- **CSS**: 3.88 KB (gzipped: 1.28 KB)
- **JavaScript**: 241.43 KB (gzipped: 68.54 KB)
- **Total Size**: ~245 KB uncompressed (~70 KB gzipped)

## Environment Variables

### Development (.env.development)
```
VITE_API_URL=http://localhost:5002
VITE_ENV=development
```

### Production (.env.production)
```
VITE_API_URL=https://your-domain.com
VITE_ENV=production
```

## Build & Deployment

### Local Build
```bash
cd frontend
npm install
npm run build
```

Output: `frontend/dist/` directory ready for serving

### Docker Build
```bash
# Build image
docker build -t cfdi-frontend:latest .

# Run container
docker run -p 80:80 cfdi-frontend:latest
```

### Vite Configuration

The `vite.config.js` is optimized for production:

- **Terser minification** - Removes all console logs
- **Source maps disabled** - Reduces bundle size
- **Vendor splitting** - react, react-dom, react-router-dom in separate chunk
- **Chunk size warnings** - Set to 1000KB

## API Integration

Frontend uses `VITE_API_URL` environment variable for backend communication.

### How It Works

1. **Build Time**: Vite replaces `process.env.VITE_API_URL` with actual URL
2. **Runtime**: API calls use the configured URL
3. **Proxy Dev**: Development proxy routes `/api/*` to backend

### API Service (src/services/api.js)

- Handles JWT authentication
- Automatic token refresh on 401
- Error handling and user redirect on auth failure
- Base URL from `VITE_API_URL`

## Security Features

- ✓ No sensitive data in bundles
- ✓ Console logs removed in production
- ✓ Source maps disabled
- ✓ Token stored in localStorage (with auth validation)
- ✓ Automatic logout on 401
- ✓ CORS handled by nginx reverse proxy

## Performance Metrics

### Bundle Analysis

Run this to analyze bundle size:
```bash
npm run build -- --analyze
```

### Optimization Tips

1. **Code Splitting** - Already configured (vendor chunk)
2. **Image Optimization** - Use WebP format where possible
3. **Lazy Loading** - Implement route-based code splitting
4. **Caching** - Static assets cache for 1 year
5. **Compression** - nginx gzip enabled

## Development Workflow

### Start Dev Server
```bash
npm run dev
```

- Runs on http://localhost:3000
- Auto-reload on file changes
- Proxy API requests to http://localhost:5002

### Build for Production
```bash
npm run build
```

- Minifies code
- Optimizes assets
- Generates dist/ folder

### Preview Production Build
```bash
npm run preview
```

- Serves dist/ locally
- Tests production build behavior

## Nginx Configuration

Frontend is served by nginx with:

- **Static caching**: 1 year for versioned assets
- **No cache**: For index.html (always fetches latest)
- **Gzip compression**: Enabled for text/js/css
- **SPA fallback**: index.html served for all routes
- **Security headers**: X-Frame-Options, X-Content-Type-Options, etc.

See `nginx.conf` in project root for full configuration.

## Dependency Updates

### Current Dependencies

```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-router-dom": "^6.20.0",
  "@vitejs/plugin-react": "^4.2.0",
  "vite": "^5.0.0"
}
```

### Check for Updates
```bash
npm outdated
npm update
```

### Audit Security
```bash
npm audit
npm audit fix
```

Current Issues:
- 2 moderate vulnerabilities (esbuild) - from Vite dependency
- Monitor for fixes in future Vite releases

## Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### API Calls Fail in Production
- Verify `VITE_API_URL` environment variable is set
- Check browser console for CORS errors
- Verify nginx routing is correct

### Assets Not Loading
- Check nginx static file serving
- Verify dist/ folder exists with correct permissions
- Check for 404 errors in nginx logs

### High Bundle Size
```bash
# Analyze bundle
npm run build -- --analyze

# Check for large dependencies
npm ls
```

## Deployment Checklist

- [ ] All dependencies installed (`npm install`)
- [ ] Build successful (`npm run build`)
- [ ] `dist/` folder generated correctly
- [ ] `.env.production` configured with production API URL
- [ ] Nginx configuration updated with domain
- [ ] SSL certificates configured
- [ ] Static caching headers set
- [ ] CORS properly configured
- [ ] API endpoint verified working
- [ ] Frontend loads in browser
- [ ] Authentication flow tested
- [ ] Invoice generation tested

## Monitoring

### Common Issues to Monitor

1. **Build size growth** - Compare across versions
2. **Bundle chunks** - Ensure vendor split is working
3. **API errors** - Check browser console & API logs
4. **Auth issues** - Monitor 401 errors
5. **Slow loads** - Check network tab for large requests

## Resources

- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [React Router Documentation](https://reactrouter.com/)

---

**Last Updated**: 2026-05-21
**Status**: Production Ready ✓
