import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  Image,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth, API_URL } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

interface Evidence {
  type: string;
  filename: string;
  data: string;
  timestamp: string;
}

interface Response {
  question_id: string;
  clause_no: string;
  observations: string;
  conformance: string;
  evidence: Evidence[];
}

interface Question {
  id: string;
  question_text: string;
  order: number;
}

interface SubClause {
  clause_no: string;
  title: string;
  questions: Question[];
}

interface Clause {
  clause_no: string;
  title: string;
  subclauses: SubClause[];
}

interface Questionnaire {
  id: string;
  name: string;
  clauses: Clause[];
}

interface Audit {
  id: string;
  title: string;
  questionnaire_id: string;
  questionnaire_name: string;
  status: string;
  responses: Response[];
}

export default function AuditScreen() {
  const { id } = useLocalSearchParams();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [responses, setResponses] = useState<Map<string, Response>>(new Map());
  const [expandedClauses, setExpandedClauses] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchAudit();
    requestPermissions();
  }, [id]);

  const requestPermissions = async () => {
    await ImagePicker.requestCameraPermissionsAsync();
    await ImagePicker.requestMediaLibraryPermissionsAsync();
    await Audio.requestPermissionsAsync();
  };

  const fetchAudit = async () => {
    try {
      const auditResponse = await axios.get(
        `${API_URL}/api/audits/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const auditData = auditResponse.data;
      setAudit(auditData);

      // Fetch questionnaire details
      const questionnaireResponse = await axios.get(
        `${API_URL}/api/questionnaires/${auditData.questionnaire_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setQuestionnaire(questionnaireResponse.data);

      // Load existing responses
      const responsesMap = new Map<string, Response>();
      auditData.responses.forEach((response: Response) => {
        responsesMap.set(response.question_id, response);
      });
      setResponses(responsesMap);
    } catch (error) {
      console.error('Error fetching audit:', error);
      Alert.alert('Error', 'Failed to load audit');
    } finally {
      setLoading(false);
    }
  };

  const toggleClause = (clauseNo: string) => {
    const newExpanded = new Set(expandedClauses);
    if (newExpanded.has(clauseNo)) {
      newExpanded.delete(clauseNo);
    } else {
      newExpanded.add(clauseNo);
    }
    setExpandedClauses(newExpanded);
  };

  const openQuestionModal = (question: Question, clauseNo: string) => {
    setSelectedQuestion({ ...question, clause_no: clauseNo } as any);
    setShowQuestionModal(true);
  };

  const getResponse = (questionId: string): Response => {
    return responses.get(questionId) || {
      question_id: questionId,
      clause_no: '',
      observations: '',
      conformance: '',
      evidence: [],
    };
  };

  const updateResponse = (questionId: string, updates: Partial<Response>) => {
    const current = getResponse(questionId);
    const updated = { ...current, ...updates };
    const newResponses = new Map(responses);
    newResponses.set(questionId, updated);
    setResponses(newResponses);
  };

  const handleSave = async () => {
    // Don't allow saving if already completed
    if (audit?.status === 'completed') {
      if (Platform.OS === 'web') {
        alert('This audit is already completed. No changes can be saved.');
      } else {
        Alert.alert('Info', 'This audit is already completed. No changes can be saved.');
      }
      return;
    }

    setSaving(true);
    try {
      const responsesArray = Array.from(responses.values());
      const newStatus = audit?.status === 'draft' ? 'in-progress' : audit?.status;
      
      await axios.put(
        `${API_URL}/api/audits/${id}`,
        {
          responses: responsesArray,
          status: newStatus,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Update local audit state
      if (audit) {
        setAudit({ ...audit, status: newStatus });
      }
      
      if (Platform.OS === 'web') {
        alert('✅ Audit progress saved successfully!');
      } else {
        Alert.alert('Success', 'Audit progress saved successfully');
      }
    } catch (error) {
      console.error('Error saving audit:', error);
      if (Platform.OS === 'web') {
        alert('Failed to save audit. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to save audit');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    // Check if audit is 100% complete
    if (!questionnaire) return;
    
    let totalQuestions = 0;
    let answeredQuestions = 0;

    questionnaire.clauses.forEach((clause) => {
      clause.subclauses.forEach((subclause) => {
        totalQuestions += subclause.questions.length;
        subclause.questions.forEach((question) => {
          const response = responses.get(question.id);
          if (response && (response.observations || response.conformance || response.evidence.length > 0)) {
            answeredQuestions++;
          }
        });
      });
    });

    const completionPercentage = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;

    // If not 100% complete, show error and don't complete
    if (completionPercentage < 100) {
      if (Platform.OS === 'web') {
        alert(`Cannot complete audit. Only ${completionPercentage}% complete.\n\nPlease answer all ${totalQuestions} questions before completing.\nAnswered: ${answeredQuestions}/${totalQuestions}`);
      } else {
        Alert.alert(
          'Incomplete Audit',
          `Only ${completionPercentage}% complete.\n\nPlease answer all ${totalQuestions} questions before completing.\nAnswered: ${answeredQuestions}/${totalQuestions}`,
          [{ text: 'OK' }]
        );
      }
      return;
    }

    // Use Platform to check if we're on web or mobile
    const confirmComplete = Platform.OS === 'web' 
      ? window.confirm('Mark this audit as completed? (100% complete)')
      : await new Promise((resolve) => {
          Alert.alert(
            'Complete Audit',
            'Mark this audit as completed? (100% complete)',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Complete', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmComplete) return;

    setSaving(true);
    try {
      const responsesArray = Array.from(responses.values());
      await axios.put(
        `${API_URL}/api/audits/${id}`,
        {
          responses: responsesArray,
          status: 'completed',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (Platform.OS === 'web') {
        alert('✅ Audit completed successfully!');
        router.replace('/(tabs)/audits');
      } else {
        Alert.alert('Success', 'Audit completed successfully', [
          { text: 'OK', onPress: () => router.replace('/(tabs)/audits') },
        ]);
      }
    } catch (error) {
      console.error('Error completing audit:', error);
      if (Platform.OS === 'web') {
        alert('Failed to complete audit. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to complete audit');
      }
    } finally {
      setSaving(false);
    }
  };

  const addPhotoFromCamera = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64 && selectedQuestion) {
        const currentResponse = getResponse(selectedQuestion.id);
        const newEvidence: Evidence = {
          type: 'photo',
          filename: `photo_${Date.now()}.jpg`,
          data: result.assets[0].base64,
          timestamp: new Date().toISOString(),
        };
        updateResponse(selectedQuestion.id, {
          ...currentResponse,
          evidence: [...currentResponse.evidence, newEvidence],
        });
        Alert.alert('Success', 'Photo added');
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const addPhotoFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64 && selectedQuestion) {
        const currentResponse = getResponse(selectedQuestion.id);
        const newEvidence: Evidence = {
          type: 'photo',
          filename: `photo_${Date.now()}.jpg`,
          data: result.assets[0].base64,
          timestamp: new Date().toISOString(),
        };
        updateResponse(selectedQuestion.id, {
          ...currentResponse,
          evidence: [...currentResponse.evidence, newEvidence],
        });
        Alert.alert('Success', 'Photo added');
      }
    } catch (error) {
      console.error('Error selecting photo:', error);
      Alert.alert('Error', 'Failed to select photo');
    }
  };

  const addDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && selectedQuestion) {
        let base64 = '';
        
        // Platform-specific base64 conversion
        if (Platform.OS === 'web') {
          // For web, use fetch to get the file
          try {
            const response = await fetch(result.assets[0].uri);
            const blob = await response.blob();
            base64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64String = reader.result as string;
                // Remove data:*/*;base64, prefix
                resolve(base64String.split(',')[1]);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch (err) {
            console.error('Web file read error:', err);
            if (Platform.OS === 'web') {
              alert('Failed to read document. Please try again.');
            } else {
              Alert.alert('Error', 'Failed to read document');
            }
            return;
          }
        } else {
          // For mobile, use FileSystem
          base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }
        
        const currentResponse = getResponse(selectedQuestion.id);
        const newEvidence: Evidence = {
          type: 'document',
          filename: result.assets[0].name,
          data: base64,
          timestamp: new Date().toISOString(),
        };
        updateResponse(selectedQuestion.id, {
          ...currentResponse,
          evidence: [...currentResponse.evidence, newEvidence],
        });
        
        if (Platform.OS === 'web') {
          alert('✅ Document added successfully!');
        } else {
          Alert.alert('Success', 'Document added');
        }
      }
    } catch (error) {
      console.error('Error selecting document:', error);
      if (Platform.OS === 'web') {
        alert('Failed to select document. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to select document');
      }
    }
  };

  const startRecording = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording || !selectedQuestion) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (uri) {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const currentResponse = getResponse(selectedQuestion.id);
        const newEvidence: Evidence = {
          type: 'audio',
          filename: `audio_${Date.now()}.m4a`,
          data: base64,
          timestamp: new Date().toISOString(),
        };
        updateResponse(selectedQuestion.id, {
          ...currentResponse,
          evidence: [...currentResponse.evidence, newEvidence],
        });
        Alert.alert('Success', 'Audio recording added');
      }
      setRecording(null);
    } catch (error) {
      console.error('Failed to stop recording', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const recordVideo = async () => {
    try {
      // On web, video recording from camera is not well supported
      // So we'll use video picker instead
      let result;
      
      if (Platform.OS === 'web') {
        // On web, pick from library
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          quality: 0.3,
        });
      } else {
        // On mobile, record video
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          videoMaxDuration: 60,
          quality: 0.3,
        });
      }

      if (!result.canceled && selectedQuestion) {
        let base64 = '';
        
        // Platform-specific base64 conversion
        if (Platform.OS === 'web') {
          try {
            const response = await fetch(result.assets[0].uri);
            const blob = await response.blob();
            base64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64String = reader.result as string;
                resolve(base64String.split(',')[1]);
              };
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch (err) {
            console.error('Web video read error:', err);
            alert('Failed to read video. Video files may be too large. Please try a shorter video.');
            return;
          }
        } else {
          base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }
        
        const currentResponse = getResponse(selectedQuestion.id);
        const newEvidence: Evidence = {
          type: 'video',
          filename: `video_${Date.now()}.mp4`,
          data: base64,
          timestamp: new Date().toISOString(),
        };
        updateResponse(selectedQuestion.id, {
          ...currentResponse,
          evidence: [...currentResponse.evidence, newEvidence],
        });
        
        if (Platform.OS === 'web') {
          alert('✅ Video added successfully!');
        } else {
          Alert.alert('Success', 'Video added');
        }
      }
    } catch (error) {
      console.error('Error with video:', error);
      if (Platform.OS === 'web') {
        alert('Failed to add video. Please try again with a smaller file.');
      } else {
        Alert.alert('Error', 'Failed to record video');
      }
    }
  };

  const removeEvidence = (index: number) => {
    if (!selectedQuestion) return;
    
    const confirmRemove = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to remove this evidence?')
      : true;

    if (confirmRemove) {
      if (Platform.OS !== 'web') {
        Alert.alert(
          'Remove Evidence',
          'Are you sure you want to remove this evidence?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: () => {
                const currentResponse = getResponse(selectedQuestion.id);
                const newEvidence = [...currentResponse.evidence];
                newEvidence.splice(index, 1);
                updateResponse(selectedQuestion.id, {
                  ...currentResponse,
                  evidence: newEvidence,
                });
              },
            },
          ]
        );
      } else {
        const currentResponse = getResponse(selectedQuestion.id);
        const newEvidence = [...currentResponse.evidence];
        newEvidence.splice(index, 1);
        updateResponse(selectedQuestion.id, {
          ...currentResponse,
          evidence: newEvidence,
        });
      }
    }
  };

  const getProgressPercentage = () => {
    if (!questionnaire) return 0;
    let totalQuestions = 0;
    let answeredQuestions = 0;

    questionnaire.clauses.forEach((clause) => {
      clause.subclauses.forEach((subclause) => {
        totalQuestions += subclause.questions.length;
        subclause.questions.forEach((question) => {
          const response = responses.get(question.id);
          if (response && (response.observations || response.conformance)) {
            answeredQuestions++;
          }
        });
      });
    });

    return totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
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

  if (!audit || !questionnaire) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text>Audit not found</Text>
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
        <Text style={styles.headerTitle} numberOfLines={1}>
          {audit.title}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.progressBar}>
        <View style={styles.progressBarBg}>
          <View
            style={[styles.progressBarFill, { width: `${getProgressPercentage()}%` }]}
          />
        </View>
        <Text style={styles.progressText}>{getProgressPercentage()}% Complete</Text>
      </View>

      <ScrollView style={styles.content}>
        {questionnaire.clauses.map((clause) => (
          <View key={clause.clause_no} style={styles.clauseContainer}>
            <TouchableOpacity
              style={styles.clauseHeader}
              onPress={() => toggleClause(clause.clause_no)}
            >
              <View style={styles.clauseTitleContainer}>
                <View style={styles.clauseBadge}>
                  <Text style={styles.clauseNumber}>{clause.clause_no}</Text>
                </View>
                <Text style={styles.clauseTitle} numberOfLines={2}>
                  {clause.title}
                </Text>
              </View>
              <Ionicons
                name={
                  expandedClauses.has(clause.clause_no)
                    ? 'chevron-up'
                    : 'chevron-down'
                }
                size={20}
                color="#6B7280"
              />
            </TouchableOpacity>

            {expandedClauses.has(clause.clause_no) && (
              <View style={styles.subclausesContainer}>
                {clause.subclauses.map((subclause) => (
                  <View key={subclause.clause_no} style={styles.subclauseContainer}>
                    <Text style={styles.subclauseTitle}>
                      {subclause.clause_no} - {subclause.title}
                    </Text>
                    {subclause.questions.map((question) => {
                      const response = getResponse(question.id);
                      const hasResponse = response.observations || response.conformance || response.evidence.length > 0;
                      return (
                        <TouchableOpacity
                          key={question.id}
                          style={[
                            styles.questionCard,
                            hasResponse && styles.questionCardAnswered,
                          ]}
                          onPress={() => openQuestionModal(question, subclause.clause_no)}
                        >
                          <Text style={styles.questionText}>{question.question_text}</Text>
                          <View style={styles.questionFooter}>
                            {response.conformance && (
                              <View style={styles.conformanceBadge}>
                                <Text style={styles.conformanceText}>
                                  {response.conformance}
                                </Text>
                              </View>
                            )}
                            {response.evidence.length > 0 && (
                              <View style={styles.evidenceBadge}>
                                <Ionicons name="attach" size={12} color="#6B7280" />
                                <Text style={styles.evidenceCount}>
                                  {response.evidence.length}
                                </Text>
                              </View>
                            )}
                            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottomBar}>
        {audit?.status === 'completed' ? (
          <View style={styles.completedBanner}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981" />
            <Text style={styles.completedBannerText}>
              This audit is completed. No further changes can be made.
            </Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.saveButton, saving && styles.buttonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save Progress'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.completeButton, saving && styles.buttonDisabled]}
              onPress={handleComplete}
              disabled={saving}
            >
              <Text style={styles.completeButtonText}>Complete</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Question Modal */}
      <Modal
        visible={showQuestionModal}
        animationType="slide"
        onRequestClose={() => setShowQuestionModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowQuestionModal(false)}>
              <Ionicons name="close" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Question Response</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedQuestion && (
              <>
                <Text style={styles.modalQuestionText}>
                  {selectedQuestion.question_text}
                </Text>

                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Conformance Status</Text>
                  <View style={styles.conformanceButtons}>
                    {['M', 'Mi', 'C'].map((conf) => (
                      <TouchableOpacity
                        key={conf}
                        style={[
                          styles.conformanceButton,
                          getResponse(selectedQuestion.id).conformance === conf &&
                            styles.conformanceButtonActive,
                        ]}
                        onPress={() =>
                          updateResponse(selectedQuestion.id, {
                            ...getResponse(selectedQuestion.id),
                            conformance: conf,
                            clause_no: (selectedQuestion as any).clause_no,
                          })
                        }
                      >
                        <Text
                          style={[
                            styles.conformanceButtonText,
                            getResponse(selectedQuestion.id).conformance === conf &&
                              styles.conformanceButtonTextActive,
                          ]}
                        >
                          {conf === 'M' ? 'Meets' : conf === 'Mi' ? 'Minor' : 'Major'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Observations</Text>
                  <TextInput
                    style={styles.textArea}
                    placeholder="Enter your observations..."
                    value={getResponse(selectedQuestion.id).observations}
                    onChangeText={(text) =>
                      updateResponse(selectedQuestion.id, {
                        ...getResponse(selectedQuestion.id),
                        observations: text,
                        clause_no: (selectedQuestion as any).clause_no,
                      })
                    }
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalLabel}>Evidence</Text>
                  <View style={styles.evidenceButtonsContainer}>
                    <TouchableOpacity
                      style={styles.evidenceButton}
                      onPress={addPhotoFromCamera}
                    >
                      <Ionicons name="camera" size={24} color="#3B82F6" />
                      <Text style={styles.evidenceButtonLabel}>Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.evidenceButton}
                      onPress={addPhotoFromGallery}
                    >
                      <Ionicons name="image" size={24} color="#3B82F6" />
                      <Text style={styles.evidenceButtonLabel}>Gallery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.evidenceButton}
                      onPress={addDocument}
                    >
                      <Ionicons name="document" size={24} color="#3B82F6" />
                      <Text style={styles.evidenceButtonLabel}>Document</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.evidenceButton}
                      onPress={isRecording ? stopRecording : startRecording}
                    >
                      <Ionicons
                        name={isRecording ? 'stop-circle' : 'mic'}
                        size={24}
                        color={isRecording ? '#EF4444' : '#3B82F6'}
                      />
                      <Text style={styles.evidenceButtonLabel}>
                        {isRecording ? 'Stop' : 'Audio'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.evidenceButton}
                      onPress={recordVideo}
                    >
                      <Ionicons name="videocam" size={24} color="#3B82F6" />
                      <Text style={styles.evidenceButtonLabel}>Video</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.evidenceList}>
                    {getResponse(selectedQuestion.id).evidence.map((ev, index) => (
                      <View key={index} style={styles.evidenceItem}>
                        <View style={styles.evidenceInfo}>
                          <Ionicons
                            name={
                              ev.type === 'photo'
                                ? 'image'
                                : ev.type === 'document'
                                ? 'document'
                                : ev.type === 'audio'
                                ? 'musical-notes'
                                : 'videocam'
                            }
                            size={20}
                            color="#6B7280"
                          />
                          <Text style={styles.evidenceFilename} numberOfLines={1}>
                            {ev.filename}
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => removeEvidence(index)}>
                          <Ionicons name="trash-outline" size={20} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowQuestionModal(false)}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={() => {
                setShowQuestionModal(false);
                Alert.alert('Saved', 'Response saved. Remember to tap "Save Progress" at the bottom to save the audit.');
              }}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.modalSaveButtonText}>Save & Close</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
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
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  placeholder: {
    width: 40,
  },
  progressBar: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  clauseContainer: {
    backgroundColor: '#FFFFFF',
    marginBottom: 8,
    marginHorizontal: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  clauseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#F9FAFB',
  },
  clauseTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  clauseBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 12,
    minWidth: 40,
    alignItems: 'center',
  },
  clauseNumber: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  clauseTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  subclausesContainer: {
    padding: 16,
  },
  subclauseContainer: {
    marginBottom: 16,
  },
  subclauseTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  questionCard: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  questionCardAnswered: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  questionText: {
    fontSize: 13,
    color: '#1F2937',
    marginBottom: 8,
    lineHeight: 18,
  },
  questionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  conformanceBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  conformanceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  evidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  evidenceCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginLeft: 4,
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
  },
  completeButton: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  completeButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  completedBanner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  completedBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalQuestionText: {
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 22,
    marginBottom: 24,
    fontWeight: '500',
  },
  modalSection: {
    marginBottom: 24,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  conformanceButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  conformanceButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  conformanceButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  conformanceButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  conformanceButtonTextActive: {
    color: '#FFFFFF',
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  evidenceButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  evidenceButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minWidth: 70,
  },
  evidenceButtonLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  evidenceList: {
    gap: 8,
  },
  evidenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
  },
  evidenceInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  evidenceFilename: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
  },
  modalFooter: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalSaveButton: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalSaveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
