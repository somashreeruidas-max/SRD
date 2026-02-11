import React from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, Search, HelpCircle } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/findings': 'Audit Findings',
  '/rca': 'Root Cause Analysis',
  '/capa': 'CAPA Management',
  '/risk-matrix': 'Risk Assessment Matrix',
  '/evidence': 'Evidence Repository',
  '/analytics': 'Analytics & Reports',
  '/users': 'User Management',
  '/settings': 'Settings',
};

export const Header = () => {
  const location = useLocation();
  const currentPath = '/' + location.pathname.split('/')[1];
  const title = pageTitles[currentPath] || 'AquaGuard';

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between" data-testid="header">
      <div>
        <h1 className="text-xl font-semibold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
          {title}
        </h1>
        <p className="text-xs text-slate-500">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search findings, CAPA..."
            className="pl-9 w-64 h-9 text-sm"
            data-testid="header-search"
          />
        </div>

        <Button variant="ghost" size="icon" className="relative" data-testid="notifications-btn">
          <Bell className="w-5 h-5 text-slate-600" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </Button>

        <Button variant="ghost" size="icon" data-testid="help-btn">
          <HelpCircle className="w-5 h-5 text-slate-600" />
        </Button>
      </div>
    </header>
  );
};
