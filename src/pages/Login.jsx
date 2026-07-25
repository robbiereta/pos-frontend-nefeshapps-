import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../services/api';
import Button from '../components/ui/Button';
import { useToast } from '../components/ui/Toast.jsx';
import '../styles/login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authService.login(email, password);
      toast.success('Sesión iniciada correctamente');
      window.location.href = '/dashboard';
    } catch (err) {
      toast.error(err.message || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <aside className="login-aside" aria-hidden>
        <div className="login-aside__brand">
          <span className="login-aside__mark">N</span>
          <span>Nefesh</span>
        </div>
        <div className="login-aside__copy">
          <h2>Facturación electrónica, sin fricción.</h2>
          <p>Timbra CFDI 4.0 desde tu punto de venta, controla cajas y consulta facturas — todo en un mismo lugar.</p>
        </div>
        <ul className="login-aside__bullets">
          <li>✓ Timbrado en segundos</li>
          <li>✓ Clientes y productos sincronizados</li>
          <li>✓ Cortes de caja automáticos</li>
        </ul>
      </aside>

      <main className="login-main">
        <div className="login-card">
          <h1 className="login-card__title">Bienvenido de vuelta</h1>
          <p className="login-card__subtitle">Inicia sesión para continuar</p>

          <form onSubmit={handleSubmit} className="col" style={{ gap: 16 }}>
            <div>
              <label className="field" htmlFor="email">Correo electrónico</label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@empresa.com"
                required
                autoComplete="email"
              />
            </div>
            <div>
              <label className="field" htmlFor="password">Contraseña</label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              Entrar
            </Button>
          </form>

          <p className="login-foot">
            ¿No tienes cuenta? <Link to="/register">Crear cuenta</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
