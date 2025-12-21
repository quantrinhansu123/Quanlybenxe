import React from "react";

// Reusable styled components - Light Theme
export const GlassCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`
    relative overflow-hidden rounded-2xl
    bg-white border border-gray-200/80
    shadow-sm hover:shadow-md transition-shadow duration-300
    ${className}
  `}>
    {children}
  </div>
);

export const SectionHeader = ({ icon: Icon, title, badge, action }: {
  icon: React.ElementType;
  title: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) => (
  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-white">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-sm shadow-blue-500/20">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="font-semibold text-gray-800 tracking-tight">{title}</h3>
      {badge}
    </div>
    {action}
  </div>
);

export const FormField = ({ label, required, children, className = "" }: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={className}>
    <label className="block text-sm font-medium text-gray-600 mb-2">
      {label}
      {required && <span className="text-rose-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);

export const StyledInput = ({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={`
      w-full px-4 py-2.5 rounded-xl
      bg-gray-50 border border-gray-200
      text-gray-800 placeholder-gray-400
      focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white
      transition-all duration-200
      disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100
      ${className}
    `}
    {...props}
  />
);

export const StyledSelect = ({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={`
      w-full px-4 py-2.5 rounded-xl
      bg-gray-50 border border-gray-200
      text-gray-800
      focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 focus:bg-white
      transition-all duration-200
      disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100
      ${className}
    `}
    {...props}
  >
    {children}
  </select>
);
