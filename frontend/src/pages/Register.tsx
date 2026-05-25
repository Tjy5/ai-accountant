import React, { useState } from 'react';
import { isAxiosError } from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { useAuthStore } from '../store/useAuthStore';
import api from '../api/axiosInstance';
import { Cat } from 'lucide-react';

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
        setError(data?.error || data?.message || 'Failed to register. Email might be taken.');
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cute-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6 relative">
          <div className="w-32 h-32 bg-white rounded-full shadow-cute flex items-center justify-center -mb-8 relative z-10 border-4 border-cute-bg">
            <Cat size={64} className="text-macaron-mint" />
          </div>
        </div>
        
        <Card className="pt-12 pb-8 px-8 flex flex-col gap-6 relative z-0">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-800">Join Us!</h1>
            <p className="text-sm text-gray-500 mt-1">Start tracking your money smartly.</p>
          </div>

          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <Input 
              label="Email" 
              type="email"
              placeholder="e.g. fluffy@cat.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input 
              label="Name (Optional)" 
              type="text"
              placeholder="Pick a cute name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input 
              label="Password" 
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            
            {error && (
              <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">
                {error}
              </div>
            )}

            <Button type="submit" variant="secondary" fullWidth className="mt-2" disabled={loading}>
              {loading ? 'Creating account...' : "Sign Up 🐾"}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-macaron-mint font-bold hover:underline">
              Log in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
};
