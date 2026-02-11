import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useAuth } from '../context/AuthContext';
import { Settings as SettingsIcon, Database, Shield, Bell, Globe, Info } from 'lucide-react';

export const Settings = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6" data-testid="settings-page">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Settings
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          System configuration and information
        </p>
      </div>

      {/* System Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            <Info className="w-5 h-5 text-blue-600" />
            System Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500">Application</p>
                <p className="text-lg font-semibold text-slate-900">AquaGuard RCA System</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Version</p>
                <p className="text-lg font-semibold text-slate-900">1.0.0</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Environment</p>
                <Badge className="bg-emerald-100 text-emerald-800">Production</Badge>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500">Current User</p>
                <p className="text-lg font-semibold text-slate-900">{user?.name}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Role</p>
                <Badge className="bg-blue-100 text-blue-800 capitalize">
                  {user?.role?.replace('_', ' ')}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-slate-500">Email</p>
                <p className="text-sm text-slate-700">{user?.email}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Standards */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            <Shield className="w-5 h-5 text-blue-600" />
            Supported Standards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-lg text-center">
              <p className="text-lg font-bold text-slate-900">ISO 9001:2015</p>
              <p className="text-xs text-slate-500 mt-1">Quality Management</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg text-center">
              <p className="text-lg font-bold text-slate-900">ISO 14001:2015</p>
              <p className="text-xs text-slate-500 mt-1">Environmental Management</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg text-center">
              <p className="text-lg font-bold text-slate-900">ISO 45001:2018</p>
              <p className="text-xs text-slate-500 mt-1">Occupational Health & Safety</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg text-center">
              <p className="text-lg font-bold text-slate-900">FSSC 22000</p>
              <p className="text-xs text-slate-500 mt-1">Food Safety</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            <SettingsIcon className="w-5 h-5 text-blue-600" />
            System Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
              <Database className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">MongoDB Database</p>
                <p className="text-sm text-slate-500">Secure data storage with backup</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">Role-Based Access</p>
                <p className="text-sm text-slate-500">Admin, QA Manager, Dept Head, Auditor</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
              <Bell className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">Notifications</p>
                <p className="text-sm text-slate-500">Real-time status updates</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
              <Globe className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-slate-900">PDF Report Export</p>
                <p className="text-sm text-slate-500">Management review reports</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About */}
      <Card>
        <CardContent className="p-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            AquaGuard RCA System
          </h3>
          <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
            A comprehensive Root Cause Analysis and Audit Finding Management System 
            designed for packaged drinking water facilities complying with 
            ISO 9001, ISO 14001, ISO 45001, and FSSC 22000 standards.
          </p>
          <div className="flex justify-center gap-2 mt-4">
            <Badge variant="outline">ISO 9001</Badge>
            <Badge variant="outline">ISO 14001</Badge>
            <Badge variant="outline">ISO 45001</Badge>
            <Badge variant="outline">FSSC 22000</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
