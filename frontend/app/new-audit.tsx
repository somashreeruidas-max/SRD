import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth, API_URL } from '../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Questionnaire {
  id: string;
  name: string;
  description: string;
}

export default function NewAuditScreen() {
  const [title, setTitle] = useState('');
  const [auditId, setAuditId] = useState('');
  const [description, setDescription] = useState('');
  const [plantName, setPlantName] = useState('');
  const [auditorName, setAuditorName] = useState('');
  const [auditeeName, setAuditeeName] = useState('');
  const [auditScope, setAuditScope] = useState('');
  const [auditCriteria, setAuditCriteria] = useState('');
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (token) {
      fetchQuestionnaires();
    }
  }, [token]);

  const fetchQuestionnaires = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/questionnaires`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setQuestionnaires(response.data.questionnaires);
      if (response.data.questionnaires.length > 0) {
        setSelectedQuestionnaire(response.data.questionnaires[0].id);
      }
    } catch (error) {
      console.error('Error fetching questionnaires:', error);
      Alert.alert('Error', 'Failed to load questionnaires');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAudit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an audit title');
      return;
    }

    if (!selectedQuestionnaire) {
      Alert.alert('Error', 'Please select a questionnaire');
      return;
    }

    setCreating(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/audits`,
        {
          questionnaire_id: selectedQuestionnaire,
          title: title.trim(),
          audit_id: auditId.trim() || null,
          description: description.trim(),
          plant_name: plantName.trim(),
          auditor_name: auditorName.trim(),
          auditee_name: auditeeName.trim(),
          audit_scope: auditScope.trim(),
          audit_criteria: auditCriteria.trim(),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      Alert.alert('Success', 'Audit created successfully', [
        {
          text: 'OK',
          onPress: () => router.push(`/audit/${response.data.id}`),
        },
      ]);
    } catch (error: any) {
      console.error('Error creating audit:', error);
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create audit');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Audit</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.label}>Audit ID (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter audit ID (e.g., AUDIT-2024-001)"
            value={auditId}
            onChangeText={setAuditId}
            editable={!creating}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Audit Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter audit title"
            value={title}
            onChangeText={setTitle}
            editable={!creating}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Select Audit Questionnaire *</Text>
          <View style={styles.dropdownContainer}>
            {questionnaires.map((q) => (
              <TouchableOpacity
                key={q.id}
                style={[
                  styles.dropdownItem,
                  selectedQuestionnaire === q.id && styles.dropdownItemSelected,
                ]}
                onPress={() => setSelectedQuestionnaire(q.id)}
                disabled={creating}
              >
                <View style={styles.radioContainer}>
                  <View
                    style={[
                      styles.radio,
                      selectedQuestionnaire === q.id && styles.radioSelected,
                    ]}
                  >
                    {selectedQuestionnaire === q.id && (
                      <View style={styles.radioInner} />
                    )}
                  </View>
                </View>
                <View style={styles.dropdownItemContent}>
                  <Text style={[styles.dropdownItemName, selectedQuestionnaire === q.id && styles.dropdownItemNameSelected]}>
                    {q.name}
                  </Text>
                  {q.description && (
                    <Text style={styles.dropdownItemDescription} numberOfLines={1}>
                      {q.description}
                    </Text>
                  )}
                </View>
                {selectedQuestionnaire === q.id && (
                  <Ionicons name="checkmark-circle" size={20} color="#3B82F6" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter audit description"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!creating}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Plant Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Packaged Drinking Water Plant"
            value={plantName}
            onChangeText={setPlantName}
            editable={!creating}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Auditor Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter auditor name"
            value={auditorName}
            onChangeText={setAuditorName}
            editable={!creating}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Auditee Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter auditee name"
            value={auditeeName}
            onChangeText={setAuditeeName}
            editable={!creating}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Audit Scope</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., ISO 45001:2018 - Production area"
            value={auditScope}
            onChangeText={setAuditScope}
            editable={!creating}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Audit Criteria</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Clauses 4-10"
            value={auditCriteria}
            onChangeText={setAuditCriteria}
            editable={!creating}
          />
        </View>

        <TouchableOpacity
          style={[styles.createButton, creating && styles.createButtonDisabled]}
          onPress={handleCreateAudit}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Create Audit</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
  },
  dropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  dropdownItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  radioContainer: {
    marginRight: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#3B82F6',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
  },
  dropdownItemContent: {
    flex: 1,
  },
  dropdownItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  dropdownItemNameSelected: {
    color: '#1F2937',
  },
  dropdownItemDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  createButton: {
    flexDirection: 'row',
    backgroundColor: '#3B82F6',
    marginHorizontal: 16,
    marginVertical: 24,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
