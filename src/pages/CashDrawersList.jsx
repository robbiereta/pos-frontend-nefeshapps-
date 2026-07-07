import { useState, useEffect } from 'react';
import { cashDrawerService } from '../services/api';
import './CashDrawersList.css';

export default function CashDrawersList() {
  const [cutoffs, setCutoffs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCutoff, setSelectedCutoff] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    loadCutoffs();
  }, []);

  const loadCutoffs = async () => {
    try {
      setLoading(true);
      const response = await cashDrawerService.getCutoffs({ limit: 100 });
      setCutoffs(response.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredCutoffs = statusFilter === 'all'
    ? cutoffs
    : cutoffs.filter(c => c.status === statusFilter);

  const handleViewDetails = async (id) => {
    try {
      const response = await cashDrawerService.getCutoffById(id);
      setSelectedCutoff(response.data);
      setShowDetails(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      setUpdating(id);
      await cashDrawerService.saveCutoff({
        id,
        status: newStatus,
      });
      await loadCutoffs();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('¿Eliminar este corte de caja? Esta acción no se puede deshacer.')) {
      try {
        setUpdating(id);
        await cashDrawerService.deleteCutoff(id);
        await loadCutoffs();
      } catch (err) {
        setError(err.message);
      } finally {
        setUpdating(null);
      }
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(value || 0);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      open: { label: 'Abierto', class: 'status-open' },
      closed: { label: 'Cerrado', class: 'status-closed' },
      reviewed: { label: 'Revisado', class: 'status-reviewed' }
    };
    const config = statusMap[status] || { label: status, class: 'status-default' };
    return <span className={`status-badge ${config.class}`}>{config.label}</span>;
  };

  return (
    <div className="cash-drawers-list">
      <div className="list-header">
        <h1>Cortes de Caja</h1>
        <a href="/cash-drawer" className="btn btn-primary">
          + Nuevo Corte
        </a>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="filters">
        <div className="filter-group">
          <label>Filtrar por estado:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">Todos</option>
            <option value="open">Abiertos</option>
            <option value="closed">Cerrados</option>
            <option value="reviewed">Revisados</option>
          </select>
        </div>
      </div>

      <div className="cutoffs-table-container">
        {loading ? (
          <p>Cargando cortes...</p>
        ) : filteredCutoffs.length === 0 ? (
          <p>No hay cortes de caja registrados</p>
        ) : (
          <table className="cutoffs-table">
            <thead>
              <tr>
                <th>Período</th>
                <th>Ventas</th>
                <th>Total</th>
                <th>Desglose</th>
                <th>Estado</th>
                <th>Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredCutoffs.map(cutoff => (
                <tr key={cutoff._id}>
                  <td className="period">
                    <div>{new Date(cutoff.startDate).toLocaleDateString('es-MX')}</div>
                    <div className="separator">→</div>
                    <div>{new Date(cutoff.endDate).toLocaleDateString('es-MX')}</div>
                  </td>
                  <td className="sales-count">{cutoff.totalSales}</td>
                  <td className="total-amount">{formatCurrency(cutoff.totalAmount)}</td>
                  <td className="breakdown">
                    <button
                      className="btn btn-sm btn-info"
                      onClick={() => handleViewDetails(cutoff._id)}
                    >
                      Ver Detalles
                    </button>
                  </td>
                  <td className="status">
                    {getStatusBadge(cutoff.status)}
                  </td>
                  <td className="created-at">
                    {formatDate(cutoff.createdAt)}
                  </td>
                  <td className="actions">
                    {cutoff.status === 'open' && (
                      <>
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleUpdateStatus(cutoff._id, 'closed')}
                          disabled={updating === cutoff._id}
                        >
                          Cerrar
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDelete(cutoff._id)}
                          disabled={updating === cutoff._id}
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                    {cutoff.status === 'closed' && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => handleUpdateStatus(cutoff._id, 'reviewed')}
                        disabled={updating === cutoff._id}
                      >
                        Revisar
                      </button>
                    )}
                    {cutoff.status === 'reviewed' && (
                      <span className="text-muted">Finalizado</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showDetails && selectedCutoff && (
        <div className="modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalles del Corte</h2>
              <button className="btn-close" onClick={() => setShowDetails(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h3>Información General</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Período:</label>
                    <span>
                      {new Date(selectedCutoff.startDate).toLocaleDateString('es-MX')} - {new Date(selectedCutoff.endDate).toLocaleDateString('es-MX')}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Total de Ventas:</label>
                    <span className="font-bold">{selectedCutoff.totalSales}</span>
                  </div>
                  <div className="detail-item">
                    <label>Total Monto:</label>
                    <span className="font-bold">{formatCurrency(selectedCutoff.totalAmount)}</span>
                  </div>
                  <div className="detail-item">
                    <label>Estado:</label>
                    <span>{getStatusBadge(selectedCutoff.status)}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Resumen Fiscal</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Subtotal:</label>
                    <span>{formatCurrency(selectedCutoff.subtotal)}</span>
                  </div>
                  <div className="detail-item">
                    <label>IVA (16%):</label>
                    <span>{formatCurrency(selectedCutoff.iva)}</span>
                  </div>
                  <div className="detail-item">
                    <label>Total:</label>
                    <span className="font-bold">{formatCurrency(selectedCutoff.totalAmount)}</span>
                  </div>
                </div>
              </div>

              {selectedCutoff.byPaymentMethod && Object.keys(selectedCutoff.byPaymentMethod).length > 0 && (
                <div className="detail-section">
                  <h3>Por Método de Pago</h3>
                  <table className="detail-table">
                    <thead>
                      <tr>
                        <th>Método</th>
                        <th>Cantidad</th>
                        <th>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(selectedCutoff.byPaymentMethod).map(([method, data]) => (
                        <tr key={method}>
                          <td>{method}</td>
                          <td>{data.count}</td>
                          <td>{formatCurrency(data.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedCutoff.byStatus && Object.keys(selectedCutoff.byStatus).length > 0 && (
                <div className="detail-section">
                  <h3>Por Estado de Facturación</h3>
                  <table className="detail-table">
                    <thead>
                      <tr>
                        <th>Estado</th>
                        <th>Cantidad</th>
                        <th>Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(selectedCutoff.byStatus).map(([status, data]) => (
                        <tr key={status}>
                          <td className="status-label">{getStatusBadge(status)}</td>
                          <td>{data.count}</td>
                          <td>{formatCurrency(data.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedCutoff.notes && (
                <div className="detail-section">
                  <h3>Notas</h3>
                  <p className="notes-text">{selectedCutoff.notes}</p>
                </div>
              )}

              <div className="detail-section text-muted">
                <p>Creado: {formatDate(selectedCutoff.createdAt)}</p>
                {selectedCutoff.closedAt && <p>Cerrado: {formatDate(selectedCutoff.closedAt)}</p>}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetails(false)}>
                Cerrar
              </button>
              <button className="btn btn-primary" onClick={() => window.print()}>
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
