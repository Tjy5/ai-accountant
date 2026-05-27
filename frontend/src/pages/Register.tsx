import React, { useState } from 'react';
import { isAxiosError } from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axiosInstance';
import { CuteSticker } from '../components/CuteStickers';
import { Mail, Lock, User } from 'lucide-react';

export const Register = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.post('/auth/register', { email, name, password });
      const { token, user } = response.data;
      login(user, token);
      navigate('/');
    } catch (err) {
      if (isAxiosError(err)) {
        const data = err.response?.data as { error?: string; message?: string } | undefined;
        setError(data?.error || data?.message || 'Failed to register. Account might be taken.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cute-bg flex items-center justify-center p-4 text-[#4E3629]">
      <div className="w-full max-w-sm bg-white border-4 border-[#4E3629] rounded-[35px] p-8 shadow-md flex flex-col gap-6 relative">

        <div className="flex flex-col items-center gap-4">
          <div className="w-32 h-32 rounded-[32px] bg-[#FFF1E2] border border-[#F0D9C7] p-2.5 flex items-center justify-center shadow-[0_12px_26px_rgba(92,65,45,0.08)]">
            <CuteSticker name="calculator-cat" className="w-full h-full" title="Cute Calico Cat with Calculator" />
          </div>
          <h1 className="text-3xl font-black tracking-tight">Join Us!</h1>
        </div>

        <form onSubmit={handleRegister} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5 text-left">
            <label className="text-sm font-black ml-4">Account</label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-gray-400">
                <Mail size={18} className="text-[#4E3629]/60" />
              </span>
              <input
                type="text"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-3 bg-white border-2 border-[#4E3629] rounded-full focus:outline-none focus:ring-2 focus:ring-macaron-pink/20 text-sm font-bold text-[#4E3629] placeholder-gray-400"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-left">
            <label className="text-sm font-black ml-4">Name (Optional)</label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-gray-400">
                <User size={18} className="text-[#4E3629]/60" />
              </span>
              <input
                type="text"
                placeholder="Pick a cute name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white border-2 border-[#4E3629] rounded-full focus:outline-none focus:ring-2 focus:ring-macaron-pink/20 text-sm font-bold text-[#4E3629] placeholder-gray-400"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-left">
            <label className="text-sm font-black ml-4">Password</label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-gray-400">
                <Lock size={18} className="text-[#4E3629]/60" />
              </span>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-3 bg-white border-2 border-[#4E3629] rounded-full focus:outline-none focus:ring-2 focus:ring-macaron-pink/20 text-sm font-bold text-[#4E3629] placeholder-gray-400"
              />
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-xs text-center bg-red-50 p-2.5 rounded-2xl border-2 border-red-200 font-bold">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full py-3 bg-[#C2F2D0] hover:bg-[#A9DFB7] text-[#4E3629] font-black rounded-full border-2 border-[#4E3629] shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            {loading ? 'Creating account...' : "Sign Up 🐾"}
          </button>
        </form>

        <div className="flex flex-col items-center gap-3 mt-2 text-xs font-bold text-gray-500">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="text-[#C2F2D0] font-black brightness-75 hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
