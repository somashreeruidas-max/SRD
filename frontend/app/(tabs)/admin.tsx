import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import Constants from 'expo-constants';

interface User {
  id: string;
  username: string;
  full_name: string;
  qualifications?: string;
  certifications?: string;
  years_of_experience?: string;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
}

export default function AdminScreen() {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    full_name: '',
    qualifications: '',
    certifications: '',
    years_of_experience: '',
  });
  const [creating, setCreating] = useState(false);

  const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password) {
      Alert.alert('Error', 'Username and password are required');
      return;
    }

    setCreating(true);
    try {
      await axios.post(
        `${API_URL}/api/admin/users`,
        {
          username: newUser.username,
          password: newUser.password,
          full_name: newUser.full_name,
          qualifications: newUser.qualifications,
          certifications: newUser.certifications,
          years_of_experience: newUser.years_of_experience,
          is_admin: false,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Success', 'User created successfully');
      setShowCreateModal(false);
      setNewUser({
        username: '',
        password: '',
        full_name: '',
        qualifications: '',
        certifications: '',
        years_of_experience: '',
      });
      fetchUsers();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    const action = currentStatus ? 'disable' : 'enable';
    
    if (Platform.OS === 'web') {
      if (!window.confirm(`Are you sure you want to ${action} this user?`)) {
        return;
      }
    } else {
      Alert.alert(
        'Confirm',
        `Are you sure you want to ${action} this user?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            onPress: async () => {
              await toggleUserStatus(userId);
            },
          },
        ]
      );
      return;
    }

    await toggleUserStatus(userId);
  };

  const toggleUserStatus = async (userId: string) => {
    try {
      await axios.put(
        `${API_URL}/api/admin/users/${userId}/toggle-status`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchUsers();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update user status');
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (Platform.OS === 'web') {
      if (!window.confirm(`Are you sure you want to PERMANENTLY DELETE user "${username}"? This action cannot be undone.`)) {
        return;
      }
    } else {
      Alert.alert(
        'Delete User',
        `Are you sure you want to PERMANENTLY DELETE user "${username}"? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await deleteUser(userId);
            },
          },
        ]
      );
      return;
    }

    await deleteUser(userId);
  };

  const deleteUser = async (userId: string) => {
    try {
      await axios.delete(
        `${API_URL}/api/admin/users/${userId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Success', 'User deleted successfully');
      fetchUsers();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to delete user');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (showCreateModal) {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowCreateModal(false)}>
            <Ionicons name="arrow-back" size={24} color="#3B82F6" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Create New User</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Username *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter username"
            value={newUser.username}
            onChangeText={(text) => setNewUser({ ...newUser, username: text })}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            value={newUser.password}
            onChangeText={(text) => setNewUser({ ...newUser, password: text })}
            secureTextEntry
          />

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter full name"
            value={newUser.full_name}
            onChangeText={(text) => setNewUser({ ...newUser, full_name: text })}
          />

          <Text style={styles.label}>Qualifications</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., B.Tech, MBA"
            value={newUser.qualifications}
            onChangeText={(text) => setNewUser({ ...newUser, qualifications: text })}
          />

          <Text style={styles.label}>Certifications</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., ISO Lead Auditor"
            value={newUser.certifications}
            onChangeText={(text) => setNewUser({ ...newUser, certifications: text })}
          />

          <Text style={styles.label}>Years of Experience</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., 5"
            value={newUser.years_of_experience}
            onChangeText={(text) => setNewUser({ ...newUser, years_of_experience: text })}
            keyboardType="numeric"
          />

          <TouchableOpacity
            style={[styles.createButton, creating && styles.buttonDisabled]}
            onPress={handleCreateUser}
            disabled={creating}
          >
            <Text style={styles.createButtonText}>
              {creating ? 'Creating...' : 'Create User'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>User Management</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {users.map((user) => (
          <View key={user.id} style={styles.userCard}>
            <View style={styles.userHeader}>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user.full_name || user.username}</Text>
                <Text style={styles.username}>@{user.username}</Text>
              </View>
              <View style={styles.badges}>
                {user.is_admin && (
                  <View style={styles.adminBadge}>
                    <Ionicons name="shield-checkmark" size={12} color="#EF4444" />
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                )}
                <View
                  style={[
                    styles.statusBadge,
                    user.is_active ? styles.activeBadge : styles.inactiveBadge,
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      user.is_active ? styles.activeDot : styles.inactiveDot,
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      user.is_active ? styles.activeText : styles.inactiveText,
                    ]}
                  >
                    {user.is_active ? 'Active' : 'Disabled'}
                  </Text>
                </View>
              </View>
            </View>

            {(user.qualifications || user.certifications || user.years_of_experience) && (
              <View style={styles.userDetails}>
                {user.qualifications && (
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Qualifications:</Text> {user.qualifications}
                  </Text>
                )}
                {user.certifications && (
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Certifications:</Text> {user.certifications}
                  </Text>
                )}
                {user.years_of_experience && (
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Experience:</Text> {user.years_of_experience} years
                  </Text>
                )}
              </View>
            )}

            {user.username !== currentUser?.username && (
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    user.is_active ? styles.disableButton : styles.enableButton,
                  ]}
                  onPress={() => handleToggleStatus(user.id, user.is_active)}
                >
                  <Ionicons
                    name={user.is_active ? 'close-circle' : 'checkmark-circle'}
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.actionButtonText}>
                    {user.is_active ? 'Disable' : 'Enable'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handleDeleteUser(user.id, user.username)}
                >
                  <Ionicons name="trash" size={18} color="#FFFFFF" />
                  <Text style={styles.actionButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  addButton: {
    backgroundColor: '#3B82F6',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    margin: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    color: '#6B7280',
  },
  badges: {
    flexDirection: 'row',
    gap: 8,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  adminBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  activeBadge: {
    backgroundColor: '#D1FAE5',
  },
  inactiveBadge: {
    backgroundColor: '#FEE2E2',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    backgroundColor: '#10B981',
  },
  inactiveDot: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeText: {
    color: '#065F46',
  },
  inactiveText: {
    color: '#991B1B',
  },
  userDetails: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  detailLabel: {
    fontWeight: '600',
    color: '#374151',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  disableButton: {
    backgroundColor: '#EF4444',
  },
  enableButton: {
    backgroundColor: '#10B981',
  },
  toggleButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  form: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
  },
  createButton: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
