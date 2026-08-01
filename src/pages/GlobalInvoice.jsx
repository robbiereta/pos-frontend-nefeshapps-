import { useState } from 'react';
import { invoiceService } from '../services/api';
import { useToast } from '../components/ui/Toast.jsx';

export default function GlobalInvoice() {
  const [formData, setFormData] = useState({
    fechaInicio: '',
    fechaFin: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const toast = useToast();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    setResult(null);

    try {
      const response = await invoiceService.generateGlobal({
        fechaInicio: formData.fechaInicio,
        fechaFin: formData.fechaFin,
      });
      
      setMessage('Factura generada correctamente');
      setResult(response);
      toast.success('Factura generada correctamente');
    } catch (err) {
      setError(err.response?.data?.message || 'Error al generar la factura');
      toast.error(err.response?.data?.message || 'Error al generar la factura');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <h2 style={{ marginBottom: '1.5rem' }}>Generar Factura Global</h2>
      
      <div className="card">
        <h2>Factura para PUBLICO EN GENERAL</h2>
        <p style={{ color: 'var(--gray-500)', marginBottom: '1.5rem' }}>
          Genera una factura global con todas las ventas del período seleccionado.
        </p>

        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="fechaInicio">Fecha Inicio</label>
              <input
                type="date"
                id="fechaInicio"
                name="fechaInicio"
                value={formData.fechaInicio}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="fechaFin">Fecha Fin</label>
              <input
                type="date"
                id="fechaFin"
                name="fechaFin"
                value={formData.fechaFin}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Generando...' : 'Generar Factura Global'}
          </button>
        </form>

        {result && result.data && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--gray-50)', borderRadius: '4px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Resultado</h3>
            <p><strong>UUID:</strong> {result.data.uuid || 'N/A'}</p>
            <p><strong>Estado:</strong> {result.data.status || 'Completado'}</p>
          </div>
        )}
      </div>
    </>
  );
}
