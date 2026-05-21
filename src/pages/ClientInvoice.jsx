import { useState } from 'react';
import { invoiceService } from '../services/api';

export default function ClientInvoice() {
  const [formData, setFormData] = useState({
    receptorRfc: '',
    receptorNombre: '',
    receptorRegimen: '616',
    DomicilioFiscalReceptor: '',
    UsoCFDI: 'G01',
    folio: '',
    formaPago: '99',
    MetodoPago: 'PUE'
  });

  const [items, setItems] = useState([
    {
      pu: '',
      cantidad: '',
      Descripcion: '',
      CodigoSat: '81111501',
      ClaveUnidad: 'E48',
      Unidad: 'Servicio'
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, {
      pu: '',
      cantidad: '',
      Descripcion: '',
      CodigoSat: '81111501',
      ClaveUnidad: 'E48',
      Unidad: 'Servicio'
    }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateTotals = () => {
    return items.reduce((acc, item) => {
      const pu = parseFloat(item.pu) || 0;
      const cantidad = parseFloat(item.cantidad) || 0;
      const subtotal = pu * cantidad;
      acc.subtotal += subtotal;
      acc.iva += subtotal * 0.16;
      acc.total += subtotal * 1.16;
      return acc;
    }, { subtotal: 0, iva: 0, total: 0 });
  };

  const validateForm = () => {
    if (!formData.receptorRfc.trim()) {
      setError('El RFC del receptor es requerido');
      return false;
    }
    if (!formData.receptorNombre.trim()) {
      setError('El nombre del receptor es requerido');
      return false;
    }
    if (!formData.DomicilioFiscalReceptor.trim()) {
      setError('El domicilio fiscal del receptor es requerido');
      return false;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.pu || parseFloat(item.pu) <= 0) {
        setError(`El precio unitario del item ${i + 1} es requerido y debe ser mayor a 0`);
        return false;
      }
      if (!item.cantidad || parseFloat(item.cantidad) <= 0) {
        setError(`La cantidad del item ${i + 1} es requerida y debe ser mayor a 0`);
        return false;
      }
      if (!item.Descripcion.trim()) {
        setError(`La descripción del item ${i + 1} es requerida`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);
    setResult(null);

    try {
      const invoiceData = {
        ...formData,
        notasPartidas: items
      };

      const response = await invoiceService.generateClient(invoiceData);
      
      setMessage('Factura de cliente generada y timbrada correctamente');
      setResult(response);
    } catch (err) {
      setError(err.message || 'Error al generar la factura');
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <>
      <h2 style={{ marginBottom: '1.5rem' }}>Generar Factura de Cliente</h2>
      
      <div className="card">
        <h2>Factura para Cliente Específico</h2>
        <p style={{ color: 'var(--gray-500)', marginBottom: '1.5rem' }}>
          Genera una factura CFDI para un cliente específico con todos los datos requeridos por el SAT.
        </p>

        {error && <div className="error-message">{error}</div>}
        {message && <div className="success-message">{message}</div>}

        <form onSubmit={handleSubmit}>
          {/* Datos del Receptor */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--primary-color)' }}>
              Datos del Receptor
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className="form-group">
                <label htmlFor="receptorRfc">RFC del Receptor *</label>
                <input
                  type="text"
                  id="receptorRfc"
                  name="receptorRfc"
                  value={formData.receptorRfc}
                  onChange={handleInputChange}
                  placeholder="XAXX010101000"
                  required
                  style={{ textTransform: 'uppercase' }}
                />
              </div>
              <div className="form-group">
                <label htmlFor="receptorNombre">Nombre del Receptor *</label>
                <input
                  type="text"
                  id="receptorNombre"
                  name="receptorNombre"
                  value={formData.receptorNombre}
                  onChange={handleInputChange}
                  placeholder="Nombre completo del cliente"
                  required
                />
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="receptorRegimen">Régimen Fiscal</label>
                <select
                  id="receptorRegimen"
                  name="receptorRegimen"
                  value={formData.receptorRegimen}
                  onChange={handleInputChange}
                >
                  <option value="616">616 - Sin obligaciones fiscales</option>
                  <option value="601">601 - General de Ley Personas Morales</option>
                  <option value="603">603 - Personas Morales con fines no lucrativos</option>
                  <option value="605">605 - Sueldos y salarios e ingresos asimilados a salarios</option>
                  <option value="606">606 - Régimen de actividades agrícolas, ganaderas, silvícolas y pesqueras</option>
                  <option value="607">607 - Régimen de actividades empresariales y profesionales</option>
                  <option value="608">608 - Régimen de incorporación fiscal</option>
                  <option value="610">610 - Régimen de los ingresos enajenación de casa habitación</option>
                  <option value="611">611 - Régimen de los ingresos por sueldos y salarios</option>
                  <option value="612">612 - Personas físicas con ingresos de otros países</option>
                  <option value="614">614 - Régimen de los ingresos por intereses</option>
                  <option value="615">615 - Régimen de los ingresos por dividendos</option>
                  <option value="621">621 - Sociedades cooperativas de producción</option>
                  <option value="622">622 - Actividades agrícolas, ganaderas, silvícolas y pesqueras</option>
                  <option value="623">623 - Opcional para grupos de sociedades</option>
                  <option value="624">624 - Coordinados</option>
                  <option value="625">625 - Régimen de actividades empresariales con ingresos a través de plataformas</option>
                  <option value="626">626 - Régimen simplificado de confianza</option>
                </select>
              </div>
              
              <div className="form-group">
                <label htmlFor="DomicilioFiscalReceptor">Código Postal Fiscal *</label>
                <input
                  type="text"
                  id="DomicilioFiscalReceptor"
                  name="DomicilioFiscalReceptor"
                  value={formData.DomicilioFiscalReceptor}
                  onChange={handleInputChange}
                  placeholder="87000"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="UsoCFDI">Uso del CFDI</label>
                <select
                  id="UsoCFDI"
                  name="UsoCFDI"
                  value={formData.UsoCFDI}
                  onChange={handleInputChange}
                >
                  <option value="G01">G01 - Adquisición de mercancías</option>
                  <option value="G02">G02 - Devoluciones, descuentos o bonificaciones</option>
                  <option value="G03">G03 - Gastos en general</option>
                  <option value="I01">I01 - Construcciones</option>
                  <option value="I02">I02 - Mobiliario y equipo de oficina</option>
                  <option value="I03">I03 - Equipo de transporte</option>
                  <option value="I04">I04 - Equipo de cómputo y accesorios</option>
                  <option value="I05">I05 - Dados, troqueles, moldes, matrices y herramental</option>
                  <option value="I06">I06 - Comunicaciones telefónicas</option>
                  <option value="I07">I07 - Comunicaciones satelitales</option>
                  <option value="I08">I08 - Otra maquinaria y equipo</option>
                  <option value="D01">D01 - Honorarios médicos, dentales y gastos hospitalarios</option>
                  <option value="D02">D02 - Gastos médicos por incapacidad o discapacidad</option>
                  <option value="D03">D03 - Gastos funerales</option>
                  <option value="D04">D04 - Donativos</option>
                  <option value="D05">D05 - Intereses reales efectivamente pagados por créditos hipotecarios</option>
                  <option value="D06">D06 - Aportaciones voluntarias al SAR</option>
                  <option value="D07">D07 - Primas por seguros de gastos médicos</option>
                  <option value="D08">D08 - Gastos de transportación escolar obligatoria</option>
                  <option value="D09">D09 - Depósitos en cuentas para el ahorro, primas que tengan como base planes de pensiones</option>
                  <option value="D10">D10 - Pagos por servicios educativos</option>
                  <option value="P01">P01 - Por definir</option>
                </select>
              </div>
            </div>
          </div>

          {/* Conceptos */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--primary-color)' }}>
              Conceptos de la Factura
            </h3>
            
            {items.map((item, index) => (
              <div key={index} style={{ 
                border: '1px solid var(--gray-200)', 
                borderRadius: '4px', 
                padding: '1rem', 
                marginBottom: '1rem',
                backgroundColor: 'var(--gray-50)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Item {index + 1}</h4>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      style={{
                        backgroundColor: 'var(--error-color)',
                        color: 'white',
                        border: 'none',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div className="form-group">
                    <label>Descripción *</label>
                    <input
                      type="text"
                      value={item.Descripcion}
                      onChange={(e) => handleItemChange(index, 'Descripcion', e.target.value)}
                      placeholder="Descripción del producto o servicio"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Precio Unitario *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.pu}
                      onChange={(e) => handleItemChange(index, 'pu', e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Cantidad *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.cantidad}
                      onChange={(e) => handleItemChange(index, 'cantidad', e.target.value)}
                      placeholder="1.00"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Total</label>
                    <input
                      type="text"
                      value={(parseFloat(item.pu) || 0) * (parseFloat(item.cantidad) || 0)}
                      readOnly
                      style={{ backgroundColor: 'var(--gray-100)' }}
                    />
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <div className="form-group">
                    <label>Clave SAT</label>
                    <select
                      value={item.CodigoSat}
                      onChange={(e) => handleItemChange(index, 'CodigoSat', e.target.value)}
                    >
                      <optgroup label="Servicios Profesionales">
                        <option value="81111501">81111501 - Consultoría en administración</option>
                        <option value="81111502">81111502 - Consultoría en administración de proyectos</option>
                        <option value="81111503">81111503 - Consultoría en ingeniería</option>
                        <option value="81111504">81111504 - Consultoría en recursos humanos</option>
                        <option value="81111505">81111505 - Consultoría en finanzas</option>
                        <option value="81111506">81111506 - Consultoría en mercadotecnia</option>
                        <option value="81111507">81111507 - Consultoría en sistemas informáticos</option>
                        <option value="81111508">81111508 - Consultoría en procesos de negocio</option>
                        <option value="81111509">81111509 - Consultoría en calidad</option>
                        <option value="81111510">81111510 - Consultoría en logística</option>
                        <option value="81121501">81121501 - Desarrollo de software a la medida</option>
                        <option value="81121502">81121502 - Mantenimiento de software</option>
                        <option value="81121503">81121503 - Soporte técnico de software</option>
                        <option value="81121504">81121504 - Análisis y diseño de sistemas</option>
                        <option value="81121505">81121505 - Programación de aplicaciones</option>
                        <option value="81121506">81121506 - Integración de sistemas</option>
                        <option value="81121507">81121507 - Pruebas de software</option>
                        <option value="81121508">81121508 - Implementación de software</option>
                        <option value="81121601">81121601 - Servicios de diseño gráfico</option>
                        <option value="81121602">81121602 - Servicios de diseño industrial</option>
                        <option value="81121603">81121603 - Servicios de diseño de interiores</option>
                        <option value="81121604">81121604 - Servicios de diseño arquitectónico</option>
                        <option value="81121605">81121605 - Servicios de diseño web</option>
                        <option value="81121606">81121606 - Servicios de diseño de moda</option>
                        <option value="81121701">81121701 - Servicios legales</option>
                        <option value="81121702">81121702 - Servicios de contabilidad</option>
                        <option value="81121703">81121703 - Servicios de auditoría</option>
                        <option value="81121704">81121704 - Servicios de asesoría fiscal</option>
                        <option value="81121705">81121705 - Servicios de asesoría laboral</option>
                      </optgroup>
                      <optgroup label="Servicios Técnicos y Mantenimiento">
                        <option value="50111501">50111501 - Servicios de instalación</option>
                        <option value="50111502">50111502 - Servicios de montaje</option>
                        <option value="50111503">50111503 - Servicios de desmontaje</option>
                        <option value="50111504">50111504 - Servicios de cableado</option>
                        <option value="50111505">50111505 - Servicios de conexión</option>
                        <option value="50202300">50202300 - Mantenimiento y reparación de maquinaria</option>
                        <option value="50202301">50202301 - Mantenimiento de equipo de cómputo</option>
                        <option value="50202302">50202302 - Mantenimiento de equipo de oficina</option>
                        <option value="50202303">50202303 - Mantenimiento de equipo industrial</option>
                        <option value="50202304">50202304 - Mantenimiento de vehículos</option>
                        <option value="50202305">50202305 - Mantenimiento de equipo médico</option>
                        <option value="50211501">50211501 - Reparación de equipo de cómputo</option>
                        <option value="50211502">50211502 - Reparación de equipo de oficina</option>
                        <option value="50211503">50211503 - Reparación de equipo de comunicación</option>
                        <option value="50211504">50211504 - Reparación de equipo electrónico</option>
                        <option value="50211505">50211505 - Reparación de equipo médico</option>
                      </optgroup>
                      <optgroup label="Servicios Educativos y Capacitación">
                        <option value="84111500">84111500 - Servicios educativos</option>
                        <option value="84111501">84111501 - Servicios de capacitación</option>
                        <option value="84111502">84111502 - Servicios de adiestramiento</option>
                        <option value="84111503">84111503 - Servicios de formación profesional</option>
                        <option value="84111504">84111504 - Servicios de educación continua</option>
                        <option value="84111505">84111505 - Servicios de educación a distancia</option>
                        <option value="84111506">84111506 - Servicios de educación en línea</option>
                        <option value="84111507">84111507 - Servicios de educación corporativa</option>
                        <option value="84111508">84111508 - Servicios de educación técnica</option>
                        <option value="84111509">84111509 - Servicios de educación superior</option>
                      </optgroup>
                      <optgroup label="Servicios de Información y Comunicación">
                        <option value="84121201">84121201 - Servicios de procesamiento de datos</option>
                        <option value="84121202">84121202 - Servicios de hospedaje de información</option>
                        <option value="84121203">84121203 - Servicios de almacenamiento de datos</option>
                        <option value="84121204">84121204 - Servicios de respaldo de información</option>
                        <option value="84121205">84121205 - Servicios de recuperación de datos</option>
                        <option value="84121206">84121206 - Servicios de nube (cloud)</option>
                        <option value="84121207">84121207 - Servicios de infraestructura como servicio</option>
                        <option value="84121208">84121208 - Servicios de plataforma como servicio</option>
                        <option value="84121209">84121209 - Servicios de software como servicio</option>
                        <option value="84121210">84121210 - Servicios de bases de datos</option>
                        <option value="84121211">84121211 - Servicios de seguridad informática</option>
                        <option value="84121212">84121212 - Servicios de monitoreo de sistemas</option>
                        <option value="84121213">84121213 - Servicios de administración de redes</option>
                        <option value="84121214">84121214 - Servicios de administración de servidores</option>
                        <option value="84121215">84121215 - Servicios de administración de sistemas</option>
                      </optgroup>
                      <optgroup label="Servicios de Marketing y Publicidad">
                        <option value="84131600">84131600 - Servicios de publicidad</option>
                        <option value="84131601">84131601 - Servicios de marketing digital</option>
                        <option value="84131602">84131602 - Servicios de marketing en redes sociales</option>
                        <option value="84131603">84131603 - Servicios de marketing por correo electrónico</option>
                        <option value="84131604">84131604 - Servicios de marketing de contenidos</option>
                        <option value="84131605">84131605 - Servicios de marketing de búsqueda</option>
                        <option value="84131606">84131606 - Servicios de marketing de afiliados</option>
                        <option value="84131607">84131607 - Servicios de marketing de influencia</option>
                        <option value="84131608">84131608 - Servicios de marketing de eventos</option>
                        <option value="84131609">84131609 - Servicios de marketing de marca</option>
                        <option value="84131610">84131610 - Servicios de marketing de producto</option>
                      </optgroup>
                      <optgroup label="Arrendamiento y Alquiler">
                        <option value="71101100">71101100 - Arrendamiento de inmuebles</option>
                        <option value="71101101">71101101 - Arrendamiento de oficinas</option>
                        <option value="71101102">71101102 - Arrendamiento de bodegas</option>
                        <option value="71101103">71101103 - Arrendamiento de locales comerciales</option>
                        <option value="71101104">71101104 - Arrendamiento de terrenos</option>
                        <option value="71101105">71101105 - Arrendamiento de estacionamientos</option>
                        <option value="71101200">71101200 - Arrendamiento de maquinaria</option>
                        <option value="71101201">71101201 - Arrendamiento de equipo de cómputo</option>
                        <option value="71101202">71101202 - Arrendamiento de equipo de oficina</option>
                        <option value="71101203">71101203 - Arrendamiento de equipo industrial</option>
                        <option value="71101204">71101204 - Arrendamiento de vehículos</option>
                        <option value="71101205">71101205 - Arrendamiento de equipo médico</option>
                        <option value="71101206">71101206 - Arrendamiento de equipo de construcción</option>
                        <option value="71101207">71101207 - Arrendamiento de equipo de comunicación</option>
                      </optgroup>
                      <optgroup label="Productos y Otros">
                        <option value="10101500">10101500 - Equipo de cómputo</option>
                        <option value="10101501">10101501 - Computadoras de escritorio</option>
                        <option value="10101502">10101502 - Computadoras portátiles</option>
                        <option value="10101503">10101503 - Tabletas electrónicas</option>
                        <option value="10101504">10101504 - Teléfonos inteligentes</option>
                        <option value="10101505">10101505 - Servidores</option>
                        <option value="10101506">10101506 - Equipos de red</option>
                        <option value="10101507">10101507 - Equipos de comunicación</option>
                        <option value="10101508">10101508 - Equipos de impresión</option>
                        <option value="10101509">10101509 - Equipos de escaneo</option>
                        <option value="10101510">10101510 - Equipos de almacenamiento</option>
                        <option value="10101511">10101511 - Equipos de video</option>
                        <option value="10101512">10101512 - Equipos de audio</option>
                        <option value="10101513">10101513 - Equipos de fotografía</option>
                        <option value="10101514">10101514 - Equipos de navegación</option>
                        <option value="10101515">10101515 - Equipos de medición</option>
                        <option value="01010101">01010101 - No existe en el catálogo</option>
                        <option value="50101601">50101601 - Suministro de energía eléctrica</option>
                        <option value="50101602">50101602 - Suministro de agua</option>
                        <option value="50101603">50101603 - Suministro de gas</option>
                        <option value="50101604">50101604 - Suministro de internet</option>
                        <option value="50101605">50101605 - Suministro de telefonía</option>
                        <option value="50101606">50101606 - Suministro de televisión</option>
                        <option value="50101607">50101607 - Suministro de radio</option>
                        <option value="50101608">50101608 - Suministro de servicios de mensajería</option>
                        <option value="50101609">50101609 - Suministro de servicios de paquetería</option>
                        <option value="50101610">50101610 - Suministro de servicios de transporte</option>
                      </optgroup>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Clave Unidad</label>
                    <select
                      value={item.ClaveUnidad}
                      onChange={(e) => handleItemChange(index, 'ClaveUnidad', e.target.value)}
                    >
                      <optgroup label="Unidades de Servicio">
                        <option value="E48">E48 - Unidad de servicio</option>
                        <option value="ACT">ACT - Actividad</option>
                        <option value="E49">E49 - Porcentaje</option>
                        <option value="E51">E51 - Tarifa plana</option>
                        <option value="E52">E52 - Cuota</option>
                        <option value="E54">E54 - Hora</option>
                        <option value="E55">E55 - Día</option>
                        <option value="E56">E56 - Semana</option>
                        <option value="E57">E57 - Quincena</option>
                        <option value="E58">E58 - Mes</option>
                        <option value="E59">E59 - Año</option>
                        <option value="E60">E60 - Año bisiesto</option>
                        <option value="E61">E61 - Lustro</option>
                        <option value="E62">E62 - Década</option>
                        <option value="E63">E63 - Quincenal</option>
                        <option value="E64">E64 - Bienal</option>
                      </optgroup>
                      <optgroup label="Unidades de Longitud">
                        <option value="MTS">MTS - Metro</option>
                        <option value="MTK">MTK - Metro cuadrado</option>
                        <option value="MTQ">MTQ - Metro cúbico</option>
                        <option value="KMT">KMT - Kilómetro</option>
                        <option value="KLT">KLT - Kilómetro cuadrado</option>
                        <option value="KMQ">KMQ - Kilómetro cúbico</option>
                        <option value="MTR">MTR - Milímetro</option>
                        <option value="CMK">CMK - Centímetro cuadrado</option>
                        <option value="CMQ">CMQ - Centímetro cúbico</option>
                        <option value="MMT">MMT - Milímetro</option>
                        <option value="MMK">MMK - Milímetro cuadrado</option>
                        <option value="MMQ">MMQ - Milímetro cúbico</option>
                        <option value="MIL">MIL - Milla</option>
                        <option value="YRD">YRD - Yarda</option>
                        <option value="FTK">FTK - Pie cuadrado</option>
                        <option value="FTQ">FTQ - Pie cúbico</option>
                        <option value="INH">INH - Pulgada</option>
                        <option value="INK">INK - Pulgada cuadrada</option>
                        <option value="INQ">INQ - Pulgada cúbica</option>
                      </optgroup>
                      <optgroup label="Unidades de Masa">
                        <option value="KGM">KGM - Kilogramo</option>
                        <option value="GRM">GRM - Gramo</option>
                        <option value="MGM">MGM - Miligramo</option>
                        <option value="TNE">TNE - Tonelada</option>
                        <option value="LTN">LTN - Tonelada larga</option>
                        <option value="KTM">KTM - Kilómetro</option>
                        <option value="LBR">LBR - Libra</option>
                        <option value="ONZ">ONZ - Onza</option>
                        <option value="OZA">OZA - Onza avoirdupois</option>
                        <option value="OZT">OZT - Onza troy</option>
                      </optgroup>
                      <optgroup label="Unidades de Volumen y Capacidad">
                        <option value="LTR">LTR - Litro</option>
                        <option value="MLT">MLT - Mililitro</option>
                        <option value="KLT">KLT - Kilolitro</option>
                        <option value="MLL">MLL - Mililitro</option>
                        <option value="GLL">GLL - Galón</option>
                        <option value="GKI">GKI - Galón imperial</option>
                        <option value="GKD">GKD - Galón US</option>
                        <option value="PTI">PTI - Pinta</option>
                        <option value="PTK">PTK - Pinta imperial</option>
                        <option value="PTD">PTD - Pinta US</option>
                        <option value="QTQ">QTQ - Cuarto</option>
                        <option value="QTI">QTI - Cuarto imperial</option>
                        <option value="QTD">QTD - Cuarto US</option>
                        <option value="BTL">BTL - Botella</option>
                        <option value="BTL">BTL - Barril</option>
                        <option value="BRL">BRL - Barril</option>
                        <option value="BZL">BZL - Barril de petróleo</option>
                      </optgroup>
                      <optgroup label="Unidades de Conteo">
                        <option value="H87">H87 - Pieza</option>
                        <option value="XPK">XPK - Paquete</option>
                        <option value="XBX">XBX - Caja</option>
                        <option value="XCT">XCT - Caja</option>
                        <option value="XBG">XBG - Bolsa</option>
                        <option value="XBJ">XBJ - Barril</option>
                        <option value="XBT">XBT - Botella</option>
                        <option value="XBX">XBX - Caja</option>
                        <option value="XCA">XCA - Carga</option>
                        <option value="XCD">XCD - Cinta</option>
                        <option value="XCE">XCE - Cepillo</option>
                        <option value="XCF">XCF - Carrete</option>
                        <option value="XCG">XCG - Caja</option>
                        <option value="XCH">XCH - Charola</option>
                        <option value="XCI">XCI - Cilindro</option>
                        <option value="XCJ">XCJ - Caja</option>
                        <option value="XCK">XCK - Caja</option>
                        <option value="XCL">XCL - Caja</option>
                        <option value="XCM">XCM - Caja</option>
                        <option value="XCN">XCN - Caja</option>
                        <option value="XCO">XCO - Caja</option>
                        <option value="XCP">XCP - Caja</option>
                        <option value="XCQ">XCQ - Caja</option>
                        <option value="XCR">XCR - Caja</option>
                        <option value="XCS">XCS - Caja</option>
                        <option value="XCT">XCT - Caja</option>
                        <option value="XCU">XCU - Caja</option>
                        <option value="XCV">XCV - Caja</option>
                        <option value="XCW">XCW - Caja</option>
                        <option value="XCX">XCX - Caja</option>
                        <option value="XCY">XCY - Caja</option>
                        <option value="XCZ">XCZ - Caja</option>
                        <option value="XDA">XDA - Dosis</option>
                        <option value="XDB">XDB - Doble</option>
                        <option value="XDC">XDC - Docena</option>
                        <option value="XDD">XDD - Docena</option>
                        <option value="XDE">XDE - Decena</option>
                        <option value="XDF">XDF - Decena</option>
                        <option value="XDG">XDG - Decena</option>
                        <option value="XDH">XDH - Decena</option>
                        <option value="XDI">XDI - Decena</option>
                        <option value="XDJ">XDJ - Decena</option>
                        <option value="XDK">XDK - Decena</option>
                        <option value="XDL">XDL - Decena</option>
                        <option value="XDM">XDM - Decena</option>
                        <option value="XDN">XDN - Decena</option>
                        <option value="XDO">XDO - Decena</option>
                        <option value="XDP">XDP - Decena</option>
                        <option value="XDQ">XDQ - Decena</option>
                        <option value="XDR">XDR - Decena</option>
                        <option value="XDS">XDS - Decena</option>
                        <option value="XDT">XDT - Decena</option>
                        <option value="XDU">XDU - Decena</option>
                        <option value="XDV">XDV - Decena</option>
                        <option value="XDW">XDW - Decena</option>
                        <option value="XDX">XDX - Decena</option>
                        <option value="XDY">XDY - Decena</option>
                        <option value="XDZ">XDZ - Decena</option>
                        <option value="XEA">XEA - Unidad</option>
                        <option value="XEB">XEB - Unidad</option>
                        <option value="XEC">XEC - Unidad</option>
                        <option value="XED">XED - Unidad</option>
                        <option value="XEE">XEE - Unidad</option>
                        <option value="XEF">XEF - Unidad</option>
                        <option value="XEG">XEG - Unidad</option>
                        <option value="XEH">XEH - Unidad</option>
                        <option value="XEI">XEI - Unidad</option>
                        <option value="XEJ">XEJ - Unidad</option>
                        <option value="XEK">XEK - Unidad</option>
                        <option value="XEL">XEL - Unidad</option>
                        <option value="XEM">XEM - Unidad</option>
                        <option value="XEN">XEN - Unidad</option>
                        <option value="XEO">XEO - Unidad</option>
                        <option value="XEP">XEP - Unidad</option>
                        <option value="XEQ">XEQ - Unidad</option>
                        <option value="XER">XER - Unidad</option>
                        <option value="XES">XES - Unidad</option>
                        <option value="XET">XET - Unidad</option>
                        <option value="XEU">XEU - Unidad</option>
                        <option value="XEV">XEV - Unidad</option>
                        <option value="XEW">XEW - Unidad</option>
                        <option value="XEX">XEX - Unidad</option>
                        <option value="XEY">XEY - Unidad</option>
                        <option value="XEZ">XEZ - Unidad</option>
                        <option value="XFA">XFA - Frasco</option>
                        <option value="XFB">XFB - Frasco</option>
                        <option value="XFC">XFC - Frasco</option>
                        <option value="XFD">XFD - Frasco</option>
                        <option value="XFE">XFE - Frasco</option>
                        <option value="XFF">XFF - Frasco</option>
                        <option value="XFG">XFG - Frasco</option>
                        <option value="XFH">XFH - Frasco</option>
                        <option value="XFI">XFI - Frasco</option>
                        <option value="XFJ">XFJ - Frasco</option>
                        <option value="XFK">XFK - Frasco</option>
                        <option value="XFL">XFL - Frasco</option>
                        <option value="XFM">XFM - Frasco</option>
                        <option value="XFN">XFN - Frasco</option>
                        <option value="XFO">XFO - Frasco</option>
                        <option value="XFP">XFP - Frasco</option>
                        <option value="XFQ">XFQ - Frasco</option>
                        <option value="XFR">XFR - Frasco</option>
                        <option value="XFS">XFS - Frasco</option>
                        <option value="XFT">XFT - Frasco</option>
                        <option value="XFU">XFU - Frasco</option>
                        <option value="XFV">XFV - Frasco</option>
                        <option value="XFW">XFW - Frasco</option>
                        <option value="XFX">XFX - Frasco</option>
                        <option value="XFY">XFY - Frasco</option>
                        <option value="XFZ">XFZ - Frasco</option>
                        <option value="XGA">XGA - Galón</option>
                        <option value="XGB">XGB - Galón</option>
                        <option value="XGC">XGC - Galón</option>
                        <option value="XGD">XGD - Galón</option>
                        <option value="XGE">XGE - Galón</option>
                        <option value="XGF">XGF - Galón</option>
                        <option value="XGG">XGG - Galón</option>
                        <option value="XGH">XGH - Galón</option>
                        <option value="XGI">XGI - Galón</option>
                        <option value="XGJ">XGJ - Galón</option>
                        <option value="XGK">XGK - Galón</option>
                        <option value="XGL">XGL - Galón</option>
                        <option value="XGM">XGM - Galón</option>
                        <option value="XGN">XGN - Galón</option>
                        <option value="XGO">XGO - Galón</option>
                        <option value="XGP">XGP - Galón</option>
                        <option value="XGQ">XGQ - Galón</option>
                        <option value="XGR">XGR - Galón</option>
                        <option value="XGS">XGS - Galón</option>
                        <option value="XGT">XGT - Galón</option>
                        <option value="XGU">XGU - Galón</option>
                        <option value="XGV">XGV - Galón</option>
                        <option value="XGW">XGW - Galón</option>
                        <option value="XGX">XGX - Galón</option>
                        <option value="XGY">XGY - Galón</option>
                        <option value="XGZ">XGZ - Galón</option>
                        <option value="XHA">XHA - Hora</option>
                        <option value="XHB">XHB - Hora</option>
                        <option value="XHC">XHC - Hora</option>
                        <option value="XHD">XHD - Hora</option>
                        <option value="XHE">XHE - Hora</option>
                        <option value="XHF">XHF - Hora</option>
                        <option value="XHG">XHG - Hora</option>
                        <option value="XHH">XHH - Hora</option>
                        <option value="XHI">XHI - Hora</option>
                        <option value="XHJ">XHJ - Hora</option>
                        <option value="XHK">XHK - Hora</option>
                        <option value="XHL">XHL - Hora</option>
                        <option value="XHM">XHM - Hora</option>
                        <option value="XHN">XHN - Hora</option>
                        <option value="XHO">XHO - Hora</option>
                        <option value="XHP">XHP - Hora</option>
                        <option value="XHQ">XHQ - Hora</option>
                        <option value="XHR">XHR - Hora</option>
                        <option value="XHS">XHS - Hora</option>
                        <option value="XHT">XHT - Hora</option>
                        <option value="XHU">XHU - Hora</option>
                        <option value="XHV">XHV - Hora</option>
                        <option value="XHW">XHW - Hora</option>
                        <option value="XHX">XHX - Hora</option>
                        <option value="XHY">XHY - Hora</option>
                        <option value="XHZ">XHZ - Hora</option>
                        <option value="XIA">XIA - Juego</option>
                        <option value="XIB">XIB - Juego</option>
                        <option value="XIC">XIC - Juego</option>
                        <option value="XID">XID - Juego</option>
                        <option value="XIE">XIE - Juego</option>
                        <option value="XIF">XIF - Juego</option>
                        <option value="XIG">XIG - Juego</option>
                        <option value="XIH">XIH - Juego</option>
                        <option value="XII">XII - Juego</option>
                        <option value="XIJ">XIJ - Juego</option>
                        <option value="XIK">XIK - Juego</option>
                        <option value="XIL">XIL - Juego</option>
                        <option value="XIM">XIM - Juego</option>
                        <option value="XIN">XIN - Juego</option>
                        <option value="XIO">XIO - Juego</option>
                        <option value="XIP">XIP - Juego</option>
                        <option value="XIQ">XIQ - Juego</option>
                        <option value="XIR">XIR - Juego</option>
                        <option value="XIS">XIS - Juego</option>
                        <option value="XIT">XIT - Juego</option>
                        <option value="XIU">XIU - Juego</option>
                        <option value="XIV">XIV - Juego</option>
                        <option value="XIW">XIW - Juego</option>
                        <option value="XIX">XIX - Juego</option>
                        <option value="XIY">XIY - Juego</option>
                        <option value="XIZ">XIZ - Juego</option>
                        <option value="XJA">XJA - Kilo</option>
                        <option value="XJB">XJB - Kilo</option>
                        <option value="XJC">XJC - Kilo</option>
                        <option value="XJD">XJD - Kilo</option>
                        <option value="XJE">XJE - Kilo</option>
                        <option value="XJF">XJF - Kilo</option>
                        <option value="XJG">XJG - Kilo</option>
                        <option value="XJH">XJH - Kilo</option>
                        <option value="XJI">XJI - Kilo</option>
                        <option value="XJJ">XJJ - Kilo</option>
                        <option value="XJK">XJK - Kilo</option>
                        <option value="XJL">XJL - Kilo</option>
                        <option value="XJM">XJM - Kilo</option>
                        <option value="XJN">XJN - Kilo</option>
                        <option value="XJO">XJO - Kilo</option>
                        <option value="XJP">XJP - Kilo</option>
                        <option value="XJQ">XJQ - Kilo</option>
                        <option value="XJR">XJR - Kilo</option>
                        <option value="XJS">XJS - Kilo</option>
                        <option value="XJT">XJT - Kilo</option>
                        <option value="XJU">XJU - Kilo</option>
                        <option value="XJV">XJV - Kilo</option>
                        <option value="XJW">XJW - Kilo</option>
                        <option value="XJX">XJX - Kilo</option>
                        <option value="XJY">XJY - Kilo</option>
                        <option value="XJZ">XJZ - Kilo</option>
                        <option value="XKA">XKA - Litro</option>
                        <option value="XKB">XKB - Litro</option>
                        <option value="XKC">XKC - Litro</option>
                        <option value="XKD">XKD - Litro</option>
                        <option value="XKE">XKE - Litro</option>
                        <option value="XKF">XKF - Litro</option>
                        <option value="XKG">XKG - Litro</option>
                        <option value="XKH">XKH - Litro</option>
                        <option value="XKI">XKI - Litro</option>
                        <option value="XKJ">XKJ - Litro</option>
                        <option value="XKK">XKK - Litro</option>
                        <option value="XKL">XKL - Litro</option>
                        <option value="XKM">XKM - Litro</option>
                        <option value="XKN">XKN - Litro</option>
                        <option value="XKO">XKO - Litro</option>
                        <option value="XKP">XKP - Litro</option>
                        <option value="XKQ">XKQ - Litro</option>
                        <option value="XKR">XKR - Litro</option>
                        <option value="XKS">XKS - Litro</option>
                        <option value="XKT">XKT - Litro</option>
                        <option value="XKU">XKU - Litro</option>
                        <option value="XKV">XKV - Litro</option>
                        <option value="XKW">XKW - Litro</option>
                        <option value="XKX">XKX - Litro</option>
                        <option value="XKY">XKY - Litro</option>
                        <option value="XKZ">XKZ - Litro</option>
                        <option value="XLA">XLA - Lote</option>
                        <option value="XLB">XLB - Lote</option>
                        <option value="XLC">XLC - Lote</option>
                        <option value="XLD">XLD - Lote</option>
                        <option value="XLE">XLE - Lote</option>
                        <option value="XLF">XLF - Lote</option>
                        <option value="XLG">XLG - Lote</option>
                        <option value="XLH">XLH - Lote</option>
                        <option value="XLI">XLI - Lote</option>
                        <option value="XLJ">XLJ - Lote</option>
                        <option value="XLK">XLK - Lote</option>
                        <option value="XLL">XLL - Lote</option>
                        <option value="XLM">XLM - Lote</option>
                        <option value="XLN">XLN - Lote</option>
                        <option value="XLO">XLO - Lote</option>
                        <option value="XLP">XLP - Lote</option>
                        <option value="XLQ">XLQ - Lote</option>
                        <option value="XLR">XLR - Lote</option>
                        <option value="XLS">XLS - Lote</option>
                        <option value="XLT">XLT - Lote</option>
                        <option value="XLU">XLU - Lote</option>
                        <option value="XLV">XLV - Lote</option>
                        <option value="XLW">XLW - Lote</option>
                        <option value="XLX">XLX - Lote</option>
                        <option value="XLY">XLY - Lote</option>
                        <option value="XLZ">XLZ - Lote</option>
                        <option value="XMA">XMA - Metro</option>
                        <option value="XMB">XMB - Metro</option>
                        <option value="XMC">XMC - Metro</option>
                        <option value="XMD">XMD - Metro</option>
                        <option value="XME">XME - Metro</option>
                        <option value="XMF">XMF - Metro</option>
                        <option value="XMG">XMG - Metro</option>
                        <option value="XMH">XMH - Metro</option>
                        <option value="XMI">XMI - Metro</option>
                        <option value="XMJ">XMJ - Metro</option>
                        <option value="XMK">XMK - Metro</option>
                        <option value="XML">XML - Metro</option>
                        <option value="XMM">XMM - Metro</option>
                        <option value="XMN">XMN - Metro</option>
                        <option value="XMO">XMO - Metro</option>
                        <option value="XMP">XMP - Metro</option>
                        <option value="XMQ">XMQ - Metro</option>
                        <option value="XMR">XMR - Metro</option>
                        <option value="XMS">XMS - Metro</option>
                        <option value="XMT">XMT - Metro</option>
                        <option value="XMU">XMU - Metro</option>
                        <option value="XMV">XMV - Metro</option>
                        <option value="XMW">XMW - Metro</option>
                        <option value="XMX">XMX - Metro</option>
                        <option value="XMY">XMY - Metro</option>
                        <option value="XMZ">XMZ - Metro</option>
                        <option value="XNA">XNA - Miligramo</option>
                        <option value="XNB">XNB - Miligramo</option>
                        <option value="XNC">XNC - Miligramo</option>
                        <option value="XND">XND - Miligramo</option>
                        <option value="XNE">XNE - Miligramo</option>
                        <option value="XNF">XNF - Miligramo</option>
                        <option value="XNG">XNG - Miligramo</option>
                        <option value="XNH">XNH - Miligramo</option>
                        <option value="XNI">XNI - Miligramo</option>
                        <option value="XNJ">XNJ - Miligramo</option>
                        <option value="XNK">XNK - Miligramo</option>
                        <option value="XNL">XNL - Miligramo</option>
                        <option value="XNM">XNM - Miligramo</option>
                        <option value="XNN">XNN - Miligramo</option>
                        <option value="XNO">XNO - Miligramo</option>
                        <option value="XNP">XNP - Miligramo</option>
                        <option value="XNQ">XNQ - Miligramo</option>
                        <option value="XNR">XNR - Miligramo</option>
                        <option value="XNS">XNS - Miligramo</option>
                        <option value="XNT">XNT - Miligramo</option>
                        <option value="XNU">XNU - Miligramo</option>
                        <option value="XNV">XNV - Miligramo</option>
                        <option value="XNW">XNW - Miligramo</option>
                        <option value="XNX">XNX - Miligramo</option>
                        <option value="XNY">XNY - Miligramo</option>
                        <option value="XNZ">XNZ - Miligramo</option>
                        <option value="XOA">XOA - Mililitro</option>
                        <option value="XOB">XOB - Mililitro</option>
                        <option value="XOC">XOC - Mililitro</option>
                        <option value="XOD">XOD - Mililitro</option>
                        <option value="XOE">XOE - Mililitro</option>
                        <option value="XOF">XOF - Mililitro</option>
                        <option value="XOG">XOG - Mililitro</option>
                        <option value="XOH">XOH - Mililitro</option>
                        <option value="XOI">XOI - Mililitro</option>
                        <option value="XOJ">XOJ - Mililitro</option>
                        <option value="XOK">XOK - Mililitro</option>
                        <option value="XOL">XOL - Mililitro</option>
                        <option value="XOM">XOM - Mililitro</option>
                        <option value="XON">XON - Mililitro</option>
                        <option value="XOO">XOO - Mililitro</option>
                        <option value="XOP">XOP - Mililitro</option>
                        <option value="XOQ">XOQ - Mililitro</option>
                        <option value="XOR">XOR - Mililitro</option>
                        <option value="XOS">XOS - Mililitro</option>
                        <option value="XOT">XOT - Mililitro</option>
                        <option value="XOU">XOU - Mililitro</option>
                        <option value="XOV">XOV - Mililitro</option>
                        <option value="XOW">XOW - Mililitro</option>
                        <option value="XOX">XOX - Mililitro</option>
                        <option value="XOY">XOY - Mililitro</option>
                        <option value="XOZ">XOZ - Mililitro</option>
                        <option value="XPA">XPA - Paquete</option>
                        <option value="XPB">XPB - Paquete</option>
                        <option value="XPC">XPC - Paquete</option>
                        <option value="XPD">XPD - Paquete</option>
                        <option value="XPE">XPE - Paquete</option>
                        <option value="XPF">XPF - Paquete</option>
                        <option value="XPG">XPG - Paquete</option>
                        <option value="XPH">XPH - Paquete</option>
                        <option value="XPI">XPI - Paquete</option>
                        <option value="XPJ">XPJ - Paquete</option>
                        <option value="XPK">XPK - Paquete</option>
                        <option value="XPL">XPL - Paquete</option>
                        <option value="XPM">XPM - Paquete</option>
                        <option value="XPN">XPN - Paquete</option>
                        <option value="XPO">XPO - Paquete</option>
                        <option value="XPP">XPP - Paquete</option>
                        <option value="XPQ">XPQ - Paquete</option>
                        <option value="XPR">XPR - Paquete</option>
                        <option value="XPS">XPS - Paquete</option>
                        <option value="XPT">XPT - Paquete</option>
                        <option value="XPU">XPU - Paquete</option>
                        <option value="XPV">XPV - Paquete</option>
                        <option value="XPW">XPW - Paquete</option>
                        <option value="XPX">XPX - Paquete</option>
                        <option value="XPY">XPY - Paquete</option>
                        <option value="XPZ">XPZ - Paquete</option>
                        <option value="XQA">XQA - Pieza</option>
                        <option value="XQB">XQB - Pieza</option>
                        <option value="XQC">XQC - Pieza</option>
                        <option value="XQD">XQD - Pieza</option>
                        <option value="XQE">XQE - Pieza</option>
                        <option value="XQF">XQF - Pieza</option>
                        <option value="XQG">XQG - Pieza</option>
                        <option value="XQH">XQH - Pieza</option>
                        <option value="XQI">XQI - Pieza</option>
                        <option value="XQJ">XQJ - Pieza</option>
                        <option value="XQK">XQK - Pieza</option>
                        <option value="XQL">XQL - Pieza</option>
                        <option value="XQM">XQM - Pieza</option>
                        <option value="XQN">XQN - Pieza</option>
                        <option value="XQO">XQO - Pieza</option>
                        <option value="XQP">XQP - Pieza</option>
                        <option value="XQQ">XQQ - Pieza</option>
                        <option value="XQR">XQR - Pieza</option>
                        <option value="XQS">XQS - Pieza</option>
                        <option value="XQT">XQT - Pieza</option>
                        <option value="XQU">XQU - Pieza</option>
                        <option value="XQV">XQV - Pieza</option>
                        <option value="XQW">XQW - Pieza</option>
                        <option value="XQX">XQX - Pieza</option>
                        <option value="XQY">XQY - Pieza</option>
                        <option value="XQZ">XQZ - Pieza</option>
                        <option value="XRA">XRA - Rollo</option>
                        <option value="XRB">XRB - Rollo</option>
                        <option value="XRC">XRC - Rollo</option>
                        <option value="XRD">XRD - Rollo</option>
                        <option value="XRE">XRE - Rollo</option>
                        <option value="XRF">XRF - Rollo</option>
                        <option value="XRG">XRG - Rollo</option>
                        <option value="XRH">XRH - Rollo</option>
                        <option value="XRI">XRI - Rollo</option>
                        <option value="XRJ">XRJ - Rollo</option>
                        <option value="XRK">XRK - Rollo</option>
                        <option value="XRL">XRL - Rollo</option>
                        <option value="XRM">XRM - Rollo</option>
                        <option value="XRN">XRN - Rollo</option>
                        <option value="XRO">XRO - Rollo</option>
                        <option value="XRP">XRP - Rollo</option>
                        <option value="XRQ">XRQ - Rollo</option>
                        <option value="XRR">XRR - Rollo</option>
                        <option value="XRS">XRS - Rollo</option>
                        <option value="XRT">XRT - Rollo</option>
                        <option value="XRU">XRU - Rollo</option>
                        <option value="XRV">XRV - Rollo</option>
                        <option value="XRW">XRW - Rollo</option>
                        <option value="XRX">XRX - Rollo</option>
                        <option value="XRY">XRY - Rollo</option>
                        <option value="XRZ">XRZ - Rollo</option>
                        <option value="XSA">XSA - Saco</option>
                        <option value="XSB">XSB - Saco</option>
                        <option value="XSC">XSC - Saco</option>
                        <option value="XSD">XSD - Saco</option>
                        <option value="XSE">XSE - Saco</option>
                        <option value="XSF">XSF - Saco</option>
                        <option value="XSG">XSG - Saco</option>
                        <option value="XSH">XSH - Saco</option>
                        <option value="XSI">XSI - Saco</option>
                        <option value="XSJ">XSJ - Saco</option>
                        <option value="XSK">XSK - Saco</option>
                        <option value="XSL">XSL - Saco</option>
                        <option value="XSM">XSM - Saco</option>
                        <option value="XSN">XSN - Saco</option>
                        <option value="XSO">XSO - Saco</option>
                        <option value="XSP">XSP - Saco</option>
                        <option value="XSQ">XSQ - Saco</option>
                        <option value="XSR">XSR - Saco</option>
                        <option value="XSS">XSS - Saco</option>
                        <option value="XST">XST - Saco</option>
                        <option value="XSU">XSU - Saco</option>
                        <option value="XSV">XSV - Saco</option>
                        <option value="XSW">XSW - Saco</option>
                        <option value="XSX">XSX - Saco</option>
                        <option value="XSY">XSY - Saco</option>
                        <option value="XSZ">XSZ - Saco</option>
                        <option value="XTA">XTA - Tanque</option>
                        <option value="XTB">XTB - Tanque</option>
                        <option value="XTC">XTC - Tanque</option>
                        <option value="XTD">XTD - Tanque</option>
                        <option value="XTE">XTE - Tanque</option>
                        <option value="XTF">XTF - Tanque</option>
                        <option value="XTG">XTG - Tanque</option>
                        <option value="XTH">XTH - Tanque</option>
                        <option value="XTI">XTI - Tanque</option>
                        <option value="XTJ">XTJ - Tanque</option>
                        <option value="XTK">XTK - Tanque</option>
                        <option value="XTL">XTL - Tanque</option>
                        <option value="XTM">XTM - Tanque</option>
                        <option value="XTN">XTN - Tanque</option>
                        <option value="XTO">XTO - Tanque</option>
                        <option value="XTP">XTP - Tanque</option>
                        <option value="XTQ">XTQ - Tanque</option>
                        <option value="XTR">XTR - Tanque</option>
                        <option value="XTS">XTS - Tanque</option>
                        <option value="XTT">XTT - Tanque</option>
                        <option value="XTU">XTU - Tanque</option>
                        <option value="XTV">XTV - Tanque</option>
                        <option value="XTW">XTW - Tanque</option>
                        <option value="XTX">XTX - Tanque</option>
                        <option value="XTY">XTY - Tanque</option>
                        <option value="XTZ">XTZ - Tanque</option>
                        <option value="XUA">XUA - Tonelada</option>
                        <option value="XUB">XUB - Tonelada</option>
                        <option value="XUC">XUC - Tonelada</option>
                        <option value="XUD">XUD - Tonelada</option>
                        <option value="XUE">XUE - Tonelada</option>
                        <option value="XUF">XUF - Tonelada</option>
                        <option value="XUG">XUG - Tonelada</option>
                        <option value="XUH">XUH - Tonelada</option>
                        <option value="XUI">XUI - Tonelada</option>
                        <option value="XUJ">XUJ - Tonelada</option>
                        <option value="XUK">XUK - Tonelada</option>
                        <option value="XUL">XUL - Tonelada</option>
                        <option value="XUM">XUM - Tonelada</option>
                        <option value="XUN">XUN - Tonelada</option>
                        <option value="XUO">XUO - Tonelada</option>
                        <option value="XUP">XUP - Tonelada</option>
                        <option value="XUQ">XUQ - Tonelada</option>
                        <option value="XUR">XUR - Tonelada</option>
                        <option value="XUS">XUS - Tonelada</option>
                        <option value="XUT">XUT - Tonelada</option>
                        <option value="XUU">XUU - Tonelada</option>
                        <option value="XUV">XUV - Tonelada</option>
                        <option value="XUW">XUW - Tonelada</option>
                        <option value="XUX">XUX - Tonelada</option>
                        <option value="XUY">XUY - Tonelada</option>
                        <option value="XUZ">XUZ - Tonelada</option>
                        <option value="XVA">XVA - Unidad</option>
                        <option value="XVB">XVB - Unidad</option>
                        <option value="XVC">XVC - Unidad</option>
                        <option value="XVD">XVD - Unidad</option>
                        <option value="XVE">XVE - Unidad</option>
                        <option value="XVF">XVF - Unidad</option>
                        <option value="XVG">XVG - Unidad</option>
                        <option value="XVH">XVH - Unidad</option>
                        <option value="XVI">XVI - Unidad</option>
                        <option value="XVJ">XVJ - Unidad</option>
                        <option value="XVK">XVK - Unidad</option>
                        <option value="XVL">XVL - Unidad</option>
                        <option value="XVM">XVM - Unidad</option>
                        <option value="XVN">XVN - Unidad</option>
                        <option value="XVO">XVO - Unidad</option>
                        <option value="XVP">XVP - Unidad</option>
                        <option value="XVQ">XVQ - Unidad</option>
                        <option value="XVR">XVR - Unidad</option>
                        <option value="XVS">XVS - Unidad</option>
                        <option value="XVT">XVT - Unidad</option>
                        <option value="XVU">XVU - Unidad</option>
                        <option value="XVV">XVV - Unidad</option>
                        <option value="XVW">XVW - Unidad</option>
                        <option value="XVX">XVX - Unidad</option>
                        <option value="XVY">XVY - Unidad</option>
                        <option value="XVZ">XVZ - Unidad</option>
                        <option value="99">99 - Otra unidad</option>
                      </optgroup>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Unidad</label>
                    <input
                      type="text"
                      value={item.Unidad}
                      onChange={(e) => handleItemChange(index, 'Unidad', e.target.value)}
                      placeholder="Servicio"
                    />
                  </div>
                </div>
              </div>
            ))}
            
            <button
              type="button"
              onClick={addItem}
              style={{
                backgroundColor: 'var(--primary-color)',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer',
                marginBottom: '1rem'
              }}
            >
              + Agregar Item
            </button>
          </div>

          {/* Datos adicionales */}
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--primary-color)' }}>
              Datos Adicionales
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label htmlFor="folio">Folio (opcional)</label>
                <input
                  type="text"
                  id="folio"
                  name="folio"
                  value={formData.folio}
                  onChange={handleInputChange}
                  placeholder="123"
                />
              </div>
              <div className="form-group">
                <label htmlFor="formaPago">Forma de Pago</label>
                <select
                  id="formaPago"
                  name="formaPago"
                  value={formData.formaPago}
                  onChange={handleInputChange}
                >
                  <option value="01">01 - Efectivo</option>
                  <option value="02">02 - Cheque nominativo</option>
                  <option value="03">03 - Transferencia electrónica de fondos</option>
                  <option value="04">04 - Tarjeta de crédito</option>
                  <option value="05">05 - Tarjeta de débito</option>
                  <option value="06">06 - Dinero electrónico</option>
                  <option value="08">08 - Vales de despensa</option>
                  <option value="12">12 - Dación en pago</option>
                  <option value="13">13 - Pago por subrogación</option>
                  <option value="14">14 - Pago por consignación</option>
                  <option value="15">15 - Condonación</option>
                  <option value="17">17 - Compensación</option>
                  <option value="23">23 - Novación</option>
                  <option value="24">24 - Confusión</option>
                  <option value="25">25 - Remisión de deuda</option>
                  <option value="26">26 - Prescripción</option>
                  <option value="27">27 - A satisfacción del acreedor</option>
                  <option value="28">28 - Tarjeta de servicio</option>
                  <option value="29">29 - Tarjeta de almacén departamental</option>
                  <option value="30">30 - Aplicación de anticipos</option>
                  <option value="31">31 - Intermediario pagos</option>
                  <option value="99">99 - Por definir</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="MetodoPago">Método de Pago</label>
                <select
                  id="MetodoPago"
                  name="MetodoPago"
                  value={formData.MetodoPago}
                  onChange={handleInputChange}
                >
                  <option value="PUE">PUE - Pago en una sola exhibición</option>
                  <option value="PPD">PPD - Pago en parcialidades</option>
                </select>
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div style={{ 
            border: '1px solid var(--gray-200)', 
            borderRadius: '4px', 
            padding: '1rem', 
            marginBottom: '2rem',
            backgroundColor: 'var(--gray-50)'
          }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Resumen de Totales</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <span style={{ color: 'var(--gray-600)' }}>Subtotal:</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                  ${totals.subtotal.toFixed(2)}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--gray-600)' }}>IVA (16%):</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                  ${totals.iva.toFixed(2)}
                </div>
              </div>
              <div>
                <span style={{ color: 'var(--gray-600)' }}>Total:</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                  ${totals.total.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Generando y Timbrando...' : 'Generar y Timbrar Factura'}
          </button>
        </form>

        {result && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--gray-50)', borderRadius: '4px' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Factura Generada Exitosamente</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <p><strong>UUID:</strong> {result.stampData?.uuid || 'N/A'}</p>
              <p><strong>Folio Fiscal:</strong> {result.stampData?.uuid || 'N/A'}</p>
              <p><strong>Estado:</strong> {result.stampData?.status || 'Timbrado'}</p>
              <p><strong>Fecha Timbrado:</strong> {result.stampData?.fechaTimbrado || 'N/A'}</p>
              <p><strong>Total:</strong> ${result.invoice?.Total || 'N/A'}</p>
              <p><strong>Cliente:</strong> {result.invoice?.Receptor?.Nombre || 'N/A'}</p>
            </div>
            
            {result.xml && (
              <div style={{ marginTop: '1rem' }}>
                <h4>XML del CFDI:</h4>
                <textarea
                  readOnly
                  value={result.xml}
                  style={{ 
                    width: '100%', 
                    height: '100px', 
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    backgroundColor: 'white',
                    border: '1px solid var(--gray-200)'
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
