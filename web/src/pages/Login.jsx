import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { customFetch } from '@/lib/api';
import { toast } from 'sonner';
import EmberCanvas from '@landing/components/ui/EmberCanvas';
import { useReducedMotion } from '@landing/hooks/useReducedMotion';
import IfritLogo from '@/components/ui/IfritLogo';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const reducedMotion = useReducedMotion();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const response = await customFetch(`/api/v1/auth/login`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Invalid credentials. Try again.');
      }

      setAuth(data.user, data.csrf_token);
      toast.success('Signed in', {
        description: `Welcome back, ${data.user.email.split('@')[0]}.`
      });

      navigate('/dashboard');
    } catch (error) {
      toast.error('Sign in failed', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // Motion config respecting reduced-motion
  const dur = reducedMotion ? 0 : 0.7;
  const ease = [0.16, 1, 0.3, 1]; // ease-out-expo from design tokens
  const stagger = reducedMotion ? 0 : 0.12;

  return (
    <section
      className="relative section-dark min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Shared EmberCanvas from landing - visual continuity */}
      <EmberCanvas />

      {/* Radial glow - same approach as Hero */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 70% 60% at 50% 60%, oklch(0.28 0.14 25 / 0.35), transparent 70%),
            radial-gradient(ellipse 50% 40% at 80% 80%, oklch(0.30 0.10 35 / 0.08), transparent 60%)
          `,
        }}
        aria-hidden="true"
      />

      {/* Top vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, oklch(0.08 0.01 25 / 0.7) 0%, transparent 50%)',
        }}
        aria-hidden="true"
      />

      {/* Content */}
      <motion.div
        className="relative z-10 w-full px-6 py-20"
        style={{ maxWidth: '26rem' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: dur, ease }}
      >
        {/* Brand mark */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: reducedMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur, ease }}
        >
          {/* Shield Logo */}
          <div className="flex justify-center mb-6">
            <IfritLogo
              size={56}
              className="text-ifrit-red"
              style={{ filter: 'drop-shadow(0 0 16px oklch(0.45 0.2 25 / 0.35))' }}
            />
          </div>
          <Link
            to="/"
            className="font-display text-4xl md:text-5xl font-black tracking-tight text-text-on-dark inline-block"
            style={{ letterSpacing: '-0.04em' }}
          >
            IF<span className="text-ifrit-red">R</span>IT
          </Link>
          <p
            className="font-body text-text-on-dark-muted mt-3"
            style={{ fontSize: 'var(--text-sm)' }}
          >
            Sign in to the command center
          </p>
        </motion.div>

        {/* Form */}
        <motion.form
          onSubmit={handleLogin}
          initial={{ opacity: 0, y: reducedMotion ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: dur, ease, delay: stagger }}
        >
          <fieldset disabled={loading} className="space-y-6">
            {/* Email */}
            <div>
              <label
                htmlFor="login-email"
                className="block font-body text-text-on-dark-muted mb-2"
                style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full font-body rounded-[var(--radius-md)] px-4 py-3 text-text-on-dark outline-none transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-quart)]"
                style={{
                  fontSize: 'var(--text-base)',
                  backgroundColor: 'oklch(0.15 0.012 25)',
                  border: '1px solid oklch(0.24 0.01 25)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'oklch(0.45 0.18 25)';
                  e.target.style.backgroundColor = 'oklch(0.17 0.015 25)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'oklch(0.24 0.01 25)';
                  e.target.style.backgroundColor = 'oklch(0.15 0.012 25)';
                }}
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="login-password"
                className="block font-body text-text-on-dark-muted mb-2"
                style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full font-body rounded-[var(--radius-md)] px-4 py-3 text-text-on-dark outline-none transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-quart)]"
                style={{
                  fontSize: 'var(--text-base)',
                  backgroundColor: 'oklch(0.15 0.012 25)',
                  border: '1px solid oklch(0.24 0.01 25)',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'oklch(0.45 0.18 25)';
                  e.target.style.backgroundColor = 'oklch(0.17 0.015 25)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = 'oklch(0.24 0.01 25)';
                  e.target.style.backgroundColor = 'oklch(0.15 0.012 25)';
                }}
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full font-display font-semibold tracking-tight rounded-[var(--radius-md)] cursor-pointer select-none bg-ifrit-red text-white hover:bg-ifrit-red-light active:bg-ifrit-red-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-[var(--duration-fast)] ease-[var(--ease-out-quart)] focus-visible:ring-2 focus-visible:ring-ifrit-red focus-visible:ring-offset-2 flex items-center justify-center gap-2"
              style={{ padding: '0.875rem 2rem', fontSize: 'var(--text-base)' }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </fieldset>
        </motion.form>

        {/* Footer note */}
        <motion.p
          className="text-center mt-10 font-body text-text-on-dark-muted"
          style={{ fontSize: 'var(--text-xs)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ duration: dur, delay: stagger * 3 }}
        >
          Protected by IFRIT Core. Authorized personnel only.
        </motion.p>
      </motion.div>
    </section>
  );
}