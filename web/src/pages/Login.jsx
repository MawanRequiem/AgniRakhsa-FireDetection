import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Flame, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/useAuthStore';
import { customFetch } from '@/lib/api';
import { toast } from 'sonner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

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
        throw new Error(data.detail || 'Authentication failed.');
      }

      setAuth(data.user, data.csrf_token);
      
      // UPDATE: Redirect langsung ke dashboard setelah sukses login
      navigate('/dashboard');
      
    } catch (error) {
      toast.error('Login failed', {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden" style={{ backgroundColor: 'var(--ifrit-bg-secondary)' }}>
      
      {/* Subtle grid background */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(var(--ifrit-border) 1px, transparent 1px), linear-gradient(90deg, var(--ifrit-border) 1px, transparent 1px)`,
          backgroundSize: '48px 48px'
        }}
      />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-sm px-4">
        
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-8">
          <div 
            className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
            style={{ backgroundColor: 'var(--ifrit-brand)' }}
          >
            <Flame className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--ifrit-text-primary)' }}>
            IFRIT
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ifrit-text-muted)' }}>AI-Powered Fire Detection</p>
        </div>

        {/* Login Card */}
        <div 
          className="p-8 rounded-xl border"
          style={{ 
            backgroundColor: 'var(--ifrit-bg-primary)', 
            borderColor: 'var(--ifrit-border)',
          }}
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--ifrit-text-primary)' }}>Sign in</h2>
            <p className="text-sm mt-1" style={{ color: 'var(--ifrit-text-muted)' }}>Access your monitoring dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Input */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium" style={{ color: 'var(--ifrit-text-secondary)' }}>Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="w-4 h-4" style={{ color: 'var(--ifrit-text-muted)' }} />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg py-2.5 pl-10 pr-4 text-sm outline-none transition-colors border"
                  style={{ 
                    backgroundColor: 'var(--ifrit-bg-secondary)', 
                    borderColor: 'var(--ifrit-border)',
                    color: 'var(--ifrit-text-primary)',
                  }}
                  placeholder="admin@ifrit.io"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium" style={{ color: 'var(--ifrit-text-secondary)' }}>Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4" style={{ color: 'var(--ifrit-text-muted)' }} />
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg py-2.5 pl-10 pr-4 text-sm outline-none transition-colors border"
                  style={{ 
                    backgroundColor: 'var(--ifrit-bg-secondary)', 
                    borderColor: 'var(--ifrit-border)',
                    color: 'var(--ifrit-text-primary)',
                  }}
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between text-xs px-0.5">
              <label className="flex items-center gap-2 cursor-pointer" style={{ color: 'var(--ifrit-text-muted)' }}>
                <input type="checkbox" className="rounded border" style={{ accentColor: 'var(--ifrit-brand)' }} />
                Remember me
              </label>
              <button type="button" className="font-medium" style={{ color: 'var(--ifrit-brand)' }}>Forgot password?</button>
            </div>

            <Button 
              type="submit"
              disabled={loading}
              className="w-full h-11 text-white font-semibold rounded-lg border-none transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
              style={{ backgroundColor: 'var(--ifrit-brand)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--ifrit-brand-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--ifrit-brand)'}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          {/* Footer Card */}
          <div className="mt-6 pt-5 border-t text-center" style={{ borderColor: 'var(--ifrit-border)' }}>
            <p className="text-xs" style={{ color: 'var(--ifrit-text-muted)' }}>
              Need access? <button className="font-medium" style={{ color: 'var(--ifrit-brand)' }}>Contact your administrator</button>
            </p>
          </div>
        </div>

        {/* System Footer */}
        <p className="mt-6 text-center text-[10px] tracking-wide" style={{ color: 'var(--ifrit-text-muted)' }}>
          &copy; 2026 IFRIT Fire Detection Systems
        </p>
      </div>
    </div>
  );
}