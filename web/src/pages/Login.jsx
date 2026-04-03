import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Flame, ShieldAlert, Loader2 } from 'lucide-react'; // Ganti User ke Mail
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/useAuthStore';
import { customFetch } from '@/lib/api';

export default function Login() {
  const [email, setEmail] = useState(''); // Supabase menggunakan Email
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); // State untuk loading
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
        throw new Error(data.detail || 'Login gagal.');
      }

      // Store in memory (Zustand) securely! No localStorage!
      setAuth(data.user, data.csrf_token);

      // Redirect to dashboard
      navigate('/');
      
    } catch (error) {
      alert('Login Gagal: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#0a0a0b]">
      
      {/* Background Decor: Blueprint / Grid Effect */}
      <div 
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, #f97316 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}
      />
      
      {/* Background Decor: Fire Glows */}
      <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-orange-600/10 blur-[120px] rounded-full" />
      <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-orange-900/10 blur-[120px] rounded-full" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-md px-4">
        
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-orange-500/10 border border-orange-500/20 rounded-2xl flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(249,115,22,0.15)]">
            <Flame className="w-10 h-10 text-orange-500" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Agni<span className="text-orange-500">Raksha</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">Intelligent Indoor Fire Detection</p>
        </div>

        {/* Login Card */}
        <div className="bg-[#121214]/80 backdrop-blur-xl border border-white/5 p-8 rounded-[2rem] shadow-2xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">Selamat Datang</h2>
            <p className="text-gray-400 text-xs">Silakan masuk untuk mengakses dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-gray-500 font-bold ml-1">Email Address</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 h-4 text-gray-500 group-focus-within:text-orange-500 transition-colors" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-gray-600 outline-none focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 transition-all"
                  placeholder="admin@agniraksha.com"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] uppercase tracking-widest text-gray-500 font-bold ml-1">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 h-4 text-gray-500 group-focus-within:text-orange-500 transition-colors" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-gray-600 outline-none focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/10 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Remember & Forgot */}
            <div className="flex items-center justify-between text-[11px] px-1">
              <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
                <input type="checkbox" className="accent-orange-500 rounded border-none bg-white/5" />
                Ingat saya
              </label>
              <button type="button" className="text-orange-500 hover:text-orange-400 font-medium">Lupa sandi?</button>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-bold rounded-xl shadow-[0_4px_15px_rgba(249,115,22,0.3)] border-none transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  Masuk Dashboard
                  <ShieldAlert className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {/* Footer Card */}
          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-gray-500 text-xs">
              Belum punya akun? <button className="text-orange-500 font-bold hover:underline">Hubungi Admin</button>
            </p>
          </div>
        </div>

        {/* System Footer */}
        <p className="mt-8 text-center text-[10px] text-gray-600 uppercase tracking-[0.2em]">
          &copy; 2026 AgniRaksha Systems - PBL PNJ
        </p>
      </div>
    </div>
  );
}