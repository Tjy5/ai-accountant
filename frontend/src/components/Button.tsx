import React from 'react';
import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  fullWidth = false, 
  className = '', 
  ...props 
}) => {
  const baseClasses = "font-bold rounded-cute transition-transform duration-200 hover:scale-105 active:scale-95 flex items-center justify-center";
  const sizeClasses = "px-6 py-3";
  
  const variants = {
    primary: "bg-macaron-pink text-gray-800 shadow-sm",
    secondary: "bg-macaron-mint text-gray-800 shadow-sm",
    danger: "bg-red-400 text-white shadow-sm",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100",
  };

  const widthClass = fullWidth ? "w-full" : "";

  return (
    <button 
      className={`${baseClasses} ${sizeClasses} ${variants[variant]} ${widthClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
