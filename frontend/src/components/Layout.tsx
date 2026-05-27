import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  FolderSearch,
  Target,
  CalendarDays,
  FileBarChart,
  Settings as SettingsIcon,
  ChevronDown,
  LogOut
} from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { CuteSticker } from './CuteStickers';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const location = useLocation();

  const [profileOpen, setProfileOpen] = useState(false);
  const rawProfileLabel = user?.name || user?.email || 'Sarah';
  const profileLabel = /^\d+$/.test(rawProfileLabel.trim()) ? 'Sarah' : rawProfileLabel;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNewEntry = () => {
    if (location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const input = document.getElementById('ai-chat-input') as HTMLInputElement;
        input?.focus();
      }, 300);
    } else {
      const input = document.getElementById('ai-chat-input') as HTMLInputElement;
      input?.focus();
    }
  };

  const menuItems = [
    { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={20} strokeWidth={2.5} /> },
    { to: '/transactions', label: 'Transactions', icon: <FileText size={20} strokeWidth={2.5} /> },
    { to: '/categories', label: 'Categories', icon: <FolderSearch size={20} strokeWidth={2.5} /> },
    { to: '/goals', label: 'Goals', icon: <Target size={20} strokeWidth={2.5} /> },
    { to: '/budgets', label: 'Budgets', icon: <CalendarDays size={20} strokeWidth={2.5} /> },
    { to: '/reports', label: 'Reports', icon: <FileBarChart size={20} strokeWidth={2.5} /> },
    { to: '/settings', label: 'Settings', icon: <SettingsIcon size={20} strokeWidth={2.5} /> },
  ];

  return (
    <div className="min-h-screen bg-[#ECE7DF] p-2 flex items-center justify-center text-[#4E3629] font-sans antialiased selection:bg-[#FFD1DC]/50">
      <div className="w-[calc(100vw-16px)] h-[calc(100vh-16px)] min-h-[720px] bg-[#FBF8F3] flex overflow-hidden rounded-[26px] shadow-[0_22px_70px_rgba(92,65,45,0.13)]">
      {/* Left Sidebar */}
      <aside className="w-[282px] bg-[#FFFDF8] border-r border-[#EDE1D5] flex flex-col justify-between px-5 py-6 shrink-0 h-full z-30 shadow-[12px_0_32px_rgba(92,65,45,0.05)]">
        <div className="flex flex-col gap-7">
          {/* Brand Logo Header */}
          <div className="flex items-center gap-3 select-none">
            <div className="w-12 h-12 rounded-[18px] bg-[#FFF1E2] border border-[#F0D9C7] p-1.5 shadow-[0_8px_18px_rgba(92,65,45,0.08)]">
              <CuteSticker name="logo-cat" className="w-full h-full" title="AI Accountant Logo" />
            </div>
            <h1 className="text-[22px] font-black tracking-tight text-[#33251E]">AI Accountant</h1>
          </div>

          {/* New Entry Button */}
          <button
            onClick={handleNewEntry}
            className="w-full py-3.5 bg-gradient-to-r from-[#FF6F8F] to-[#FF8A9B] text-white font-black rounded-full shadow-[0_12px_24px_rgba(255,111,143,0.28)] hover:translate-y-[-1px] active:translate-y-0 transition-all cursor-pointer text-center text-base flex items-center justify-center gap-2"
          >
            <span className="text-lg leading-none">+</span> New Entry
          </button>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-2 mt-1">
            {menuItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3.5 rounded-[18px] font-extrabold text-[15px] transition-all border border-transparent ${
                    isActive
                      ? 'bg-[#F4EDE6] text-[#4E3629] shadow-[0_8px_18px_rgba(92,65,45,0.06)]'
                      : 'text-[#7F8794] hover:text-[#4E3629] hover:bg-[#F8F2EC]'
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* User Profile Card */}
        <div className="relative">
          {profileOpen && (
            <div className="absolute bottom-16 left-0 w-full bg-white border border-[#EEE3D9] rounded-[20px] p-3 shadow-lg flex flex-col gap-2 z-[55] animate-slide-up">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-red-500 font-bold text-sm hover:bg-red-50 rounded-xl transition-colors cursor-pointer text-left"
              >
                <LogOut size={16} />
                Log Out
              </button>
            </div>
          )}

          <div
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center justify-between gap-3 p-3 rounded-[22px] border border-[#EEE3D9] bg-white cursor-pointer hover:bg-[#FFF8F1] transition-all select-none shadow-[0_8px_22px_rgba(92,65,45,0.08)]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-full border border-[#E8D8CB] overflow-hidden shrink-0 bg-[#FFF3EA] p-0.5">
                <CuteSticker name="avatar" className="w-full h-full" title="User Profile" />
              </div>
              <span className="font-black text-sm text-[#4E3629] truncate">{profileLabel}</span>
            </div>
            <ChevronDown size={16} className={`text-gray-500 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-grow flex flex-col h-full min-w-0 min-h-0 overflow-y-auto">
        <main className="px-7 py-7 w-full flex-grow min-h-0 flex flex-col">
          {children}
        </main>
      </div>
      </div>
    </div>
  );
};
