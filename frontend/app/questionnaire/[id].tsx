import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
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
  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchQuestionnaire();
  }, [id]);

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
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoSection}>
          <Text style={styles.title}>{questionnaire.name}</Text>
          {questionnaire.description && (
            <Text style={styles.description}>{questionnaire.description}</Text>
          )}
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
                    {subclause.questions.map((question, index) => (
                      <View key={question.id} style={styles.questionContainer}>
                        <Text style={styles.questionNumber}>Q{index + 1}</Text>
                        <Text style={styles.questionText}>
                          {question.question_text}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
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
});
