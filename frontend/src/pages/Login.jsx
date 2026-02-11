import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Droplets, Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const Login = () => {
  const [activeTab, setActiveTab] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'auditor',
    department: ''
  });

  const { login, register, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    // Seed sample data on first load
    const seedData = async () => {
      try {
        await axios.post(`${API_URL}/api/seed-data`);
      } catch (e) {
        // Ignore errors - data might already exist
      }
    };
    seedData();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await login(loginData.email, loginData.password);
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid credentials');
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      await register(registerData);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
      toast.error('Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen login-bg flex items-center justify-center p-4" data-testid="login-page">
      <div className="w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <Droplets className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Global Acqua
          </h1>
          <p className="text-slate-300 mt-1">RCA Tool</p>
        </div>

        {/* Auth Card */}
        <Card className="glass border-white/20 shadow-2xl">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Shield className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Secure Access</span>
            </div>
            <CardTitle className="text-xl" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {activeTab === 'login' ? 'Welcome Back' : 'Create Account'}
            </CardTitle>
            <CardDescription>
              {activeTab === 'login' 
                ? 'Sign in to access your audit management dashboard'
                : 'Register to start managing audit findings'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" data-testid="login-tab">Sign In</TabsTrigger>
                <TabsTrigger value="register" data-testid="register-tab">Register</TabsTrigger>
              </TabsList>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="admin@globalacqua.com"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      required
                      data-testid="login-email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        required
                        data-testid="login-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading} data-testid="login-submit">
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                </form>
                
                <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500 mb-2">Demo Credentials:</p>
                  <p className="text-xs text-slate-600">
                    <strong>Admin:</strong> admin@globalacqua.com / admin123
                  </p>
                  <p className="text-xs text-slate-600">
                    <strong>QA Manager:</strong> qa.manager@globalacqua.com / password123
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div>
                    <Label htmlFor="register-name">Full Name</Label>
                    <Input
                      id="register-name"
                      type="text"
                      placeholder="John Doe"
                      value={registerData.name}
                      onChange={(e) => setRegisterData({ ...registerData, name: e.target.value })}
                      required
                      data-testid="register-name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="john@example.com"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      required
                      data-testid="register-email"
                    />
                  </div>
                  <div>
                    <Label htmlFor="register-password">Password</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="••••••••"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      required
                      minLength={6}
                      data-testid="register-password"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="register-role">Role</Label>
                      <Select
                        value={registerData.role}
                        onValueChange={(value) => setRegisterData({ ...registerData, role: value })}
                      >
                        <SelectTrigger data-testid="register-role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auditor">Auditor</SelectItem>
                          <SelectItem value="department_head">Department Head</SelectItem>
                          <SelectItem value="qa_manager">QA Manager</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="register-department">Department</Label>
                      <Select
                        value={registerData.department}
                        onValueChange={(value) => setRegisterData({ ...registerData, department: value })}
                      >
                        <SelectTrigger data-testid="register-department">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Production">Production</SelectItem>
                          <SelectItem value="QA">QA</SelectItem>
                          <SelectItem value="Maintenance">Maintenance</SelectItem>
                          <SelectItem value="Warehouse">Warehouse</SelectItem>
                          <SelectItem value="HR">HR</SelectItem>
                          <SelectItem value="Utilities">Utilities</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading} data-testid="register-submit">
                    {loading ? 'Creating account...' : 'Create Account'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-6">
          ISO 9001 • ISO 14001 • ISO 45001 • FSSC 22000 Compliant
        </p>
      </div>
    </div>
  );
};
