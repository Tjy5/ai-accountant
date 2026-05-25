import React from 'react';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && <label className="text-sm font-semibold text-gray-600 ml-2">{label}</label>}
      <input 
        className={`px-4 py-3 bg-white border-2 border-gray-100 rounded-cute focus:outline-none focus:border-macaron-pink focus:ring-2 focus:ring-macaron-pink/20 transition-all ${error ? 'border-red-400 focus:border-red-400 focus:ring-red-400/20' : ''}`}
        {...props}
      />
      {error && <span className="text-xs text-red-500 ml-2">{error}</span>}
    </div>
  );
};
