import { salesService } from '../services/api';
import { useState, useEffect } from 'react';

const ListSales = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getSales = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await salesService.getAllSales();
      console.log(response);
      setSales(response.sales);
    } catch (error) {
      console.error('Error fetching sales:', error);
      setError(error.message || 'Error loading sales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getSales();
  }, []);

  if (loading) {
    return (
      <div>
        <h1>List Sales</h1>
        <p>Loading sales...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1>List Sales</h1>
        <p style={{ color: 'red' }}>Error: {error}</p>
        <button onClick={getSales}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <h1>List Sales</h1>
      {sales.length === 0 ? (
        <p>No sales found</p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {sales.map(sale => (
            <div key={sale._id || sale.id} style={{ 
              border: '1px solid #ddd', 
              padding: '1rem', 
              borderRadius: '4px',
              backgroundColor: '#f9f9f9'
            }}>
              <h3>Folio: {sale.folio}</h3>
              <p><strong>Total:</strong> ${sale.total ? sale.total.toFixed(2) : 'N/A'}</p>
              <p><strong>Status:</strong> {sale.status || 'N/A'}</p>
              <p><strong>Date:</strong> {sale.saleDate ? new Date(sale.saleDate).toLocaleDateString() : 'N/A'}</p>
              <p><strong>Customer:</strong> {sale.customer?.nombre || 'N/A'}</p>
              {sale.customer?.rfc && <p><strong>RFC:</strong> {sale.customer.rfc}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ListSales;
