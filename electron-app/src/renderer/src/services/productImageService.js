/**
 * Servicio para gestionar imágenes de productos.
 * Construye sobre el helper interno de productService para heredar
 * Authorization, retries y manejo de 401.
 */
import { productService } from './productService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5002';

// URL absoluta para previsualizar la imagen servida por el backend
export function getProductImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_URL}${url}`;
}

// Subir 1..N imágenes a un producto. Campo multipart "imagenes".
// options.principal = true => marca la primera como principal
export async function uploadProductImages(productId, files, options = {}) {
  const fd = new FormData();
  for (const file of files) fd.append('imagenes', file);
  if (options.principal) fd.append('principal', 'true');

  // request() pone Content-Type JSON por defecto, aquí necesitamos multipart
  // => fetch directo preservando el patrón de auth del service.
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/api/products/${productId}/images`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Upload failed: ${res.status}`);
  return data;
}

// Eliminar una imagen
export async function deleteProductImage(productId, imageId) {
  return productService.request(`/api/products/${productId}/images/${imageId}`, {
    method: 'DELETE',
  });
}

// Marcar como principal
export async function setPrincipalImage(productId, imageId) {
  return productService.request(
    `/api/products/${productId}/images/${imageId}/principal`,
    { method: 'PUT' }
  );
}
