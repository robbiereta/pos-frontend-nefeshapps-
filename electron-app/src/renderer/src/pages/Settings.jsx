import { useState, useEffect } from 'react';
import { userService } from '../services/api';
import { useToast } from '../components/ui/Toast.jsx';
import Button from '../components/ui/Button';
import './Settings.css';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const toast = useToast();

  // User profile state
  const [user, setUser] = useState(null);
  const [userForm, setUserForm] = useState({
    fullName: '',
    rfc: ''
  });

  // Emisor config state
  const [emisorForm, setEmisorForm] = useState({
    rfc: '',
    nombre: '',
    nombreComercial: '',
    regimenFiscal: '',
    codigoPostal: '',
    emailFacturacion: '',
    telefonoFacturacion: '',
    calle: '',
    numeroExterior: '',
    numeroInterior: '',
    colonia: '',
    ciudad: '',
    estado: '',
    pais: 'México',
    receiptMessage: '¡Gracias por su compra!',
    receiptWidth: '58mm'
  });

  const [swInfo, setSwInfo] = useState(null);
  const [swResponse, setSwResponse] = useState(null);

  // Cargar datos al montar
  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      setLoading(true);
      const response = await userService.getCurrentUser();
      const userData = response.data.user;

      setUser(userData);
      setUserForm({
        fullName: userData.fullName || '',
        rfc: userData.rfc || ''
      });

      // Cargar emisor config con sw_config
      try {
        const emisorResponse = await userService.getEmisorConfig();
        if (emisorResponse.data) {
          const config = emisorResponse.data;
          setEmisorForm({
            rfc: config.rfc || '',
            nombre: config.nombre || '',
            nombreComercial: config.nombreComercial || '',
            regimenFiscal: config.regimenFiscal || '',
            codigoPostal: config.codigoPostal || '',
            emailFacturacion: config.emailFacturacion || '',
            telefonoFacturacion: config.telefonoFacturacion || '',
            calle: config.calle || '',
            numeroExterior: config.numeroExterior || '',
            numeroInterior: config.numeroInterior || '',
            colonia: config.colonia || '',
            ciudad: config.ciudad || '',
            estado: config.estado || '',
            pais: config.pais || 'México',
            receiptMessage: config.receiptMessage || '¡Gracias por su compra!',
            receiptWidth: config.receiptWidth || '58mm'
          });

          // Obtener swConfig desde emisorConfig
          if (config.sw_config) {
            setSwInfo(config.sw_config);
            if (config.sw_config.swResponse) {
              setSwResponse(config.sw_config.swResponse);
            }
          }
        }
      } catch (err) {
        // Emisor config no existe aún, es opcional
      }
    } catch (err) {
      setError('Error cargando información del usuario');
      toast.error('Error cargando información del usuario');
    } finally {
      setLoading(false);
    }
  };

  const handleUserChange = (e) => {
    const { name, value } = e.target;
    setUserForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEmisorChange = (e) => {
    const { name, value } = e.target;
    setEmisorForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (userForm.rfc && !/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(userForm.rfc)) {
        throw new Error('Formato de RFC inválido');
      }

      await userService.updateCurrentUser({
        fullName: userForm.fullName,
        rfc: userForm.rfc || undefined
      });

      setSuccess('Perfil actualizado correctamente');
      toast.success('Perfil actualizado correctamente');
      setTimeout(() => setSuccess(''), 3000);
      loadUserData();
    } catch (err) {
      setError(err.message || 'Error actualizando perfil');
      toast.error(err.message || 'Error actualizando perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateEmisor = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!emisorForm.rfc) {
        throw new Error('RFC es requerido');
      }

      if (!emisorForm.nombre) {
        throw new Error('Nombre es requerido');
      }

      if (!emisorForm.codigoPostal) {
        throw new Error('Código postal es requerido');
      }

      // Incluir sw_config si existe
      const configData = {
        ...emisorForm,
        ...(swResponse && { sw_config: swResponse })
      };

      await userService.updateEmisorConfig(configData);

      setSuccess('Configuración de emisor actualizada correctamente');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Error actualizando configuración');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-container">
      <div className="page-title-hero">
        <h1>Configuración</h1>
        <p>Administra tu perfil y configuración de facturación</p>
      </div>

      <div className="settings-content">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="tabs-container">
          <div className="tabs">
            <button
              className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              Perfil
            </button>
            <button
              className={`tab-btn ${activeTab === 'emisor' ? 'active' : ''}`}
              onClick={() => setActiveTab('emisor')}
            >
              Configuración de Emisor
            </button>
            <button
              className={`tab-btn ${activeTab === 'sw' ? 'active' : ''}`}
              onClick={() => setActiveTab('sw')}
            >
              Portal SW.com.mx
            </button>
            <button
              className={`tab-btn ${activeTab === 'csd' ? 'active' : ''}`}
              onClick={() => setActiveTab('csd')}
            >
              Certificados (CSD)
            </button>

          </div>

          {/* TAB: PROFILE */}
          {activeTab === 'profile' && (
            <div className="tab-content">
              <div className="card">
                <h2>Información de Perfil</h2>

                <div className="info-grid">
                  <div className="info-item">
                    <label>Usuario</label>
                    <p className="info-value">{user?.username}</p>
                  </div>
                  <div className="info-item">
                    <label>Email</label>
                    <p className="info-value">{user?.email}</p>
                  </div>
                  <div className="info-item">
                    <label>Rol</label>
                    <p className="info-value">{user?.role}</p>
                  </div>
                  <div className="info-item">
                    <label>Estado</label>
                    <p className="info-value">
                      <span className={`status ${user?.isActive ? 'active' : 'inactive'}`}>
                        {user?.isActive ? 'Activo' : 'Inactivo'}
                      </span>
                    </p>
                  </div>
                  <div className="info-item">
                    <label>Cuenta creada</label>
                    <p className="info-value">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: EMISOR CONFIG */}
          {activeTab === 'emisor' && (
            <div className="tab-content">
              <div className="card">
                <h2>Configuración de Emisor (CFDI)</h2>
                <p className="section-description">
                  Estos datos se utilizarán para generar facturas electrónicas
                </p>

           

                <form onSubmit={handleUpdateEmisor} className="form-section">
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="rfc_emisor">RFC del Emisor *</label>
                      <input
                        type="text"
                        id="rfc_emisor"
                        name="rfc"
                        value={emisorForm.rfc}
                        onChange={handleEmisorChange}
                        placeholder="XAXX010101000"
                        maxLength="13"
                        style={{ textTransform: 'uppercase' }}
                        required
                      />
                      <small>Formato: 12-13 caracteres</small>
                    </div>

                    <div className="form-group">
                      <label htmlFor="nombre_emisor">Razon social: *</label>
                      <input
                        type="text"
                        id="nombre_emisor"
                        name="nombre"
                        value={emisorForm.nombre}
                        onChange={handleEmisorChange}
                        placeholder="Mi Empresa SA de CV"
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="nombreComercial">Nombre Comercial</label>
                    <input
                      type="text"
                      id="nombreComercial"
                      name="nombreComercial"
                      value={emisorForm.nombreComercial}
                      onChange={handleEmisorChange}
                      placeholder="El nombre que aparecerá en el recibo (ej: Mi Restaurante)"
                    />
                    <small>Se mostrará en el recibo térmico si se configura</small>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="regimen">Régimen Fiscal *</label>
                      <select
                        id="regimen"
                        name="regimenFiscal"
                        value={emisorForm.regimenFiscal}
                        onChange={handleEmisorChange}
                        required
                      >
                        <option value="">Selecciona un régimen</option>
                          <option value="601">601 - Regimen General de Personas Morales</option>  
                          <option value="610">612 - Personas Físicas con Actividades Empresariales y Profesionales</option>
                          <option value="626">626 - Regimen Simplificado de Confianza</option>                          
                      </select>
                    </div>

                    <div className="form-group">
                      <label htmlFor="codigoPostal">Código Postal *</label>
                      <input
                        type="text"
                        id="codigoPostal"
                        name="codigoPostal"
                        value={emisorForm.codigoPostal}
                        onChange={handleEmisorChange}
                        placeholder="28001"
                        maxLength="5"
                        required
                      />
                      <small>Código postal del domicilio fiscal</small>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="emailFacturacion">Email de Facturación</label>
                    <input
                      type="email"
                      id="emailFacturacion"
                      name="emailFacturacion"
                      value={emisorForm.emailFacturacion}
                      onChange={handleEmisorChange}
                      placeholder="facturacion@empresa.com"
                    />
                  </div>

                  <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Dirección Fiscal</h3>

                  <div className="form-group">
                    <label htmlFor="calle">Calle *</label>
                    <input
                      type="text"
                      id="calle"
                      name="calle"
                      value={emisorForm.calle}
                      onChange={handleEmisorChange}
                      placeholder="Avenida Principal"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="numeroExterior">Número Exterior</label>
                      <input
                        type="text"
                        id="numeroExterior"
                        name="numeroExterior"
                        value={emisorForm.numeroExterior}
                        onChange={handleEmisorChange}
                        placeholder="123"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="numeroInterior">Número Interior</label>
                      <input
                        type="text"
                        id="numeroInterior"
                        name="numeroInterior"
                        value={emisorForm.numeroInterior}
                        onChange={handleEmisorChange}
                        placeholder="456"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="colonia">Colonia/Localidad</label>
                    <input
                      type="text"
                      id="colonia"
                      name="colonia"
                      value={emisorForm.colonia}
                      onChange={handleEmisorChange}
                      placeholder="Centro"
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="ciudad">Ciudad</label>
                      <input
                        type="text"
                        id="ciudad"
                        name="ciudad"
                        value={emisorForm.ciudad}
                        onChange={handleEmisorChange}
                        placeholder="Ciudad de México"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="estado">Estado</label>
                      <input
                        type="text"
                        id="estado"
                        name="estado"
                        value={emisorForm.estado}
                        onChange={handleEmisorChange}
                        placeholder="Ciudad de México"
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="pais">País</label>
                      <input
                        type="text"
                        id="pais"
                        name="pais"
                        value={emisorForm.pais}
                        onChange={handleEmisorChange}
                        placeholder="México"
                      />
                    </div>
                  </div>

                  <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Configuración del Recibo (POS)</h3>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="receiptWidth">Ancho del Recibo</label>
                      <select
                        id="receiptWidth"
                        name="receiptWidth"
                        value={emisorForm.receiptWidth}
                        onChange={handleEmisorChange}
                      >
                        <option value="58mm">58mm - Térmica estándar</option>
                        <option value="80mm">80mm - Térmica grande</option>
                      </select>
                      <small>Tamaño del papel para la impresora térmica</small>
                    </div>

                    <div className="form-group">
                      <label htmlFor="telefonoFacturacion">Teléfono</label>
                      <input
                        type="tel"
                        id="telefonoFacturacion"
                        name="telefonoFacturacion"
                        value={emisorForm.telefonoFacturacion}
                        onChange={handleEmisorChange}
                        placeholder="+52 123 456 7890"
                      />
                      <small>Se mostrará en el recibo térmico</small>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="receiptMessage">Mensaje del Recibo</label>
                    <textarea
                      id="receiptMessage"
                      name="receiptMessage"
                      value={emisorForm.receiptMessage}
                      onChange={handleEmisorChange}
                      placeholder="¡Gracias por su compra!"
                      rows="3"
                      maxLength="200"
                    />
                    <small>Mensaje que aparecerá al pie del recibo ({emisorForm.receiptMessage?.length || 0}/200 caracteres)</small>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={loading}
                    loading={loading}
                  >
                    {loading ? 'Guardando...' : 'Guardar Configuración'}
                  </Button>
                </form>
              </div>
            </div>
          )}

          {/* TAB: SW.COM.MX */}
          {activeTab === 'sw' && swInfo && (
            <div className="tab-content">
              <div className="card">
                <h2>Integración SW.com.mx</h2>
                <p className="section-description">
                  Información de tu cuenta para timbrado de facturas
                </p>

                <div className="info-grid">
                  <div className="info-item">
                    <label>SW User ID</label>
                    <p className="info-value font-mono">{swInfo.swUserId}</p>
                  </div>
                  <div className="info-item">
                    <label>Email SW</label>
                    <p className="info-value">{swInfo.email}</p>
                  </div>
                  <div className="info-item">
                    <label>Token Activo</label>
                    <p className="info-value">
                      <span className={`status ${swInfo.useProductionToken ? 'warning' : 'info'}`}>
                        {swInfo.useProductionToken ? 'Producción' : 'Pruebas'}
                      </span>
                    </p>
                  </div>
                  <div className="info-item">
                    <label>Cuenta Creada</label>
                    <p className="info-value">
                      {swInfo.createdAt ? new Date(swInfo.createdAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="sw-info-box">
                  <h3>Para Obtener Tus Tokens:</h3>
                  <ol>
                    <li>Accede a <strong>portal.sw.com.mx</strong></li>
                    <li>Inicia sesión con tu email: <code>{swInfo.email}</code></li>
                    <li>Ingresa a la sección de "Tokens" o "API"</li>
                    <li>Genera nuevos tokens si es necesario</li>
                    <li>Guarda los tokens en un lugar seguro</li>
                  </ol>
                </div>

                <div className="info-alert">
                  <strong>⚠️ Nota:</strong> Los tokens no se almacenan localmente. Debes obtenerlos del portal de SW.com.mx y usarlos en tus aplicaciones cliente.
                </div>
              </div>
            </div>
          )}

          {/* TAB: CSD — Certificados de Sello Digital */}
          {activeTab === 'csd' && (
            <div className="tab-content">
              <div className="card">
                <h2>Certificados de Sello Digital (CSD)</h2>
                <p className="section-description">
                  Para timbrar facturas (CFDI 4.0) el SAT exige que cada emisor suba su
                  Certificado de Sello Digital (archivos <code>.cer</code> + <code>.key</code> + contraseña)
                  al PAC. Aquí no se suben — se suben en el portal de SW.com.mx.
                </p>

                <div className="sw-info-box" style={{ marginTop: '1.25rem' }}>
                  <h3>Cómo agregar tus CSD</h3>
                  <ol>
                    <li>
                      Abre <a href="https://portal.sw.com.mx" target="_blank" rel="noopener noreferrer">
                        <strong>portal.sw.com.mx</strong>
                      </a> en una pestaña nueva.
                    </li>
                    <li>
                      Inicia sesión con las <strong>mismas credenciales</strong> que usaste
                      al registrarte en npos (el email de tu cuenta y la contraseña SW).
                    </li>
                    <li>
                      En el menú lateral, entra a <em>“Certificados / CSD”</em> (o
                      “Emisión → Sellos digitales” según la versión del portal).
                    </li>
                    <li>
                      Sube los tres archivos que el SAT te entregó:
                      <ul style={{ marginTop: '0.4rem' }}>
                        <li><code>certificado.cer</code> — el certificado público</li>
                        <li><code>llave.key</code> — la llave privada</li>
                        <li>La contraseña de la llave (la que el SAT te pidió al tramitarla)</li>
                      </ul>
                    </li>
                    <li>
                      Confirma con tu <strong>contraseña del portal SW</strong> para activar el sello.
                    </li>
                  </ol>
                </div>

                <div className="info-alert" style={{ marginTop: '1rem' }}>
                  <strong>ℹ️ Importante:</strong> los CSD NO se suben en este panel. Se suben
                  directamente en el portal de SW porque el PAC los necesita firmados con su propio
                  sistema. Una vez subidos, los CFDI que timbres desde aquí saldrán automáticamente
                  con tu sello sin que tengas que hacer nada más.
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
                  <Button
                    variant="primary"
                    onClick={() => window.open('https://portal.sw.com.mx', '_blank', 'noopener,noreferrer')}
                  >
                    Abrir portal.sw.com.mx
                  </Button>
                  {swInfo?.email && (
                    <span className="muted" style={{ alignSelf: 'center' }}>
                      Entra con: <code>{swInfo.email}</code>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
