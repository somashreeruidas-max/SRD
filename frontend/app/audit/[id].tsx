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
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { exportHtmlAsPdf } from '../../utils/exportPdf';

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
  audit_id?: string;
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
  const [downloading, setDownloading] = useState(false);
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
    // Allow saving even if completed - auditor can always make changes
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

  const handleDeleteAudit = async () => {
    const confirmDelete = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to delete this audit? This cannot be undone.')
      : await new Promise((resolve) => {
          Alert.alert(
            'Delete Audit',
            'Are you sure you want to delete this audit? This cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmDelete) return;

    setSaving(true);
    try {
      await axios.delete(`${API_URL}/api/audits/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (Platform.OS === 'web') {
        alert('✅ Audit deleted successfully!');
        router.replace('/(tabs)/audits');
      } else {
        Alert.alert('Success', 'Audit deleted successfully', [
          { text: 'OK', onPress: () => router.replace('/(tabs)/audits') },
        ]);
      }
    } catch (error) {
      console.error('Error deleting audit:', error);
      if (Platform.OS === 'web') {
        alert('Failed to delete audit. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to delete audit');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadFindings = async () => {
    if (!audit || !questionnaire) return;

    // Filter only findings (Minor and Major non-conformances)
    const findings: Array<{
      clause: string;
      subclause: string;
      question: string;
      conformance: string;
      observations: string;
      evidence: Evidence[];
    }> = [];

    questionnaire.clauses.forEach((clause) => {
      clause.subclauses.forEach((subclause) => {
        subclause.questions.forEach((question) => {
          const response = responses.get(question.id);
          if (response && (response.conformance === 'Mi' || response.conformance === 'MA' || response.conformance === 'C')) {
            findings.push({
              clause: `${clause.clause_no} - ${clause.title}`,
              subclause: `${subclause.clause_no} - ${subclause.title}`,
              question: question.question_text,
              conformance: response.conformance,
              observations: response.observations || 'No observations recorded',
              evidence: response.evidence || [],
            });
          }
        });
      });
    });

    if (findings.length === 0) {
      if (Platform.OS === 'web') {
        alert('No findings to report! This audit has no non-conformances.');
      } else {
        Alert.alert('No Findings', 'This audit has no non-conformances to report.');
      }
      return;
    }

    // Generate HTML for findings summary
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #1F2937; text-align: center; border-bottom: 3px solid #EF4444; padding-bottom: 10px; }
          .header-info { background: #F3F4F6; padding: 15px; margin: 20px 0; border-radius: 8px; }
          .header-info p { margin: 5px 0; }
          .summary-stats { background: #FEF3C7; padding: 15px; margin: 20px 0; border-radius: 8px; border: 2px solid #F59E0B; }
          .summary-stats p { margin: 5px 0; font-weight: bold; }
          .finding { margin: 20px 0; padding: 15px; border-radius: 8px; page-break-inside: avoid; }
          .finding-minor { background: #FEF3C7; border-left: 5px solid #F59E0B; }
          .finding-major { background: #FEE2E2; border-left: 5px solid #DC2626; }
          .finding-header { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
          .finding-header-minor { color: #92400E; }
          .finding-header-major { color: #991B1B; }
          .finding-badge { display: inline-block; padding: 5px 10px; border-radius: 4px; font-weight: bold; font-size: 12px; margin-right: 10px; }
          .badge-minor { background: #F59E0B; color: white; }
          .badge-major { background: #DC2626; color: white; }
          .clause-info { color: #6B7280; font-size: 13px; margin-bottom: 10px; font-style: italic; }
          .question { font-weight: bold; color: #374151; margin: 10px 0; font-size: 15px; }
          .observations { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
          .observations-label { font-weight: bold; color: #374151; margin-bottom: 5px; }
          .observations-text { color: #1F2937; line-height: 1.6; }
          .evidence { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
          .evidence-label { font-weight: bold; color: #374151; margin-bottom: 5px; }
          .evidence-list { list-style: none; padding: 0; }
          .evidence-item { padding: 5px 0; color: #1F2937; }
          .evidence-icon { margin-right: 5px; }
          .footer { margin-top: 40px; text-align: center; color: #6B7280; font-size: 12px; border-top: 2px solid #E5E7EB; padding-top: 20px; }
        </style>
      </head>
      <body>
        <h1>🔍 AUDIT FINDINGS SUMMARY REPORT</h1>
        
        <div class="header-info">
          <p><strong>Audit Title:</strong> ${audit.title}</p>
          ${audit.audit_id ? `<p><strong>Audit ID:</strong> ${audit.audit_id}</p>` : ''}
          <p><strong>Standard:</strong> ${audit.questionnaire_name}</p>
          <p><strong>Status:</strong> ${audit.status.toUpperCase()}</p>
          <p><strong>Date:</strong> ${new Date(audit.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          ${audit.plant_name ? `<p><strong>Plant Name:</strong> ${audit.plant_name}</p>` : ''}
          ${audit.auditor_name ? `<p><strong>Auditor:</strong> ${audit.auditor_name}</p>` : ''}
          ${audit.auditee_name ? `<p><strong>Auditee:</strong> ${audit.auditee_name}</p>` : ''}
        </div>

        <div class="summary-stats">
          <p>📊 Total Findings: ${findings.length}</p>
          <p>⚠️ Minor Non-Conformances: ${findings.filter(f => f.conformance === 'Mi').length}</p>
          <p>❌ Major Non-Conformances: ${findings.filter(f => f.conformance === 'Ma' || f.conformance === 'MA').length}</p>
        </div>

        <h2 style="color: #1F2937; margin-top: 30px;">Detailed Findings:</h2>
    `;

    findings.forEach((finding, index) => {
      const isMajor = (finding.conformance === 'Ma' || finding.conformance === 'MA');
      const badgeClass = isMajor ? 'badge-major' : 'badge-minor';
      const findingClass = isMajor ? 'finding-major' : 'finding-minor';
      const headerClass = isMajor ? 'finding-header-major' : 'finding-header-minor';
      const badgeText = isMajor ? 'MAJOR NON-CONFORMANCE' : 'MINOR NON-CONFORMANCE';

      htmlContent += `
        <div class="finding ${findingClass}">
          <div class="finding-header ${headerClass}">
            <span class="finding-badge ${badgeClass}">${badgeText}</span>
            Finding #${index + 1}
          </div>
          
          <div class="clause-info">
            <strong>Clause:</strong> ${finding.clause}<br>
            <strong>Subclause:</strong> ${finding.subclause}
          </div>

          <div class="question">
            <strong>Question:</strong> ${finding.question}
          </div>

          <div class="observations">
            <div class="observations-label">📝 Observations:</div>
            <div class="observations-text">${finding.observations}</div>
          </div>

          ${finding.evidence.length > 0 ? `
            <div class="evidence">
              <div class="evidence-label">📎 Evidence Attached (${finding.evidence.length} file(s)):</div>
              <ul class="evidence-list">
                ${finding.evidence.map(ev => `
                  <li class="evidence-item">
                    <span class="evidence-icon">
                      ${ev.type === 'photo' ? '📷' : ev.type === 'document' ? '📄' : ev.type === 'audio' ? '🎤' : '🎥'}
                    </span>
                    ${ev.filename} - ${new Date(ev.timestamp).toLocaleString()}
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : '<div class="evidence"><em>No evidence attached</em></div>'}
        </div>
      `;
    });

    htmlContent += `
        <div class="footer">
          <p><strong>End of Findings Summary Report</strong></p>
          <p>Generated on ${new Date().toLocaleString('en-US')}</p>
          <p>${audit.questionnaire_name} - ${audit.plant_name || 'Internal Audit'}</p>
          <p style="margin-top: 10px; font-style: italic;">
            ⚠️ This report contains only non-conformances (Minor and Major findings).<br>
            For complete audit details, please refer to the full audit report.
          </p>
        </div>
      </body>
      </html>
    `;

    try {
      await exportHtmlAsPdf(
        htmlContent,
        `Findings_Summary_${audit.title.replace(/[^a-z0-9]/gi, '_')}`,
        'Save or Share Findings Summary'
      );
    } catch (error) {
      console.error('Error generating findings summary:', error);
      if (Platform.OS === 'web') {
        alert('Failed to generate findings summary. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to generate findings summary');
      }
    }
  };

  const handleDownloadTextReport = async () => {
    if (!audit || !questionnaire) return;
    
    // Prevent multiple simultaneous downloads
    if (downloading) {
      console.log('Download already in progress, ignoring duplicate call');
      return;
    }
    
    setDownloading(true);
    
    // Generate comprehensive text report
    let textContent = '';
    
    // Header Section
    textContent += '═══════════════════════════════════════════════════════════════════════════\n';
    textContent += '                    INTERNAL AUDIT REPORT - COMPLETE                       \n';
    textContent += '═══════════════════════════════════════════════════════════════════════════\n\n';
    
    // Audit Information
    textContent += 'AUDIT INFORMATION\n';
    textContent += '─────────────────────────────────────────────────────────────────────────\n';
    if (audit.audit_id) textContent += `Audit ID          : ${audit.audit_id}\n`;
    textContent += `Audit Title       : ${audit.title}\n`;
    textContent += `Standard          : ${audit.questionnaire_name}\n`;
    textContent += `Status            : ${audit.status.toUpperCase()}\n`;
    textContent += `Created Date      : ${new Date(audit.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}\n`;
    textContent += `Plant/Company     : ${audit.plant_name || 'Not specified'}\n`;
    textContent += `Auditor Name      : ${audit.auditor_name || 'Not specified'}\n`;
    textContent += `Auditee Name      : ${audit.auditee_name || 'Not specified'}\n`;
    if (audit.scope_of_audit) textContent += `Scope of Audit    : ${audit.scope_of_audit}\n`;
    if (audit.audit_criteria) textContent += `Audit Criteria    : ${audit.audit_criteria}\n`;
    textContent += '\n';

    // Statistics
    let totalQuestions = 0;
    let answeredQuestions = 0;
    let meetsCount = 0;
    let minorCount = 0;
    let majorCount = 0;

    questionnaire.clauses.forEach((clause) => {
      clause.subclauses.forEach((subclause) => {
        totalQuestions += subclause.questions.length;
        subclause.questions.forEach((question) => {
          const response = responses.get(question.id);
          if (response && response.conformance) {
            answeredQuestions++;
            // Support both new codes (C, Mi, Ma) and old codes (M, CO, MA) for backward compatibility
            if (response.conformance === 'C' || response.conformance === 'CO' || response.conformance === 'M') {
              meetsCount++;
            }
            else if (response.conformance === 'Mi') {
              minorCount++;
            }
            else if (response.conformance === 'Ma' || response.conformance === 'MA') {
              majorCount++;
            }
          }
        });
      });
    });

    const completionRate = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
    const totalClauses = questionnaire.clauses.length;
    const totalSubclauses = questionnaire.clauses.reduce((sum, clause) => sum + clause.subclauses.length, 0);

    textContent += 'AUDIT STATISTICS\n';
    textContent += '─────────────────────────────────────────────────────────────────────────\n';
    textContent += `Total Clauses          : ${totalClauses}\n`;
    textContent += `Total Subclauses       : ${totalSubclauses}\n`;
    textContent += `Total Questions        : ${totalQuestions}\n`;
    textContent += `Answered Questions     : ${answeredQuestions}\n`;
    textContent += `Completion Rate        : ${completionRate}%\n`;
    textContent += `\n`;
    textContent += `CONFORMANCE SUMMARY:\n`;
    textContent += `  ✓ Compliant (C)             : ${meetsCount}\n`;
    textContent += `  ⚠ Minor NC (Mi)             : ${minorCount}\n`;
    textContent += `  ✗ Major NC (Ma)             : ${majorCount}\n`;
    textContent += `  Total Answered              : ${meetsCount + minorCount + majorCount}\n`;
    textContent += '\n\n';

    // Detailed Audit Content
    textContent += '═══════════════════════════════════════════════════════════════════════════\n';
    textContent += '                         DETAILED AUDIT RESULTS                            \n';
    textContent += '═══════════════════════════════════════════════════════════════════════════\n\n';

    questionnaire.clauses.forEach((clause, clauseIndex) => {
      textContent += `\n${'═'.repeat(75)}\n`;
      textContent += `CLAUSE ${clause.clause_no}: ${clause.title.toUpperCase()}\n`;
      textContent += `${'═'.repeat(75)}\n\n`;

      clause.subclauses.forEach((subclause, subclauseIndex) => {
        textContent += `\n${'-'.repeat(75)}\n`;
        textContent += `${subclause.clause_no} - ${subclause.title}\n`;
        textContent += `${'-'.repeat(75)}\n\n`;

        subclause.questions.forEach((question, qIndex) => {
          const response = responses.get(question.id);
          
          textContent += `[Q${qIndex + 1}] ${question.question_text}\n\n`;
          
          if (response && response.conformance) {
            let conformanceStatus = '';
            let conformanceSymbol = '';
            
            if (response.conformance === 'C' || response.conformance === 'CO' || response.conformance === 'M') {
              conformanceStatus = 'COMPLIANT';
              conformanceSymbol = '✓';
            } else if (response.conformance === 'Mi') {
              conformanceStatus = '⚠ MINOR NON-CONFORMANCE';
              conformanceSymbol = '⚠';
            } else if (response.conformance === 'Ma' || response.conformance === 'MA') {
              conformanceStatus = '✗ MAJOR NON-CONFORMANCE';
              conformanceSymbol = '✗';
            }
            
            textContent += `    Conformance: ${conformanceSymbol} ${conformanceStatus}\n\n`;
            
            if (response.observations) {
              textContent += `    Observations:\n`;
              textContent += `    ${response.observations.split('\n').join('\n    ')}\n\n`;
            } else {
              textContent += `    Observations: No observations recorded\n\n`;
            }
            
            if (response.evidence && response.evidence.length > 0) {
              textContent += `    Evidence Attached: ${response.evidence.length} file(s)\n`;
              response.evidence.forEach((ev, evIndex) => {
                const typeIcon = ev.type === 'photo' ? '📷' : ev.type === 'document' ? '📄' : ev.type === 'audio' ? '🎤' : '🎥';
                textContent += `      ${evIndex + 1}. ${typeIcon} ${ev.filename} (${new Date(ev.timestamp).toLocaleString()})\n`;
              });
              textContent += '\n';
            } else {
              textContent += `    Evidence: No evidence attached\n\n`;
            }
          } else {
            textContent += `    Status: NOT ANSWERED\n\n`;
          }
          
          textContent += `    ${'.'.repeat(71)}\n\n`;
        });
      });
    });

    // Findings Summary Section
    const findings: Array<{
      clause: string;
      subclause: string;
      question: string;
      conformance: string;
      observations: string;
      evidence: Evidence[];
    }> = [];

    questionnaire.clauses.forEach((clause) => {
      clause.subclauses.forEach((subclause) => {
        subclause.questions.forEach((question) => {
          const response = responses.get(question.id);
          if (response && (response.conformance === 'Mi' || response.conformance === 'MA' || response.conformance === 'C')) {
            findings.push({
              clause: `${clause.clause_no} - ${clause.title}`,
              subclause: `${subclause.clause_no} - ${subclause.title}`,
              question: question.question_text,
              conformance: response.conformance,
              observations: response.observations || 'No observations recorded',
              evidence: response.evidence || [],
            });
          }
        });
      });
    });

    if (findings.length > 0) {
      textContent += '\n\n';
      textContent += '═══════════════════════════════════════════════════════════════════════════\n';
      textContent += '                    NON-CONFORMANCES SUMMARY                               \n';
      textContent += '═══════════════════════════════════════════════════════════════════════════\n\n';
      textContent += `Total Findings         : ${findings.length}\n`;
      textContent += `Minor NC (Mi)          : ${findings.filter(f => f.conformance === 'Mi').length}\n`;
      textContent += `Major NC (Ma)          : ${findings.filter(f => f.conformance === 'Ma' || f.conformance === 'MA').length}\n\n`;

      findings.forEach((finding, index) => {
        const isMajor = (finding.conformance === 'Ma' || finding.conformance === 'MA');
        const badge = isMajor ? '✗ MAJOR NON-CONFORMANCE' : '⚠ MINOR NON-CONFORMANCE';
        
        textContent += `\n${'-'.repeat(75)}\n`;
        textContent += `FINDING #${index + 1}: ${badge}\n`;
        textContent += `${'-'.repeat(75)}\n\n`;
        textContent += `Clause    : ${finding.clause}\n`;
        textContent += `Subclause : ${finding.subclause}\n\n`;
        textContent += `Question:\n${finding.question}\n\n`;
        textContent += `Observations:\n${finding.observations.split('\n').join('\n')}\n\n`;
        
        if (finding.evidence.length > 0) {
          textContent += `Evidence (${finding.evidence.length} file(s)):\n`;
          finding.evidence.forEach((ev, evIndex) => {
            const typeIcon = ev.type === 'photo' ? '📷' : ev.type === 'document' ? '📄' : ev.type === 'audio' ? '🎤' : '🎥';
            textContent += `  ${evIndex + 1}. ${typeIcon} ${ev.filename} - ${new Date(ev.timestamp).toLocaleString()}\n`;
          });
        } else {
          textContent += `Evidence: No evidence attached\n`;
        }
        textContent += '\n';
      });
    }

    // Footer
    textContent += '\n';
    textContent += '═══════════════════════════════════════════════════════════════════════════\n';
    textContent += '                           END OF REPORT                                   \n';
    textContent += '═══════════════════════════════════════════════════════════════════════════\n';
    textContent += `Generated on: ${new Date().toLocaleString('en-US')}\n`;
    textContent += `Report Type: Complete Audit Report (Text Format)\n`;
    textContent += `Standard: ${audit.questionnaire_name}\n`;
    textContent += '═══════════════════════════════════════════════════════════════════════════\n';

    // Download the text file
    try {
      if (Platform.OS === 'web') {
        // For web, create and download text file
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Complete_Audit_Report_${audit.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert(`✅ Complete audit report downloaded as text file!\n\nTotal Questions: ${totalQuestions}\nAnswered: ${answeredQuestions} (${completionRate}%)\nFindings: ${findings.length}`);
      } else {
        // For mobile, use expo-sharing
        const fileUri = `${FileSystem.documentDirectory}Complete_Audit_Report_${audit.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.txt`;
        await FileSystem.writeAsStringAsync(fileUri, textContent);
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/plain',
          dialogTitle: 'Save or Share Audit Report',
        });
      }
    } catch (error) {
      console.error('Error generating text report:', error);
      if (Platform.OS === 'web') {
        alert('Failed to generate text report. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to generate text report');
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadCAPA = async () => {
    if (!audit || !questionnaire) return;

    // Filter only findings (Non-conformances)
    const findings: Array<{
      clause: string;
      subclause: string;
      question: string;
      conformance: string;
      observations: string;
      evidence: Evidence[];
    }> = [];

    questionnaire.clauses.forEach((clause) => {
      clause.subclauses.forEach((subclause) => {
        subclause.questions.forEach((question) => {
          const response = responses.get(question.id);
          if (response && (response.conformance === 'Mi' || response.conformance === 'Ma' || response.conformance === 'MA')) {
            findings.push({
              clause: `${clause.clause_no} - ${clause.title}`,
              subclause: `${subclause.clause_no} - ${subclause.title}`,
              question: question.question_text,
              conformance: response.conformance,
              observations: response.observations || '',
              evidence: response.evidence || [],
            });
          }
        });
      });
    });

    if (findings.length === 0) {
      alert('No non-conformances found in this audit. CAPA report is not needed.');
      return;
    }

    // Generate CSV content (Excel-compatible)
    let csvContent = '';
    
    // Header
    csvContent += 'CORRECTIVE ACTION PLAN (CAP) REPORT\n';
    csvContent += `Audit: ${audit.title}\n`;
    if (audit.audit_id) csvContent += `Audit ID: ${audit.audit_id}\n`;
    csvContent += `Standard: ${audit.questionnaire_name}\n`;
    csvContent += `Date: ${new Date(audit.created_at).toLocaleDateString()}\n`;
    csvContent += '\n';
    
    // Column headers
    const headers = [
      'Audit ID',
      'Site Name',
      'Audit Date',
      'Auditor Name',
      'Description of Finding (Requirement, non-conformity and evidence)',
      'Standard and Clause',
      'Category of Finding',
      'Correction to Eliminate the Non-conformity',
      'Analysis of root cause of Non-conformity, Corrective action to Eliminate root cause of non-conformity',
      'Status'
    ];
    
    csvContent += headers.map(h => `"${h}"`).join(',') + '\n';
    
    // Data rows - one for each finding
    findings.forEach((finding) => {
      const isMajor = (finding.conformance === 'Ma' || finding.conformance === 'MA');
      const category = isMajor ? 'Major NC' : 'Minor NC';
      
      const row = [
        audit.audit_id || '',  // Audit ID (auto-filled)
        audit.plant_name || '',  // Site Name (auto-filled)
        new Date(audit.created_at).toLocaleDateString(),  // Audit Date (auto-filled)
        audit.auditor_name || '',  // Auditor Name (auto-filled)
        finding.observations || 'No observations recorded',  // Description - ONLY OBSERVATIONS
        `${audit.questionnaire_name} - ${finding.subclause.split(' - ')[0]}`,  // Standard and Clause (auto-filled)
        category,  // Category (auto-filled)
        '',  // Correction (to be filled by auditee)
        '',  // Root cause analysis (to be filled by auditee)
        'Open'  // Status (default)
      ];
      
      csvContent += row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',') + '\n';
    });

    // Download the CSV file
    try {
      if (Platform.OS === 'web') {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `CAPA_Report_${audit.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        alert(`✅ CAPA Report downloaded!\n\nTotal Non-Conformances: ${findings.length}\nMinor NC: ${findings.filter(f => f.conformance === 'Mi').length}\nMajor NC: ${findings.filter(f => f.conformance === 'Ma' || f.conformance === 'MA').length}\n\nOpen the CSV file in Excel to fill remaining fields.`);
      } else {
        const fileUri = `${FileSystem.documentDirectory}CAPA_Report_${audit.title.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.csv`;
        await FileSystem.writeAsStringAsync(fileUri, csvContent);
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Save or Share CAPA Report',
        });
      }
    } catch (error) {
      console.error('Error generating CAPA report:', error);
      alert('Failed to generate CAPA report. Please try again.');
    }
  };

  const handleDownloadAudit = async () => {
    if (!audit || !questionnaire) return;

    // Generate HTML content for PDF with colors
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #1F2937; text-align: center; border-bottom: 3px solid #3B82F6; padding-bottom: 10px; }
          .header-info { background: #F3F4F6; padding: 15px; margin: 20px 0; border-radius: 8px; }
          .header-info p { margin: 5px 0; }
          .clause { margin: 30px 0; page-break-inside: avoid; }
          .clause-title { background: #3B82F6; color: white; padding: 10px; font-weight: bold; font-size: 18px; }
          .subclause { margin: 15px 0; padding-left: 20px; }
          .subclause-title { font-weight: bold; color: #374151; margin: 10px 0; font-size: 16px; }
          table { width: 100%; border-collapse: collapse; margin: 10px 0; }
          th { background: #E5E7EB; padding: 10px; text-align: left; border: 1px solid #D1D5DB; font-weight: bold; }
          td { padding: 10px; border: 1px solid #D1D5DB; vertical-align: top; }
          .meets { background-color: #D1FAE5; color: #065F46; font-weight: bold; }
          .minor { background-color: #FEF3C7; color: #92400E; font-weight: bold; }
          .major { background-color: #FEE2E2; color: #991B1B; font-weight: bold; }
          .not-answered { background-color: #F3F4F6; color: #6B7280; font-style: italic; }
          .question-cell { width: 60%; }
          .conformance-cell { width: 15%; text-align: center; }
          .observations-cell { width: 25%; }
          .footer { margin-top: 40px; text-align: center; color: #6B7280; font-size: 12px; border-top: 2px solid #E5E7EB; padding-top: 20px; }
        </style>
      </head>
      <body>
        <h1>ISO 45001:2018 INTERNAL AUDIT REPORT</h1>
        
        <div class="header-info">
          <p><strong>Audit Title:</strong> ${audit.title}</p>
          ${audit.audit_id ? `<p><strong>Audit ID:</strong> ${audit.audit_id}</p>` : ''}
          <p><strong>Questionnaire:</strong> ${audit.questionnaire_name}</p>
          <p><strong>Status:</strong> ${audit.status.toUpperCase()}</p>
          <p><strong>Date:</strong> ${new Date(audit.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          ${audit.plant_name ? `<p><strong>Plant Name:</strong> ${audit.plant_name}</p>` : ''}
          ${audit.auditor_name ? `<p><strong>Auditor:</strong> ${audit.auditor_name}</p>` : `<p><strong>Auditor:</strong> ${audit.auditor || 'N/A'}</p>`}
          ${audit.auditee_name ? `<p><strong>Auditee:</strong> ${audit.auditee_name}</p>` : ''}
          ${audit.audit_scope ? `<p><strong>Scope:</strong> ${audit.audit_scope}</p>` : ''}
          ${audit.audit_criteria ? `<p><strong>Criteria:</strong> ${audit.audit_criteria}</p>` : ''}
        </div>
    `;

    questionnaire.clauses.forEach((clause) => {
      htmlContent += `
        <div class="clause">
          <div class="clause-title">CLAUSE ${clause.clause_no}: ${clause.title}</div>
      `;

      clause.subclauses.forEach((subclause) => {
        htmlContent += `
          <div class="subclause">
            <div class="subclause-title">${subclause.clause_no} - ${subclause.title}</div>
            <table>
              <thead>
                <tr>
                  <th class="question-cell">Question</th>
                  <th class="conformance-cell">Conformance</th>
                  <th class="observations-cell">Observations / Evidence</th>
                </tr>
              </thead>
              <tbody>
        `;

        subclause.questions.forEach((question, index) => {
          const response = responses.get(question.id);
          let conformanceClass = 'not-answered';
          let conformanceText = 'Not Answered';

          if (response && response.conformance) {
            if (response.conformance === 'C' || response.conformance === 'CO' || response.conformance === 'M') {
              conformanceClass = 'meets';
              conformanceText = 'COMPLIANT';
            } else if (response.conformance === 'Mi') {
              conformanceClass = 'minor';
              conformanceText = 'MINOR NC';
            } else if (response.conformance === 'Ma' || response.conformance === 'MA') {
              conformanceClass = 'major';
              conformanceText = 'MAJOR NC';
            }
          }

          const observations = response?.observations || 'No observations recorded';
          const evidenceCount = response?.evidence?.length || 0;

          htmlContent += `
            <tr>
              <td class="question-cell">
                <strong>Q${index + 1}.</strong> ${question.question_text}
              </td>
              <td class="conformance-cell ${conformanceClass}">
                ${conformanceText}
              </td>
              <td class="observations-cell">
                ${observations}
                ${evidenceCount > 0 ? `<br><br><em>📎 ${evidenceCount} evidence file(s) attached</em>` : ''}
              </td>
            </tr>
          `;
        });

        htmlContent += `
              </tbody>
            </table>
          </div>
        `;
      });

      htmlContent += `</div>`;
    });

    htmlContent += `
        <div class="footer">
          <p>End of Audit Report - Generated on ${new Date().toLocaleString('en-US')}</p>
          <p>ISO 45001:2018 Occupational Health and Safety Management Systems</p>
        </div>
      </body>
      </html>
    `;

    try {
      await exportHtmlAsPdf(
        htmlContent,
        `Audit_${audit.title.replace(/[^a-z0-9]/gi, '_')}`,
        'Save or Share Audit Report'
      );
    } catch (error) {
      console.error('Error generating PDF:', error);
      if (Platform.OS === 'web') {
        alert('Failed to generate PDF report. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to generate PDF report');
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
          // A question is considered answered if:
          // 1. Response exists AND
          // 2. It has observations (non-empty) OR conformance (non-empty)
          if (response && (response.observations?.trim() || response.conformance?.trim())) {
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
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleDownloadCAPA} style={styles.headerIconButton} title="CAPA Report (CSV)">
            <Ionicons name="clipboard-outline" size={22} color="#8B5CF6" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDownloadTextReport} style={styles.headerIconButton} title="Complete Report (Text)">
            <Ionicons name="document-text" size={22} color="#10B981" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDownloadFindings} style={styles.headerIconButton} title="Findings Only (PDF)">
            <Ionicons name="warning-outline" size={22} color="#F59E0B" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDownloadAudit} style={styles.headerIconButton} title="Full Report (PDF)">
            <Ionicons name="document-outline" size={22} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteAudit} style={styles.headerIconButton} title="Delete Audit">
            <Ionicons name="trash-outline" size={22} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Audit Information Header */}
      <View style={styles.auditInfoHeader}>
        {audit.audit_id && (
          <View style={styles.auditIdRow}>
            <Ionicons name="barcode-outline" size={18} color="#3B82F6" />
            <Text style={styles.auditIdLabel}>Audit ID:</Text>
            <Text style={styles.auditIdValue}>{audit.audit_id}</Text>
          </View>
        )}
        <View style={styles.auditInfoRow}>
          <View style={styles.auditInfoItem}>
            <Ionicons name="business-outline" size={16} color="#6B7280" />
            <Text style={styles.auditInfoLabel}>Plant:</Text>
            <Text style={styles.auditInfoValue}>{audit.plant_name || 'Not specified'}</Text>
          </View>
          <View style={styles.auditInfoItem}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <Text style={styles.auditInfoLabel}>Date:</Text>
            <Text style={styles.auditInfoValue}>
              {new Date(audit.created_at).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              })}
            </Text>
          </View>
        </View>
        <View style={styles.auditInfoRow}>
          <View style={styles.auditInfoItem}>
            <Ionicons name="person-outline" size={16} color="#6B7280" />
            <Text style={styles.auditInfoLabel}>Auditor:</Text>
            <Text style={styles.auditInfoValue}>{audit.auditor_name || 'Not specified'}</Text>
          </View>
          <View style={styles.auditInfoItem}>
            <Ionicons name="people-outline" size={16} color="#6B7280" />
            <Text style={styles.auditInfoLabel}>Auditee:</Text>
            <Text style={styles.auditInfoValue}>{audit.auditee_name || 'Not specified'}</Text>
          </View>
        </View>
      </View>

      {/* Presentable Report Actions */}
      <View style={styles.reportActionsRow}>
        <TouchableOpacity
          style={styles.viewReportBtn}
          onPress={() => router.push(`/audit/report/${id}`)}
        >
          <Ionicons name="easel-outline" size={18} color="#fff" />
          <Text style={styles.reportActionText}>View Report</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.capaActionBtn}
          onPress={() => router.push(`/audit/capa/${id}`)}
        >
          <Ionicons name="construct-outline" size={18} color="#fff" />
          <Text style={styles.reportActionText}>CAPA Report</Text>
        </TouchableOpacity>
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
        {audit?.status === 'completed' && (
          <View style={styles.completedBadge}>
            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            <Text style={styles.completedBadgeText}>Completed Audit</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Text>
        </TouchableOpacity>
        {audit?.status !== 'completed' && (
          <TouchableOpacity
            style={[styles.completeButton, saving && styles.buttonDisabled]}
            onPress={handleComplete}
            disabled={saving}
          >
            <Text style={styles.completeButtonText}>Complete</Text>
          </TouchableOpacity>
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
                    {['C', 'Mi', 'Ma'].map((conf) => (
                      <TouchableOpacity
                        key={conf}
                        style={[
                          styles.conformanceButton,
                          getResponse(selectedQuestion.id).conformance === conf &&
                            styles.conformanceButtonActive,
                          conf === 'C' && styles.conformanceButtonCompliant,
                          conf === 'Mi' && styles.conformanceButtonMinor,
                          conf === 'Ma' && styles.conformanceButtonMajor,
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
                          {conf === 'C' ? 'Compliant' : conf === 'Mi' ? 'Minor NC' : 'Major NC'}
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
                        <TouchableOpacity 
                          style={styles.evidenceInfo}
                          onPress={() => {
                            console.log('Opening evidence:', { type: ev.type, filename: ev.filename, dataLength: ev.data?.length });
                            
                            // Open evidence based on type
                            if (ev.type === 'photo') {
                              // For photos, open in new tab/window with base64 data
                              if (Platform.OS === 'web') {
                                try {
                                  // Check if data has proper format
                                  const imageData = ev.data.startsWith('data:') ? ev.data : `data:image/jpeg;base64,${ev.data}`;
                                  const newWindow = window.open('', '_blank');
                                  if (newWindow) {
                                    newWindow.document.write(`
                                      <html>
                                        <head>
                                          <title>${ev.filename}</title>
                                          <style>
                                            body { margin:0; display:flex; justify-content:center; align-items:center; background:#000; min-height:100vh; }
                                            img { max-width:100%; max-height:100vh; object-fit:contain; }
                                          </style>
                                        </head>
                                        <body>
                                          <img src="${imageData}" alt="${ev.filename}" onerror="document.body.innerHTML='<p style=color:white;>Error loading image</p>'"/>
                                        </body>
                                      </html>
                                    `);
                                    newWindow.document.close();
                                  } else {
                                    alert('Please allow pop-ups to view attachments');
                                  }
                                } catch (error) {
                                  console.error('Error opening photo:', error);
                                  alert('Failed to open photo. Please try again.');
                                }
                              } else {
                                Alert.alert('View Photo', ev.filename);
                              }
                            } else if (ev.type === 'document') {
                              // For documents (PDF, Word, Excel), open or download
                              if (Platform.OS === 'web') {
                                try {
                                  console.log('Opening document:', ev.filename, 'Data length:', ev.data?.length);
                                  
                                  // Check if it's a PDF - can be viewed in browser
                                  const isPDF = ev.filename.toLowerCase().endsWith('.pdf');
                                  
                                  if (isPDF) {
                                    // Prepare PDF data URL
                                    let pdfUrl = ev.data;
                                    
                                    // Add proper data URL prefix if missing
                                    if (!pdfUrl.startsWith('data:')) {
                                      pdfUrl = `data:application/pdf;base64,${pdfUrl}`;
                                    }
                                    
                                    console.log('Opening PDF with data URL format');
                                    
                                    // Try to open PDF directly in new tab
                                    const newWindow = window.open(pdfUrl, '_blank');
                                    
                                    if (!newWindow) {
                                      // If pop-up blocked, try downloading instead
                                      console.log('Pop-up blocked, downloading instead');
                                      const link = document.createElement('a');
                                      link.href = pdfUrl;
                                      link.download = ev.filename;
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                      alert('Pop-ups are blocked. PDF has been downloaded instead. Check your downloads folder.');
                                    }
                                  } else {
                                    // For Word/Excel files, trigger download
                                    // Convert base64 to blob if needed
                                    let downloadUrl = ev.data;
                                    
                                    if (ev.data.startsWith('data:')) {
                                      // Already a data URL, use directly
                                      downloadUrl = ev.data;
                                    } else if (ev.data.startsWith('http')) {
                                      // Already a URL, use directly
                                      downloadUrl = ev.data;
                                    } else {
                                      // Assume it's base64, add proper mime type
                                      const mimeType = ev.filename.toLowerCase().endsWith('.docx') 
                                        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                                        : ev.filename.toLowerCase().endsWith('.doc')
                                        ? 'application/msword'
                                        : ev.filename.toLowerCase().endsWith('.xlsx')
                                        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                                        : ev.filename.toLowerCase().endsWith('.xls')
                                        ? 'application/vnd.ms-excel'
                                        : 'application/octet-stream';
                                      
                                      downloadUrl = `data:${mimeType};base64,${ev.data}`;
                                    }
                                    
                                    const link = document.createElement('a');
                                    link.href = downloadUrl;
                                    link.download = ev.filename;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                    
                                    alert(`Document "${ev.filename}" has been downloaded. Check your downloads folder.`);
                                  }
                                } catch (error) {
                                  console.error('Error opening/downloading document:', error);
                                  alert('Failed to open document. Please try again.');
                                }
                              } else {
                                Alert.alert('Download', `Downloading ${ev.filename}`);
                              }
                            } else if (ev.type === 'audio') {
                              // For audio, play in new window
                              if (Platform.OS === 'web') {
                                try {
                                  const newWindow = window.open('', '_blank');
                                  if (newWindow) {
                                    newWindow.document.write(`
                                      <html>
                                        <head>
                                          <title>${ev.filename}</title>
                                          <style>
                                            body { margin:20px; font-family: Arial, sans-serif; }
                                          </style>
                                        </head>
                                        <body>
                                          <h3>${ev.filename}</h3>
                                          <audio controls autoplay src="${ev.data}">
                                            Your browser does not support audio playback.
                                          </audio>
                                        </body>
                                      </html>
                                    `);
                                    newWindow.document.close();
                                  } else {
                                    alert('Please allow pop-ups to view attachments');
                                  }
                                } catch (error) {
                                  console.error('Error opening audio:', error);
                                  alert('Failed to open audio. Please try again.');
                                }
                              }
                            } else if (ev.type === 'video') {
                              // For video, play in new window
                              if (Platform.OS === 'web') {
                                try {
                                  const newWindow = window.open('', '_blank');
                                  if (newWindow) {
                                    newWindow.document.write(`
                                      <html>
                                        <head>
                                          <title>${ev.filename}</title>
                                          <style>
                                            body { margin:0; display:flex; justify-content:center; align-items:center; background:#000; min-height:100vh; }
                                            video { max-width:100%; max-height:100vh; }
                                          </style>
                                        </head>
                                        <body>
                                          <video controls autoplay src="${ev.data}">
                                            Your browser does not support video playback.
                                          </video>
                                        </body>
                                      </html>
                                    `);
                                    newWindow.document.close();
                                  } else {
                                    alert('Please allow pop-ups to view attachments');
                                  }
                                } catch (error) {
                                  console.error('Error opening video:', error);
                                  alert('Failed to open video. Please try again.');
                                }
                              }
                            }
                          }}
                        >
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
                            color="#3B82F6"
                          />
                          <Text style={styles.evidenceFilename} numberOfLines={1}>
                            {ev.filename}
                          </Text>
                          <Ionicons name="open-outline" size={16} color="#3B82F6" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
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
  reportActionsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  viewReportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  capaActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  reportActionText: { color: '#fff', fontSize: 14, fontWeight: '700' },
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIconButton: {
    padding: 8,
  },
  auditInfoHeader: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  auditIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  auditIdLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3B82F6',
  },
  auditIdValue: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '600',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  auditInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  auditInfoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  auditInfoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  auditInfoValue: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '500',
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
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
    alignSelf: 'flex-start',
  },
  completedBadgeText: {
    fontSize: 14,
    color: '#065F46',
    fontWeight: '600',
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
  conformanceButtonCompliant: {
    borderColor: '#10B981',
  },
  conformanceButtonMinor: {
    borderColor: '#F59E0B',
  },
  conformanceButtonMajor: {
    borderColor: '#EF4444',
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
    marginBottom: 8,
  },
  evidenceInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
  },
  evidenceFilename: {
    flex: 1,
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '500',
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
