import { useState } from 'react';
import { authService, salesService, invoiceService, userService } from '../services/api';

export default function ApiTest() {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});
  const [error, setError] = useState(null);

  const runTest = async (testName, testFn) => {
    setLoading(prev => ({ ...prev, [testName]: true }));
    setError(null);
    try {
      const result = await testFn();
      setResults(prev => ({ ...prev, [testName]: { success: true, data: result } }));
    } catch (err) {
      setResults(prev => ({ ...prev, [testName]: { success: false, error: err.message } }));
      setError(err.message);
    } finally {
      setLoading(prev => ({ ...prev, [testName]: false }));
    }
  };

  const tests = {
    'User Profile': () => userService.getCurrentUser(),
    'Emisor Config': () => userService.getEmisorConfig(),
    'Sales List': () => salesService.getAllSales({ limit: 5, page: 1 }),
    'Sales Stats': () => salesService.getSalesStats(),
    'Create Test Sale': () => salesService.createSale({
      folio: `TEST-${Date.now()}`,
      saleDate: new Date().toISOString(),
      customer: {
        rfc: 'XAXX010101000',
        nombre: 'PUBLICO EN GENERAL'
      },
      items: [{
        descripcion: 'Test Product',
        cantidad: 1,
        valorUnitario: 100,
        importe: 100
      }],
      formaPago: '01',
      total: 100
    }),
    'Generate Global Invoice': () => invoiceService.generateGlobal({
      notasPartidas: [{
        pu: 100,
        cantidad: 1,
        Descripcion: 'Test Service'
      }],
      FormaPago: '01',
      MetodoPago: 'PUE',
      periodicidad: '01',
      mes: '05',
      año: '2026'
    }),
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>API Connection Test</h1>

      <div style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
        <h3>API Configuration</h3>
        <p><strong>Environment:</strong> {import.meta.env.VITE_ENV}</p>
        <p><strong>API URL:</strong> {import.meta.env.VITE_API_URL}</p>
        <p><strong>Token:</strong> {authService.isAuthenticated() ? '✅ Authenticated' : '❌ Not authenticated'}</p>
      </div>

      {error && (
        <div style={{ padding: '15px', background: '#fee', border: '1px solid #fcc', borderRadius: '8px', marginBottom: '20px' }}>
          <strong>❌ Error:</strong> {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginBottom: '30px' }}>
        {Object.entries(tests).map(([name, testFn]) => (
          <button
            key={name}
            onClick={() => runTest(name, testFn)}
            disabled={loading[name]}
            style={{
              padding: '15px',
              background: results[name]?.success ? '#d4edda' : results[name]?.error ? '#f8d7da' : '#007bff',
              color: results[name] ? '#000' : '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: loading[name] ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {loading[name] ? '⏳ Testing...' : results[name]?.success ? '✅ ' + name : results[name]?.error ? '❌ ' + name : '▶️ ' + name}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px' }}>
        <button
          onClick={() => {
            Object.entries(tests).forEach(([name, testFn]) => {
              setTimeout(() => runTest(name, testFn), 0);
            });
          }}
          style={{
            padding: '15px 30px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          🚀 Run All Tests
        </button>

        <button
          onClick={() => {
            setResults({});
            setError(null);
          }}
          style={{
            padding: '15px 30px',
            background: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          Clear Results
        </button>
      </div>

      <div>
        <h2>Test Results</h2>
        {Object.entries(results).map(([name, result]) => (
          <details key={name} open style={{ marginBottom: '15px', padding: '15px', background: '#fff', border: '1px solid #ddd', borderRadius: '8px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px' }}>
              {result.success ? '✅' : '❌'} {name}
            </summary>
            <pre style={{
              background: '#f5f5f5',
              padding: '15px',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '12px',
              maxHeight: '400px'
            }}>
              {JSON.stringify(result.success ? result.data : result.error, null, 2)}
            </pre>
          </details>
        ))}
      </div>
    </div>
  );
}
