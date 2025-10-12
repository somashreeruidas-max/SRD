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
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth, API_URL } from '../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  description: string;
  clauses: Clause[];
}

export default function QuestionnaireDetailScreen() {
  const { id } = useLocalSearchParams();
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [expandedClauses, setExpandedClauses] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<{question: Question, clauseNo: string, subclauseIndex: number} | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editQuestionText, setEditQuestionText] = useState('');
  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchQuestionnaire();
  }, [id]);

  const expandAllClauses = () => {
    if (!questionnaire) return;
    const allClauses = new Set(questionnaire.clauses.map(c => c.clause_no));
    setExpandedClauses(allClauses);
  };

  const collapseAllClauses = () => {
    setExpandedClauses(new Set());
  };

  const handleEditQuestion = (question: Question, clauseNo: string, subclauseIndex: number) => {
    setEditingQuestion({ question, clauseNo, subclauseIndex });
    setEditQuestionText(question.question_text);
    setShowEditModal(true);
  };

  const handleSaveQuestion = () => {
    if (!editingQuestion || !questionnaire) return;

    const updatedQuestionnaire = { ...questionnaire };
    const clause = updatedQuestionnaire.clauses.find(c => c.clause_no === editingQuestion.clauseNo);
    if (clause) {
      const subclause = clause.subclauses[editingQuestion.subclauseIndex];
      const questionIndex = subclause.questions.findIndex(q => q.id === editingQuestion.question.id);
      if (questionIndex !== -1) {
        subclause.questions[questionIndex].question_text = editQuestionText;
      }
    }
    setQuestionnaire(updatedQuestionnaire);
    setShowEditModal(false);
    setEditingQuestion(null);
  };

  const handleDeleteQuestion = (questionId: string, clauseNo: string, subclauseIndex: number) => {
    if (!questionnaire) return;

    console.log('Delete question called:', { questionId, clauseNo, subclauseIndex });

    const performDelete = () => {
      const updatedQuestionnaire = { ...questionnaire };
      const clause = updatedQuestionnaire.clauses.find(c => c.clause_no === clauseNo);
      console.log('Found clause:', clause?.clause_no);
      
      if (clause) {
        const subclause = clause.subclauses[subclauseIndex];
        console.log('Found subclause:', subclause?.clause_no, 'Questions before:', subclause?.questions.length);
        
        if (subclause) {
          subclause.questions = subclause.questions.filter(q => q.id !== questionId);
          console.log('Questions after delete:', subclause.questions.length);
          setQuestionnaire(updatedQuestionnaire);
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this question?')) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Delete Question',
        'Are you sure you want to delete this question?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: performDelete,
          },
        ]
      );
    }
  };

  const handleAddQuestion = (clauseNo: string, subclauseIndex: number) => {
    if (!questionnaire) return;

    const newQuestionId = `q_${Date.now()}`;
    const updatedQuestionnaire = { ...questionnaire };
    const clause = updatedQuestionnaire.clauses.find(c => c.clause_no === clauseNo);
    if (clause) {
      const subclause = clause.subclauses[subclauseIndex];
      const newQuestion: Question = {
        id: newQuestionId,
        question_text: 'New question - tap edit to customize',
        order: subclause.questions.length + 1,
      };
      subclause.questions.push(newQuestion);
    }
    setQuestionnaire(updatedQuestionnaire);
  };

  const handleSaveChanges = async () => {
    if (!questionnaire) return;

    setSaving(true);
    try {
      const response = await axios.put(
        `${API_URL}/api/questionnaires/${id}`,
        { clauses: questionnaire.clauses },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (Platform.OS === 'web') {
        alert('✅ Questionnaire updated successfully!');
      } else {
        Alert.alert('Success', 'Questionnaire updated successfully');
      }
      setEditMode(false);
      
      // Refresh the questionnaire to get latest data
      fetchQuestionnaire();
    } catch (error: any) {
      console.error('Error saving questionnaire:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to save changes. Please try again.';
      
      if (Platform.OS === 'web') {
        alert(`❌ Error: ${errorMessage}`);
      } else {
        Alert.alert('Error', errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  const fetchQuestionnaire = async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/questionnaires/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setQuestionnaire(response.data);
    } catch (error) {
      console.error('Error fetching questionnaire:', error);
      Alert.alert('Error', 'Failed to load questionnaire');
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

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!questionnaire) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text>Questionnaire not found</Text>
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
          Questionnaire
        </Text>
        {editMode ? (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setEditMode(false)} style={styles.headerButton}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveChanges}
              style={[styles.headerButton, styles.saveHeaderButton]}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveButtonHeaderText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setEditMode(true)} style={styles.headerButton}>
            <Ionicons name="create-outline" size={20} color="#3B82F6" />
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoSection}>
          <Text style={styles.title}>{questionnaire.name}</Text>
          {questionnaire.description && (
            <Text style={styles.description}>{questionnaire.description}</Text>
          )}
          <View style={styles.actionsContainer}>
            <TouchableOpacity style={styles.actionButton} onPress={expandAllClauses}>
              <Ionicons name="expand-outline" size={16} color="#3B82F6" />
              <Text style={styles.actionButtonText}>Expand All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={collapseAllClauses}>
              <Ionicons name="contract-outline" size={16} color="#3B82F6" />
              <Text style={styles.actionButtonText}>Collapse All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.hintBox}>
            <Ionicons name="information-circle-outline" size={16} color="#3B82F6" />
            <Text style={styles.hintText}>
              Tap on any clause below to expand and view questions
            </Text>
          </View>
        </View>

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
                    <View style={styles.subclauseHeader}>
                      <Text style={styles.subclauseNumber}>
                        {subclause.clause_no}
                      </Text>
                      <Text style={styles.subclauseTitle}>
                        {subclause.title}
                      </Text>
                    </View>
                    {subclause.questions.map((question, qIndex) => {
                      const subclauseIndex = clause.subclauses.findIndex(sc => sc.clause_no === subclause.clause_no);
                      return (
                        <View key={question.id} style={styles.questionContainer}>
                          <Text style={styles.questionNumber}>Q{qIndex + 1}</Text>
                          <Text style={[styles.questionText, editMode && styles.questionTextEdit]}>
                            {question.question_text}
                          </Text>
                          {editMode && (
                            <View style={styles.questionActions}>
                              <TouchableOpacity
                                style={styles.editIconButton}
                                onPress={() => handleEditQuestion(question, clause.clause_no, subclauseIndex)}
                              >
                                <Ionicons name="create-outline" size={18} color="#3B82F6" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.deleteIconButton}
                                onPress={() => handleDeleteQuestion(question.id, clause.clause_no, subclauseIndex)}
                              >
                                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })}
                    {editMode && (() => {
                      const subclauseIndex = clause.subclauses.findIndex(sc => sc.clause_no === subclause.clause_no);
                      return (
                        <TouchableOpacity
                          style={styles.addQuestionButton}
                          onPress={() => handleAddQuestion(clause.clause_no, subclauseIndex)}
                        >
                          <Ionicons name="add-circle-outline" size={20} color="#3B82F6" />
                          <Text style={styles.addQuestionText}>Add Question</Text>
                        </TouchableOpacity>
                      );
                    })()}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Edit Question Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEditModal(false)}>
              <Ionicons name="close" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Question</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.modalLabel}>Question Text</Text>
            <TextInput
              style={styles.modalTextArea}
              value={editQuestionText}
              onChangeText={setEditQuestionText}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              placeholder="Enter question text..."
            />

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowEditModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSaveQuestion}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
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
  content: {
    flex: 1,
  },
  infoSection: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    gap: 8,
  },
  hintText: {
    flex: 1,
    fontSize: 13,
    color: '#3B82F6',
    lineHeight: 18,
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
  subclauseHeader: {
    marginBottom: 8,
  },
  subclauseNumber: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 4,
  },
  subclauseTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  questionContainer: {
    flexDirection: 'row',
    marginTop: 8,
    paddingLeft: 12,
  },
  questionNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginRight: 8,
    marginTop: 2,
  },
  questionText: {
    flex: 1,
    fontSize: 13,
    color: '#4B5563',
    lineHeight: 18,
  },
  questionTextEdit: {
    flex: 0,
    marginRight: 8,
  },
  questionActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  editIconButton: {
    padding: 4,
  },
  deleteIconButton: {
    padding: 4,
  },
  addQuestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderStyle: 'dashed',
    gap: 6,
  },
  addQuestionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  saveHeaderButton: {
    backgroundColor: '#3B82F6',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  saveButtonHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
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
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  modalTextArea: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 150,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    marginTop: 24,
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
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalSaveButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
