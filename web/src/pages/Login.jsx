import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { customFetch } from '@/lib/api';

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
        throw new Error(data.detail || 'Login gagal.');
      }

      setAuth(data.user, data.csrf_token);
      navigate('/dashboard'); // Mengikuti logika desain baru ke dashboard
      
    } catch (error) {
      alert('Login Gagal: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-[#8e0e0e] to-[#d35400] p-4 font-sans">
      {/* Login Card */}
      <div className="bg-white p-10 rounded-xl shadow-[0_10px_25px_rgba(0,0,0,0.2)] w-full max-w-[400px]">
        
        <form onSubmit={handleLogin} className="w-full">
          <h2 className="text-center text-[#8e0e0e] mb-2 text-[28px] font-bold">Selamat Datang</h2>
          <p className="text-center text-[#777] text-sm mb-[30px]">Silakan masuk ke akun Anda</p>

          {/* Input Email / Username */}
          <div className="relative mb-[30px] w-full">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="peer w-full py-2.5 text-base text-[#333] border-none border-b-2 border-[#ddd] outline-none bg-transparent transition-all focus:border-transparent"
            />
            <label className="absolute top-2.5 left-0 text-[#999] pointer-events-none transition-all duration-300 ease-in-out peer-focus:-top-[15px] peer-focus:text-xs peer-focus:text-[#d35400] peer-focus:font-bold peer-valid:-top-[15px] peer-valid:text-xs peer-valid:text-[#d35400] peer-valid:font-bold">
              Email Address
            </label>
            <span className="absolute bottom-0 left-0 h-[2px] w-0 bg-[#d35400] transition-all duration-400 peer-focus:w-full"></span>
          </div>

          {/* Input Password */}
          <div className="relative mb-[30px] w-full">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="peer w-full py-2.5 text-base text-[#333] border-none border-b-2 border-[#ddd] outline-none bg-transparent transition-all focus:border-transparent"
            />
            <label className="absolute top-2.5 left-0 text-[#999] pointer-events-none transition-all duration-300 ease-in-out peer-focus:-top-[15px] peer-focus:text-xs peer-focus:text-[#d35400] peer-focus:font-bold peer-valid:-top-[15px] peer-valid:text-xs peer-valid:text-[#d35400] peer-valid:font-bold">
              Password
            </label>
            <span className="absolute bottom-0 left-0 h-[2px] w-0 bg-[#d35400] transition-all duration-400 peer-focus:w-full"></span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-br from-[#d35400] to-[#8e0e0e] border-none text-white p-3 text-base font-bold rounded-[25px] cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_5px_15px_rgba(211,84,0,0.4)] active:translate-y-0 flex items-center justify-center gap-2 disabled:opacity-70 mt-[10px]"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                MEMPROSES...
              </>
            ) : (
              'MASUK'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}