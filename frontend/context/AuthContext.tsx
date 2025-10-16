import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

interface User {
  id: string;
  username: string;
  full_name: string;
  qualifications?: string;
  certifications?: string;
  years_experience?: string;
  is_admin?: boolean;
  is_active?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, fullName?: string, qualifications?: string, certifications?: string, yearsExperience?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      // Add timeout to prevent hanging
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Storage timeout')), 5000)
      );
      
      const loadData = async () => {
        const storedToken = await AsyncStorage.getItem('token');
        const storedUser = await AsyncStorage.getItem('user');
        
        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      };
      
      await Promise.race([loadData(), timeout]);
    } catch (error) {
      console.error('Error loading stored auth:', error);
      // Clear potentially corrupted data
      await AsyncStorage.multiRemove(['token', 'user']);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        username,
        password,
      });
      
      const { token, user } = response.data;
      setToken(token);
      setUser(user);
      
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Login failed');
    }
  };

  const register = async (username: string, password: string, fullName?: string, qualifications?: string, certifications?: string, yearsExperience?: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/auth/register`, {
        username,
        password,
        full_name: fullName,
        qualifications,
        certifications,
        years_experience: yearsExperience,
      });
      
      const { token, user } = response.data;
      setToken(token);
      setUser(user);
      
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Registration failed');
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      setToken(null);
      setUser(null);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { API_URL };
