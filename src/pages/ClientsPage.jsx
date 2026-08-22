import { useState, useEffect } from 'react';
import { clientService } from '../services/api';
import { useToast } from '../components/ui/Toast.jsx';
import './ClientsPage.css';

export default function ClientsPage() {
  const toast = useToast();
  const [clients, setClients] = useState([]);
  const [displayedClients, setDisplayedClients] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [formData, setFormData] = useState({
    rfc: '',
    nombre: '',
    email: '',
    telefono: '',
    regimenFiscal: '616',
    calle: '',
    ciudad: '',
    estado: '',
    codigoPostal: '',
    usoCFDI: 'G01',
    notas: '',
  });

  useEffect(() => {
    loadClients();
  }, []);

  useEffect(() => {
    const filtered = clients.filter(client =>
      client.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.rfc.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.email || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setDisplayedClients(filtered.slice(startIndex, endIndex));
  }, [searchQuery, currentPage, clients]);

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await clientService.getAllClients();
      setClients(response.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (editingId) {
        await clientService.updateClient(editingId, formData);
        toast.success('Cliente actualizado');
      } else {
        await clientService.createClient(formData);
        toast.success('Cliente creado');
      }
      await loadClients();
      resetForm();
      setShowForm(false);
    } catch (err) {
      setError(err.message);
      toast.error(err.message || 'Error al guardar cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (client) => {
    setFormData({
      rfc: client.rfc,
      nombre: client.nombre,
      email: client.email || '',
      telefono: client.telefono || '',
      regimenFiscal: client.regimenFiscal || '616',
      calle: client.calle || '',
      ciudad: client.ciudad || '',
      estado: client.estado || '',
      codigoPostal: client.codigoPostal,
      usoCFDI: client.usoCFDI || 'G01',
      notas: client.notas || '',
    });
    setEditingId(client._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm('¿Eliminar este cliente?')) {
      try {
        setLoading(true);
        await clientService.deleteClient(id);
        toast.success('Cliente eliminado');
        await loadClients();
      } catch (err) {
        setError(err.message);
        toast.error(err.message || 'Error al eliminar cliente');
      } finally {
        setLoading(false);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      rfc: '',
      nombre: '',
      email: '',
      telefono: '',
      regimenFiscal: '616',
      calle: '',
      ciudad: '',
      estado: '',
      codigoPostal: '',
      usoCFDI: 'G01',
      notas: '',
    });
    setEditingId(null);
  };

  return (
    <div className="clients-page">
      <div className="clients-header">
        <h1>Gestión de Clientes</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
        >
          {showForm ? 'Cancelar' : '+ Nuevo Cliente'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {showForm && (
        <div className="client-form-container">
          <form onSubmit={handleSubmit} className="client-form">
            <div className="form-section">
              <h3>Información Básica</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>RFC *</label>
                  <input
                    type="text"
                    name="rfc"
                    value={formData.rfc}
                    onChange={handleInputChange}
                    placeholder="ABC123456XYZ"
                    disabled={!!editingId}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Nombre *</label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleInputChange}
                    placeholder="Nombre del cliente"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="cliente@example.com"
                  />
                </div>
                <div className="form-group">
                  <label>Teléfono</label>
                  <input
                    type="tel"
                    name="telefono"
                    value={formData.telefono}
                    onChange={handleInputChange}
                    placeholder="+55 1234567890"
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Dirección Fiscal</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Calle</label>
                  <input
                    type="text"
                    name="calle"
                    value={formData.calle}
                    onChange={handleInputChange}
                    placeholder="Avenida Principal 123"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Ciudad</label>
                  <input
                    type="text"
                    name="ciudad"
                    value={formData.ciudad}
                    onChange={handleInputChange}
                    placeholder="Ciudad"
                  />
                </div>
                <div className="form-group">
                  <label>Estado</label>
                  <input
                    type="text"
                    name="estado"
                    value={formData.estado}
                    onChange={handleInputChange}
                    placeholder="Estado"
                  />
                </div>
                <div className="form-group">
                  <label>Código Postal *</label>
                  <input
                    type="text"
                    name="codigoPostal"
                    value={formData.codigoPostal}
                    onChange={handleInputChange}
                    placeholder="28001"
                    pattern="\d{5}"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>Datos Fiscales</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Régimen Fiscal</label>
                  <select
                    name="regimenFiscal"
                    value={formData.regimenFiscal}
                    onChange={handleInputChange}
                  >
                    <option value="601">601 - General de ley personas morales</option>
                    <option value="603">603 - Personas morales con fines no lucrativos</option>
                    <option value="605">605 - Sueldos y salarios e ingresos asimilados</option>
                    <option value="606">606 - Arrendamiento</option>
                    <option value="607">607 - Otros ingresos</option>
                    <option value="608">608 - Rentistas</option>
                    <option value="609">609 - Sector financiero</option>
                    <option value="610">610 - Ingresos por dividendos</option>
                    <option value="611">611 - Otros ingresos por fracciones XI-XV</option>
                    <option value="612">612 - Personas físicas con actividades empresariales</option>
                    <option value="614">614 - Ganancias en capital</option>
                    <option value="616">616 - Sin obligación fiscal</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Uso de CFDI</label>
                  <select
                    name="usoCFDI"
                    value={formData.usoCFDI}
                    onChange={handleInputChange}
                  >
                    <option value="G01">G01 - Adquisición de mercancías</option>
                    <option value="G02">G02 - Devoluciones, descuentos o bonificaciones</option>
                    <option value="G03">G03 - Gastos en general</option>
                    <option value="I01">I01 - Construcciones</option>
                    <option value="I02">I02 - Mobiliario y equipo de oficina</option>
                    <option value="I03">I03 - Equipo de transporte</option>
                    <option value="I04">I04 - Equipo de cómputo y accesorios</option>
                    <option value="I05">I05 - Dados, troqueles, moldes, matrices</option>
                    <option value="I06">I06 - Adaptaciones</option>
                    <option value="I07">I07 - Activos circulantes</option>
                    <option value="I08">I08 - Adquisición de depreciables</option>
                    <option value="D01">D01 - Honorarios médicos</option>
                    <option value="D02">D02 - Honorarios de transporte</option>
                    <option value="D03">D03 - Honorarios consultoría</option>
                    <option value="D04">D04 - Gastos médicos</option>
                    <option value="D05">D05 - Gastos de transporte escolar</option>
                    <option value="D06">D06 - Escrituras y afiliaciones políticas</option>
                    <option value="D07">D07 - Cuotas sindicales</option>
                    <option value="D08">D08 - Cuotas de asociaciones</option>
                    <option value="D09">D09 - Gastos funerarios</option>
                    <option value="D10">D10 - Donativos</option>
                    <option value="E01">E01 - Residencias</option>
                    <option value="E02">E02 - Transporte escolar</option>
                    <option value="E03">E03 - Colegiaturas</option>
                    <option value="E04">E04 - Construcción de casa</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-group">
                <label>Notas</label>
                <textarea
                  name="notas"
                  value={formData.notas}
                  onChange={handleInputChange}
                  placeholder="Notas adicionales sobre el cliente"
                  rows="3"
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-success" disabled={loading}>
                {loading ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear Cliente'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Limpiar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="clients-list">
        <h2>Lista de Clientes ({clients.length})</h2>

        <input
          type="text"
          placeholder="Buscar por nombre, RFC o email..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          style={{
            width: '100%',
            padding: '10px 12px',
            marginBottom: '15px',
            fontSize: '14px',
            borderRadius: '4px',
            border: '1px solid #ddd',
            boxSizing: 'border-box'
          }}
        />

        {loading ? (
          <p>Cargando...</p>
        ) : clients.length === 0 ? (
          <p>No hay clientes registrados</p>
        ) : (
          <>
            <table className="clients-table">
              <thead>
                <tr>
                  <th>RFC</th>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>CP</th>
                  <th>Régimen</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {displayedClients.map(client => (
                <tr key={client._id}>
                  <td className="rfc">{client.rfc}</td>
                  <td className="nombre">{client.nombre}</td>
                  <td className="email">{client.email || '-'}</td>
                  <td className="telefono">{client.telefono || '-'}</td>
                  <td className="cp">{client.codigoPostal}</td>
                  <td className="regimen">{client.regimenFiscal}</td>
                  <td className="acciones">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleEdit(client)}
                    >
                      Editar
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(client._id)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

            {Math.ceil(
              clients.filter(client =>
                client.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
                client.rfc.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (client.email || '').toLowerCase().includes(searchQuery.toLowerCase())
              ).length / itemsPerPage
            ) > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '20px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="btn"
                  style={{ padding: '8px 12px', opacity: currentPage === 1 ? 0.5 : 1 }}
                >
                  ◀◀ Primera
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="btn"
                  style={{ padding: '8px 12px', opacity: currentPage === 1 ? 0.5 : 1 }}
                >
                  ◀ Anterior
                </button>

                <span style={{ margin: '0 8px', fontSize: '14px', fontWeight: '600' }}>
                  Página {currentPage} de {Math.ceil(
                    clients.filter(client =>
                      client.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      client.rfc.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (client.email || '').toLowerCase().includes(searchQuery.toLowerCase())
                    ).length / itemsPerPage
                  )}
                </span>

                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(
                    clients.filter(client =>
                      client.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      client.rfc.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (client.email || '').toLowerCase().includes(searchQuery.toLowerCase())
                    ).length / itemsPerPage
                  ), p + 1))}
                  disabled={currentPage === Math.ceil(
                    clients.filter(client =>
                      client.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      client.rfc.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (client.email || '').toLowerCase().includes(searchQuery.toLowerCase())
                    ).length / itemsPerPage
                  )}
                  className="btn"
                  style={{ padding: '8px 12px', opacity: currentPage === Math.ceil(
                    clients.filter(client =>
                      client.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      client.rfc.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (client.email || '').toLowerCase().includes(searchQuery.toLowerCase())
                    ).length / itemsPerPage
                  ) ? 0.5 : 1 }}
                >
                  Siguiente ▶
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
