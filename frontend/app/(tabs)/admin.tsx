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
import { useRouter } from 'expo-router';
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

interface Audit {
  id: string;
  title: string;
  questionnaire_name: string;
  status: string;
  created_at: string;
}

export default function AdminScreen() {
  const { token, user: currentUser } = useAuth();
  const router = useRouter();
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
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [userAudits, setUserAudits] = useState<{ [key: string]: Audit[] }>({});
  const [loadingAudits, setLoadingAudits] = useState<{ [key: string]: boolean }>({});
  const [editingQualifications, setEditingQualifications] = useState<string | null>(null);
  const [editQualData, setEditQualData] = useState({
    qualifications: '',
    certifications: '',
    years_of_experience: '',
  });
  const [savingQual, setSavingQual] = useState(false);

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

  const handleEditQualifications = (user: User) => {
    setEditingQualifications(user.id);
    setEditQualData({
      qualifications: user.qualifications || '',
      certifications: user.certifications || '',
      years_of_experience: user.years_of_experience || '',
    });
  };

  const handleSaveQualifications = async (userId: string) => {
    try {
      setSavingQual(true);
      await axios.put(
        `${API_URL}/api/admin/users/${userId}/qualifications`,
        editQualData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Success', 'Qualifications updated successfully');
      setEditingQualifications(null);
      fetchUsers();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update qualifications');
    } finally {
      setSavingQual(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingQualifications(null);
    setEditQualData({
      qualifications: '',
      certifications: '',
      years_of_experience: '',
    });
  };

  const toggleUserAudits = async (userId: string) => {
    // If already expanded, collapse it
    if (expandedUserId === userId) {
      setExpandedUserId(null);
      return;
    }

    // Expand and load audits if not already loaded
    setExpandedUserId(userId);
    if (!userAudits[userId]) {
      setLoadingAudits({ ...loadingAudits, [userId]: true });
      try {
        const response = await axios.get(
          `${API_URL}/api/admin/users/${userId}/audits`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setUserAudits({ ...userAudits, [userId]: response.data.audits });
      } catch (error) {
        console.error('Error fetching user audits:', error);
        Alert.alert('Error', 'Failed to load user audits');
      } finally {
        setLoadingAudits({ ...loadingAudits, [userId]: false });
      }
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#10B981';
      case 'in_progress':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'in_progress':
        return 'In Progress';
      default:
        return 'Draft';
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

            {/* Qualifications Section - Editable */}
            <View style={styles.qualSection}>
              <View style={styles.qualHeader}>
                <Text style={styles.qualTitle}>Qualifications</Text>
                {editingQualifications !== user.id ? (
                  <TouchableOpacity onPress={() => handleEditQualifications(user)}>
                    <Ionicons name="create-outline" size={22} color="#3B82F6" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.qualEditButtons}>
                    <TouchableOpacity 
                      onPress={() => handleSaveQualifications(user.id)}
                      disabled={savingQual}
                    >
                      {savingQual ? (
                        <ActivityIndicator size="small" color="#10B981" />
                      ) : (
                        <Ionicons name="checkmark-circle" size={26} color="#10B981" />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleCancelEdit} disabled={savingQual}>
                      <Ionicons name="close-circle" size={26} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              
              {editingQualifications === user.id ? (
                <View style={styles.qualEditForm}>
                  <Text style={styles.qualInputLabel}>Qualifications</Text>
                  <TextInput
                    style={styles.qualInput}
                    placeholder="e.g., B.Tech, MBA"
                    value={editQualData.qualifications}
                    onChangeText={(text) => setEditQualData({ ...editQualData, qualifications: text })}
                    editable={!savingQual}
                  />
                  
                  <Text style={styles.qualInputLabel}>Certifications</Text>
                  <TextInput
                    style={styles.qualInput}
                    placeholder="e.g., ISO Lead Auditor"
                    value={editQualData.certifications}
                    onChangeText={(text) => setEditQualData({ ...editQualData, certifications: text })}
                    editable={!savingQual}
                  />
                  
                  <Text style={styles.qualInputLabel}>Years of Experience</Text>
                  <TextInput
                    style={styles.qualInput}
                    placeholder="e.g., 5"
                    value={editQualData.years_of_experience}
                    onChangeText={(text) => setEditQualData({ ...editQualData, years_of_experience: text })}
                    keyboardType="numeric"
                    editable={!savingQual}
                  />
                </View>
              ) : (
                <View style={styles.userDetails}>
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Qualifications:</Text> {user.qualifications || 'Not specified'}
                  </Text>
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Certifications:</Text> {user.certifications || 'Not specified'}
                  </Text>
                  <Text style={styles.detailText}>
                    <Text style={styles.detailLabel}>Experience:</Text> {user.years_of_experience ? `${user.years_of_experience} years` : 'Not specified'}
                  </Text>
                </View>
              )}
            </View>

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

            {/* Audits Dropdown */}
            <TouchableOpacity
              style={styles.auditsToggle}
              onPress={() => toggleUserAudits(user.id)}
            >
              <Ionicons name="document-text-outline" size={18} color="#3B82F6" />
              <Text style={styles.auditsToggleText}>
                View Audits ({userAudits[user.id]?.length || '...'})
              </Text>
              <Ionicons
                name={expandedUserId === user.id ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#3B82F6"
              />
            </TouchableOpacity>

            {/* Expanded Audits List */}
            {expandedUserId === user.id && (
              <View style={styles.auditsContainer}>
                {loadingAudits[user.id] ? (
                  <ActivityIndicator size="small" color="#3B82F6" />
                ) : userAudits[user.id]?.length > 0 ? (
                  userAudits[user.id].map((audit) => (
                    <TouchableOpacity
                      key={audit.id}
                      style={styles.auditItem}
                      onPress={() => router.push(`/audit/${audit.id}`)}
                    >
                      <View style={styles.auditItemHeader}>
                        <Text style={styles.auditTitle} numberOfLines={1}>
                          {audit.title}
                        </Text>
                        <View
                          style={[
                            styles.auditStatus,
                            { backgroundColor: getStatusColor(audit.status) },
                          ]}
                        >
                          <Text style={styles.auditStatusText}>
                            {getStatusLabel(audit.status)}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.auditQuestionnaire} numberOfLines={1}>
                        {audit.questionnaire_name}
                      </Text>
                      <Text style={styles.auditDate}>
                        {formatDate(audit.created_at)}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.noAuditsText}>No audits found</Text>
                )}
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
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 6,
  },
  disableButton: {
    backgroundColor: '#EF4444',
  },
  enableButton: {
    backgroundColor: '#10B981',
  },
  deleteButton: {
    backgroundColor: '#DC2626',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
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
  qualSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  qualHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  qualTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
  },
  qualEditButtons: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  qualEditForm: {
    marginTop: 8,
  },
  qualInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 8,
  },
  qualInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
  },
  auditsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    padding: 10,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    gap: 6,
  },
  auditsToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    flex: 1,
  },
  auditsContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  auditItem: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  auditItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  auditTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    marginRight: 8,
  },
  auditStatus: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  auditStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  auditQuestionnaire: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  auditDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  noAuditsText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 12,
  },
});
