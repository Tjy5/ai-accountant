import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Receipt, LogOut, Cat } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'AI Bookkeeper', path: '/ai-input', icon: Receipt },
  ];

  return (
    <div className="flex h-screen w-full bg-cute-bg overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white flex flex-col items-center py-8 shadow-sm">
        {/* Logo area */}
        <div className="flex flex-col items-center gap-2 mb-12">
          <div className="w-16 h-16 bg-macaron-pink rounded-full flex items-center justify-center text-white shadow-cute">
            <Cat size={32} />
          </div>
          <h1 className="font-bold text-lg text-gray-800">AI Accountant</h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 w-full px-4 flex flex-col gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) => 
                `flex items-center gap-3 px-4 py-3 rounded-cute transition-all font-semibold ${
                  isActive 
                    ? 'bg-macaron-mint/20 text-emerald-700' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`
              }
            >
              <item.icon size={20} />
              {item.name}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="w-full px-4 mt-auto">
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 text-red-400 font-semibold rounded-cute hover:bg-red-50 transition-all"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-y-auto p-8">
        <div className="max-w-6xl mx-auto h-full">
          {children}
        </div>
      </main>
    </div>
  );
};
