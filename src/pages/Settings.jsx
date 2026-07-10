import { useState, useEffect } from 'react';
import { userService } from '../services/api';
import './Settings.css';

export default function Settings() {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
    regimenFiscal: '',
    codigoPostal: '',
    emailFacturacion: '',
    direccion: '',
    telefonoFacturacion: '',
    receiptMessage: '¡Gracias por su compra!'
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
        if (emisorResponse.data?.emisorConfig) {
          const config = emisorResponse.data.emisorConfig;
          setEmisorForm({
            rfc: config.rfc || '',
            nombre: config.nombre || '',
            regimenFiscal: config.regimenFiscal || '',
            codigoPostal: config.codigoPostal || '',
            emailFacturacion: config.emailFacturacion || '',
            direccion: config.direccion || '',
            telefonoFacturacion: config.telefonoFacturacion || '',
            receiptMessage: config.receiptMessage || '¡Gracias por su compra!'
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
        console.log('Emisor config not found, will create new one');
      }
    } catch (err) {
      setError('Error cargando información del usuario');
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
      setTimeout(() => setSuccess(''), 3000);
      loadUserData();
    } catch (err) {
      setError(err.message || 'Error actualizando perfil');
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
      <div className="settings-header">
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

                <form onSubmit={handleUpdateProfile} className="form-section">
                  <h3>Editar Información</h3>

                  <div className="form-group">
                    <label htmlFor="fullName">Nombre Completo</label>
                    <input
                      type="text"
                      id="fullName"
                      name="fullName"
                      value={userForm.fullName}
                      onChange={handleUserChange}
                      placeholder="Tu nombre completo"
                      maxLength="100"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="rfc">RFC (Opcional)</label>
                    <input
                      type="text"
                      id="rfc"
                      name="rfc"
                      value={userForm.rfc}
                      onChange={handleUserChange}
                      placeholder="XAXX010101000"
                      maxLength="13"
                      style={{ textTransform: 'uppercase' }}
                    />
                    <small>Formato: 12-13 caracteres</small>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </form>
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
                      <label htmlFor="nombre_emisor">Nombre Legal del Emisor *</label>
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
                        <optgroup label="Personas Morales">
                          <option value="601">601 - General de Ley Personas Morales</option>
                          <option value="602">602 - Personas Morales con Fines No Lucrativos</option>
                          <option value="605">605 - Personas Morales Residentes en el Extranjero Sin Establecimiento Permanente</option>
                          <option value="606">606 - Régimen de Enajenación o Adquisición de Bienes</option>
                          <option value="607">607 - Régimen de Prestación de Servicios</option>
                          <option value="608">608 - Actividades Agrícolas, Ganaderas, Silvícolas o Pesqueras</option>
                          <option value="609">609 - Ganaderos</option>
                          <option value="610">610 - Personas Físicas con Actividades Empresariales y Profesionales</option>
                          <option value="614">614 - Personas Morales en Régimen de Incorporación Fiscal</option>
                          <option value="616">616 - Personas Morales en Régimen de Transparencia Fiscal</option>
                          <option value="620">620 - Sociedades Mercantiles en Liquidación</option>
                          <option value="622">622 - Régimen de Pequeños Contribuyentes</option>
                          <option value="623">623 - Personas Morales de Saneamiento de Entidades Federativas</option>
                          <option value="624">624 - Sistema de Cobro para Adiciones de Ingresos</option>
                          <option value="625">625 - Régimen de Ingresos Fijos</option>
                          <option value="626">626 - Régimen Especial de Incorporación Fiscal</option>
                          <option value="627">627 - Sociedades de Producción Rural</option>
                          <option value="628">628 - Sindicatos y Asociaciones de Trabajadores</option>
                          <option value="629">629 - Instituciones de Seguros</option>
                          <option value="630">630 - Sociedades Financieras de Objeto Limitado</option>
                          <option value="631">631 - Instituciones para el Fomento de la Agricultura</option>
                          <option value="632">632 - Sociedades de Inversión en Valores</option>
                          <option value="633">633 - Sociedades de Inversión de Renta Variable</option>
                          <option value="634">634 - Administradora de Portafolios, Inversiones y Valores</option>
                          <option value="635">635 - Societarios y Asimilados</option>
                          <option value="636">636 - Otro Tipo de Personas Morales No Clasificadas</option>
                          <option value="637">637 - Entidades Paraestatales</option>
                          <option value="638">638 - Personas Morales Extranjeras</option>
                        </optgroup>
                        <optgroup label="Personas Físicas">
                          <option value="603">603 - Personas Físicas con Actividades Empresariales y Profesionales</option>
                          <option value="611">611 - Personas Físicas en Régimen de Incorporación Fiscal</option>
                          <option value="612">612 - Personas Físicas en Régimen de Transparencia Fiscal</option>
                          <option value="618">618 - Personas Físicas Tributando en Actividades de Fondos de Terceros</option>
                          <option value="621">621 - Sucesiones en Liquidación</option>
                        </optgroup>
                        <optgroup label="Residentes Extranjeros">
                          <option value="604">604 - Personas Físicas Residentes en el Extranjero sin Establecimiento Permanente</option>
                          <option value="613">613 - Personas Morales Residentes en el Extranjero Sin Establecimiento Permanente</option>
                          <option value="615">615 - Personas Físicas con Actividades Empresariales no Profesionales Tributando en RIF</option>
                          <option value="617">617 - Personas Morales con Actividades Empresariales Tributando en RIF</option>
                          <option value="619">619 - Personas Morales Tributando en Actividades de Fondos de Terceros en RIF</option>
                          <option value="639">639 - Personas Físicas Jubiladas que Opten por Régimen de RIF</option>
                        </optgroup>
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

                  <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Configuración del Recibo (POS)</h3>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="direccion">Dirección</label>
                      <input
                        type="text"
                        id="direccion"
                        name="direccion"
                        value={emisorForm.direccion}
                        onChange={handleEmisorChange}
                        placeholder="Calle 123, Apartado 456"
                      />
                      <small>Se mostrará en el recibo térmico</small>
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

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Guardando...' : 'Guardar Configuración'}
                  </button>
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
        </div>
      </div>
    </div>
  );
}
