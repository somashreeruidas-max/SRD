import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Users as UsersIcon, Shield, Mail, Calendar, Building } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ROLES = [
  { value: 'admin', label: 'Administrator', color: 'bg-purple-100 text-purple-800' },
  { value: 'qa_manager', label: 'QA Manager', color: 'bg-blue-100 text-blue-800' },
  { value: 'department_head', label: 'Department Head', color: 'bg-green-100 text-green-800' },
  { value: 'auditor', label: 'Auditor', color: 'bg-slate-100 text-slate-800' }
];

export const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user: currentUser, hasRole } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    if (userId === currentUser?.id) {
      toast.error("You cannot change your own role");
      return;
    }
    
    try {
      await axios.put(`${API_URL}/api/users/${userId}/role?role=${newRole}`);
      toast.success('Role updated successfully');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  const getRoleBadgeClass = (role) => {
    return ROLES.find(r => r.value === role)?.color || 'bg-slate-100 text-slate-800';
  };

  const getRoleLabel = (role) => {
    return ROLES.find(r => r.value === role)?.label || role;
  };

  if (!hasRole('admin')) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Shield className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">Admin access required</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="users-page">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
          User Management
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Manage user roles and permissions
        </p>
      </div>

      {/* Users List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center">
              <UsersIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="users-table">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Email</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Department</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Role</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Joined</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-slate-50 transition-colors" data-testid={`user-row-${user.id}`}>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                            {user.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{user.name}</p>
                            {user.id === currentUser?.id && (
                              <span className="text-xs text-blue-600">(You)</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Mail className="w-4 h-4 text-slate-400" />
                          {user.email}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {user.department ? (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Building className="w-4 h-4 text-slate-400" />
                            {user.department}
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <Badge className={getRoleBadgeClass(user.role)}>
                          {getRoleLabel(user.role)}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        {user.id !== currentUser?.id && (
                          <Select
                            value={user.role}
                            onValueChange={(value) => handleRoleChange(user.id, value)}
                          >
                            <SelectTrigger className="w-[150px]" data-testid={`role-select-${user.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((role) => (
                                <SelectItem key={role.value} value={role.value}>
                                  {role.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Descriptions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Role Permissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ROLES.map((role) => (
              <div key={role.value} className="p-4 bg-slate-50 rounded-lg">
                <Badge className={role.color}>{role.label}</Badge>
                <p className="text-sm text-slate-600 mt-2">
                  {role.value === 'admin' && 'Full system access. Can manage users, settings, and all data.'}
                  {role.value === 'qa_manager' && 'Can approve CAPAs, verify effectiveness, view all reports, and manage findings.'}
                  {role.value === 'department_head' && 'Can view department findings, assign actions, and track progress.'}
                  {role.value === 'auditor' && 'Can create findings, perform RCA, and create CAPAs.'}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
