import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';
import Constants from 'expo-constants';

export default function ProfileScreen() {
  const { user, logout, token } = useAuth();
  const router = useRouter();
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [qualifications, setQualifications] = useState<string>('');
  const [certifications, setCertifications] = useState<string>('');
  const [yearsExperience, setYearsExperience] = useState<string>('');
  const [isEditingQualifications, setIsEditingQualifications] = useState(false);
  const [savingQualifications, setSavingQualifications] = useState(false);

  const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

  // Fetch user profile picture on mount
  useEffect(() => {
    fetchProfilePicture();
  }, []);

  const fetchProfilePicture = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.data.profile_picture) {
        setProfilePicture(response.data.profile_picture);
      }
      // Load qualifications data
      setQualifications(response.data.qualifications || '');
      setCertifications(response.data.certifications || '');
      setYearsExperience(response.data.years_experience || '');
    } catch (error) {
      console.error('Error fetching profile picture:', error);
    }
  };

  const pickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Sorry, we need camera roll permissions to upload a profile picture!');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        // Remove aspect ratio constraint - allow free cropping
        quality: 0.7, // Better quality
      });

      if (!result.canceled && result.assets[0]) {
        setUploading(true);
        const uri = result.assets[0].uri;

        // Convert to base64
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();
        
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          await uploadProfilePicture(base64data);
        };
        
        reader.readAsDataURL(blob);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      alert('Failed to pick image. Please try again.');
      setUploading(false);
    }
  };

  const uploadProfilePicture = async (base64Image: string) => {
    try {
      const response = await axios.put(
        `${API_URL}/api/auth/profile-picture`,
        { profile_picture: base64Image },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.profile_picture) {
        setProfilePicture(response.data.profile_picture);
        alert('Profile picture updated successfully!');
      }
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      alert('Failed to upload profile picture. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const deleteProfilePicture = async () => {
    const confirmDelete = Platform.OS === 'web' 
      ? window.confirm('Are you sure you want to delete your profile picture?')
      : true;

    if (!confirmDelete) return;

    if (Platform.OS !== 'web') {
      Alert.alert(
        'Delete Profile Picture',
        'Are you sure you want to delete your profile picture?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await performDelete();
            },
          },
        ]
      );
    } else {
      await performDelete();
    }
  };

  const performDelete = async () => {
    try {
      setUploading(true);
      await axios.put(
        `${API_URL}/api/auth/profile-picture`,
        { profile_picture: null },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setProfilePicture(null);
      alert('Profile picture deleted successfully!');
    } catch (error) {
      console.error('Error deleting profile picture:', error);
      alert('Failed to delete profile picture. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveQualifications = async () => {
    try {
      setSavingQualifications(true);
      await axios.put(
        `${API_URL}/api/auth/qualifications`,
        {
          qualifications,
          certifications,
          years_of_experience: yearsExperience,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setIsEditingQualifications(false);
      // Reload profile data to reflect changes
      await fetchProfilePicture();
      
      if (Platform.OS === 'web') {
        alert('Qualifications updated successfully!');
      } else {
        Alert.alert('Success', 'Qualifications updated successfully!');
      }
    } catch (error) {
      console.error('Error updating qualifications:', error);
      if (Platform.OS === 'web') {
        alert('Failed to update qualifications. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to update qualifications. Please try again.');
      }
    } finally {
      setSavingQualifications(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      // Web platform
      if (window.confirm('Are you sure you want to logout?')) {
        logout();
        router.replace('/(auth)/login');
      }
    } else {
      // Mobile platform
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Logout',
            style: 'destructive',
            onPress: async () => {
              await logout();
              router.replace('/(auth)/login');
            },
          },
        ],
        { cancelable: true }
      );
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarWrapper}>
          <View style={styles.avatarContainer}>
            {profilePicture ? (
              <Image
                source={{ uri: profilePicture }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="person" size={64} color="#FFFFFF" />
            )}
            {uploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            )}
          </View>
          <View style={styles.avatarButtonsContainer}>
            <TouchableOpacity 
              style={styles.avatarActionButton} 
              onPress={pickImage}
              disabled={uploading}
            >
              <Ionicons name="camera" size={20} color="#3B82F6" />
              <Text style={styles.avatarActionButtonText}>Upload</Text>
            </TouchableOpacity>
            {profilePicture && (
              <TouchableOpacity 
                style={[styles.avatarActionButton, styles.deleteButton]} 
                onPress={deleteProfilePicture}
                disabled={uploading}
              >
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                <Text style={[styles.avatarActionButtonText, styles.deleteButtonText]}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={styles.name}>{user?.full_name || user?.username}</Text>
        <Text style={styles.username}>@{user?.username}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Auditor Qualifications</Text>
          {!isEditingQualifications ? (
            <TouchableOpacity onPress={() => setIsEditingQualifications(true)}>
              <Ionicons name="create-outline" size={24} color="#3B82F6" />
            </TouchableOpacity>
          ) : (
            <View style={styles.editButtonsContainer}>
              <TouchableOpacity 
                onPress={handleSaveQualifications} 
                disabled={savingQualifications}
                style={styles.saveButton}
              >
                {savingQualifications ? (
                  <ActivityIndicator size="small" color="#10B981" />
                ) : (
                  <Ionicons name="checkmark-circle" size={28} color="#10B981" />
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={() => {
                  setIsEditingQualifications(false);
                  fetchProfilePicture(); // Reload original values
                }}
                disabled={savingQualifications}
                style={styles.cancelButton}
              >
                <Ionicons name="close-circle" size={28} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
        </View>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="school-outline" size={20} color="#6B7280" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Qualifications</Text>
              {isEditingQualifications ? (
                <TextInput
                  style={styles.editInput}
                  placeholder="e.g., B.Tech, MBA"
                  value={qualifications}
                  onChangeText={setQualifications}
                  editable={!savingQualifications}
                />
              ) : (
                <Text style={styles.infoValue}>
                  {qualifications || 'Not specified'}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="ribbon-outline" size={20} color="#6B7280" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Certifications</Text>
              {isEditingQualifications ? (
                <TextInput
                  style={styles.editInput}
                  placeholder="e.g., ISO Lead Auditor"
                  value={certifications}
                  onChangeText={setCertifications}
                  editable={!savingQualifications}
                />
              ) : (
                <Text style={styles.infoValue}>
                  {certifications || 'Not specified'}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={20} color="#6B7280" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Years of Experience</Text>
              {isEditingQualifications ? (
                <TextInput
                  style={styles.editInput}
                  placeholder="e.g., 5"
                  value={yearsExperience}
                  onChangeText={setYearsExperience}
                  keyboardType="numeric"
                  editable={!savingQualifications}
                />
              ) : (
                <Text style={styles.infoValue}>
                  {yearsExperience ? `${yearsExperience} years` : 'Not specified'}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App Information</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="shield-outline" size={20} color="#6B7280" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Standards Supported</Text>
              <Text style={styles.infoValue}>ISO 45001:2018 (OHSMS)</Text>
              <Text style={styles.infoValue}>ISO 9001:2015 (QMS)</Text>
              <Text style={styles.infoValue}>ISO 14001:2015 (EMS)</Text>
              <Text style={styles.infoValue}>FSSC 22000 V6.0</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="code-outline" size={20} color="#6B7280" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Developer</Text>
              <Text style={styles.developerName}>Saila Ruidas</Text>
              <Text style={styles.collaboration}>In collaboration with Emergent Lab</Text>
            </View>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  avatarWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  avatarActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  avatarActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  deleteButton: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  deleteButtonText: {
    color: '#EF4444',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    color: '#DBEAFE',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  saveButton: {
    padding: 4,
  },
  cancelButton: {
    padding: 4,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#374151',
    backgroundColor: '#F9FAFB',
    marginTop: 6,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  developerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    marginTop: 2,
  },
  collaboration: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 8,
  },
});
