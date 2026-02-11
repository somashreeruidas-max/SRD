import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  ClipboardList,
  Search,
  CheckSquare,
  Grid3X3,
  FileText,
  BarChart3,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Shield
} from 'lucide-react';
import { cn } from '../../lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Audit Findings', href: '/findings', icon: ClipboardList },
  { name: 'RCA Wizard', href: '/rca', icon: Search },
  { name: 'CAPA Management', href: '/capa', icon: CheckSquare },
  { name: 'Risk Matrix', href: '/risk-matrix', icon: Grid3X3 },
  { name: 'Evidence Repository', href: '/evidence', icon: FileText },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
];

const adminNav = [
  { name: 'User Management', href: '/users', icon: Users },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={cn(
        'bg-slate-900 text-white flex flex-col transition-all duration-300 relative',
        collapsed ? 'w-16' : 'w-64'
      )}
      data-testid="sidebar"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Droplets className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <h1 className="text-lg font-bold tracking-tight">Global Acqua</h1>
              <p className="text-[10px] text-slate-400 -mt-0.5">RCA Tool</p>
            </div>
          )}
        </div>
      </div>

      {/* Collapse Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors z-10"
        data-testid="sidebar-toggle"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            className={({ isActive }) =>
              cn(
                'sidebar-item',
                isActive && 'active',
                collapsed && 'justify-center px-2'
              )
            }
            data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="animate-fade-in">{item.name}</span>}
          </NavLink>
        ))}

        {hasRole(['admin', 'qa_manager']) && (
          <>
            <div className={cn('pt-4 pb-2', collapsed ? 'px-2' : 'px-3')}>
              {!collapsed && (
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Administration
                </span>
              )}
              {collapsed && <div className="border-t border-slate-700" />}
            </div>
            {adminNav.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'sidebar-item',
                    isActive && 'active',
                    collapsed && 'justify-center px-2'
                  )
                }
                data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="animate-fade-in">{item.name}</span>}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      {/* User Section */}
      <div className="border-t border-slate-800 p-3">
        <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-semibold">
              {user?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0 animate-fade-in">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 truncate capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          )}
        </div>
        <button
          onClick={handleLogout}
          className={cn(
            'mt-3 w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors',
            collapsed && 'justify-center px-2'
          )}
          data-testid="logout-btn"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};
