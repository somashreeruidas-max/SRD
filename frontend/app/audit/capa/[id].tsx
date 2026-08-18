import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Image,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth, API_URL } from '../../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { exportHtmlAsPdf } from '../../../utils/exportPdf';

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
  created_at: string;
  plant_name?: string;
  auditor_name?: string;
  auditee_name?: string;
  auditor?: string;
}

interface CAPAEntry {
  question_id: string;
  standard_clause: string;
  category: string;
  finding_description: string;
  question_text: string;
  correction: string;
  root_cause: string;
  corrective_action: string;
  responsible_person: string;
  target_date: string;
  status: string;
  closure_evidence: Evidence[];
}

const STATUS_OPTIONS = ['Open', 'In Progress', 'Closed'];

const statusColor = (status: string) => {
  if (status === 'Closed') return { bg: '#D1FAE5', text: '#065F46' };
  if (status === 'In Progress') return { bg: '#DBEAFE', text: '#1D4ED8' };
  return { bg: '#FEE2E2', text: '#991B1B' };
};

export default function CAPAScreen() {
  const { id } = useLocalSearchParams();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [entries, setEntries] = useState<CAPAEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [mode, setMode] = useState<'prepare' | 'report'>('prepare');
  const [viewerPhoto, setViewerPhoto] = useState<Evidence | null>(null);
  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const auditRes = await axios.get(`${API_URL}/api/audits/${id}`, { headers });
      const auditData: Audit = auditRes.data;
      setAudit(auditData);

      const [qRes, capaRes] = await Promise.all([
        axios.get(`${API_URL}/api/questionnaires/${auditData.questionnaire_id}`, { headers }),
        axios.get(`${API_URL}/api/audits/${id}/capa-entries`, { headers }),
      ]);
      const questionnaire: Questionnaire = qRes.data;
      const saved: CAPAEntry[] = capaRes.data.capa_entries || [];
      const savedMap = new Map(saved.map((e) => [e.question_id, e]));

      const responsesMap = new Map<string, Response>();
      (auditData.responses || []).forEach((r) => responsesMap.set(r.question_id, r));

      // Build findings list from non-conformances, merged with saved CAPA data
      const built: CAPAEntry[] = [];
      questionnaire.clauses.forEach((clause) => {
        clause.subclauses.forEach((sub) => {
          sub.questions.forEach((q) => {
            const r = responsesMap.get(q.id);
            if (r && (r.conformance === 'Mi' || r.conformance === 'Ma' || r.conformance === 'MA')) {
              const isMajor = r.conformance === 'Ma' || r.conformance === 'MA';
              const existing = savedMap.get(q.id);
              built.push({
                question_id: q.id,
                standard_clause: `${auditData.questionnaire_name} - ${sub.clause_no}`,
                category: isMajor ? 'Major NC' : 'Minor NC',
                finding_description: r.observations || 'No observations recorded',
                question_text: q.question_text,
                correction: existing?.correction || '',
                root_cause: existing?.root_cause || '',
                corrective_action: existing?.corrective_action || '',
                responsible_person: existing?.responsible_person || '',
                target_date: existing?.target_date || '',
                status: existing?.status || 'Open',
                closure_evidence: existing?.closure_evidence || [],
              });
            }
          });
        });
      });
      setEntries(built);
    } catch (error) {
      console.error('Error loading CAPA data:', error);
      Alert.alert('Error', 'Failed to load CAPA data');
    } finally {
      setLoading(false);
    }
  };

  const updateEntry = (questionId: string, updates: Partial<CAPAEntry>) => {
    setEntries((prev) => prev.map((e) => (e.question_id === questionId ? { ...e, ...updates } : e)));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(
        `${API_URL}/api/audits/${id}/capa-entries`,
        { entries },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (Platform.OS === 'web') {
        alert('✅ CAPA report saved successfully!');
      } else {
        Alert.alert('Success', 'CAPA report saved successfully');
      }
    } catch (error) {
      console.error('Error saving CAPA:', error);
      if (Platform.OS === 'web') {
        alert('Failed to save CAPA report. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to save CAPA report');
      }
    } finally {
      setSaving(false);
    }
  };

  const addClosureEvidence = async (questionId: string, fromCamera: boolean) => {
    try {
      let result;
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Camera access is required to capture closure evidence.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.5,
          base64: true,
        });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.5,
          base64: true,
        });
      }
      if (!result.canceled && result.assets[0].base64) {
        const entry = entries.find((e) => e.question_id === questionId);
        if (!entry) return;
        const newEv: Evidence = {
          type: 'photo',
          filename: `closure_${Date.now()}.jpg`,
          data: result.assets[0].base64,
          timestamp: new Date().toISOString(),
        };
        updateEntry(questionId, { closure_evidence: [...entry.closure_evidence, newEv] });
      }
    } catch (error) {
      console.error('Error adding closure evidence:', error);
      Alert.alert('Error', 'Failed to add closure evidence');
    }
  };

  const removeClosureEvidence = (questionId: string, index: number) => {
    const entry = entries.find((e) => e.question_id === questionId);
    if (!entry) return;
    const doRemove = () => {
      const list = [...entry.closure_evidence];
      list.splice(index, 1);
      updateEntry(questionId, { closure_evidence: list });
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Remove this closure evidence?')) doRemove();
    } else {
      Alert.alert('Remove Evidence', 'Remove this closure evidence?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: doRemove },
      ]);
    }
  };

  const handleDownloadPDF = async () => {
    if (!audit) return;
    setDownloading(true);
    const openCount = entries.filter((e) => e.status === 'Open').length;
    const progressCount = entries.filter((e) => e.status === 'In Progress').length;
    const closedCount = entries.filter((e) => e.status === 'Closed').length;

    let html = `
      <!DOCTYPE html><html><head><meta charset="utf-8"><style>
        @page { size: A4; margin: 12mm; }
        body { font-family: Arial, sans-serif; padding: 24px; color: #1F2937; }
        h1 { text-align: center; color: #111827; border-bottom: 3px solid #8B5CF6; padding-bottom: 12px; letter-spacing: 1px; }
        .meta { background: #F3F4F6; padding: 16px; border-radius: 8px; margin: 16px 0; }
        .meta p { margin: 4px 0; font-size: 13px; }
        .audit-id { display:inline-block; background:#EDE9FE; color:#6D28D9; font-weight:bold; padding:4px 12px; border-radius:6px; font-size:14px; }
        .summary { display:flex; gap:10px; margin: 16px 0; }
        .sum-card { flex:1; text-align:center; padding:12px; border-radius:8px; border:1px solid #E5E7EB; }
        .sum-num { font-size:22px; font-weight:bold; }
        .finding { border:1px solid #E5E7EB; border-radius:8px; margin: 16px 0; page-break-inside: avoid; }
        .f-head { background:#F9FAFB; padding: 10px 14px; border-bottom:1px solid #E5E7EB; display:flex; justify-content:space-between; }
        .cat-major { color:#991B1B; font-weight:bold; } .cat-minor { color:#92400E; font-weight:bold; }
        .status-open { color:#991B1B; font-weight:bold; } .status-progress { color:#1D4ED8; font-weight:bold; } .status-closed { color:#065F46; font-weight:bold; }
        table { width:100%; border-collapse: collapse; font-size:12px; }
        td { padding: 8px 12px; border-bottom: 1px solid #F3F4F6; vertical-align: top; }
        td.lbl { width: 30%; font-weight:bold; color:#4B5563; background:#FAFAFA; }
        .ev-imgs img { max-width:160px; max-height:120px; margin:4px; border:1px solid #D1D5DB; border-radius:4px; }
        .footer { margin-top:32px; text-align:center; color:#6B7280; font-size:11px; border-top:2px solid #E5E7EB; padding-top:12px; }
      </style></head><body>
      <h1>CORRECTIVE & PREVENTIVE ACTION (CAPA) REPORT</h1>
      <div class="meta">
        ${audit.audit_id ? `<p><span class="audit-id">Audit ID: ${audit.audit_id}</span></p>` : ''}
        <p><strong>Audit:</strong> ${audit.title}</p>
        <p><strong>Standard:</strong> ${audit.questionnaire_name}</p>
        <p><strong>Audit Date:</strong> ${new Date(audit.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        ${audit.plant_name ? `<p><strong>Plant / Site:</strong> ${audit.plant_name}</p>` : ''}
        <p><strong>Auditor:</strong> ${audit.auditor_name || audit.auditor || 'N/A'}</p>
        ${audit.auditee_name ? `<p><strong>Auditee:</strong> ${audit.auditee_name}</p>` : ''}
      </div>
      <div class="summary">
        <div class="sum-card"><div class="sum-num">${entries.length}</div>Total NCs</div>
        <div class="sum-card"><div class="sum-num" style="color:#DC2626">${openCount}</div>Open</div>
        <div class="sum-card"><div class="sum-num" style="color:#2563EB">${progressCount}</div>In Progress</div>
        <div class="sum-card"><div class="sum-num" style="color:#059669">${closedCount}</div>Closed</div>
      </div>
    `;

    entries.forEach((e, idx) => {
      const statusCls = e.status === 'Closed' ? 'status-closed' : e.status === 'In Progress' ? 'status-progress' : 'status-open';
      html += `
        <div class="finding">
          <div class="f-head">
            <span><strong>NC #${idx + 1}</strong> &nbsp; <span class="${e.category === 'Major NC' ? 'cat-major' : 'cat-minor'}">${e.category}</span></span>
            <span class="${statusCls}">${e.status.toUpperCase()}</span>
          </div>
          <table>
            <tr><td class="lbl">Standard & Clause</td><td>${e.standard_clause}</td></tr>
            <tr><td class="lbl">Requirement / Question</td><td>${e.question_text}</td></tr>
            <tr><td class="lbl">Description of Finding</td><td>${e.finding_description}</td></tr>
            <tr><td class="lbl">Correction</td><td>${e.correction || '—'}</td></tr>
            <tr><td class="lbl">Root Cause Analysis</td><td>${e.root_cause || '—'}</td></tr>
            <tr><td class="lbl">Corrective Action</td><td>${e.corrective_action || '—'}</td></tr>
            <tr><td class="lbl">Responsible Person</td><td>${e.responsible_person || '—'}</td></tr>
            <tr><td class="lbl">Target Date</td><td>${e.target_date || '—'}</td></tr>
            ${e.closure_evidence.length > 0 ? `<tr><td class="lbl">Closure Evidence</td><td><div class="ev-imgs">${e.closure_evidence.map((ev) => `<img src="data:image/jpeg;base64,${ev.data}" />`).join('')}</div></td></tr>` : ''}
          </table>
        </div>
      `;
    });

    html += `<div class="footer"><p>End of CAPA Report — Generated on ${new Date().toLocaleString('en-US')}</p><p>${audit.questionnaire_name}</p></div></body></html>`;

    try {
      await exportHtmlAsPdf(
        html,
        `CAPA_Report_${(audit.audit_id || audit.title).replace(/[^a-z0-9]/gi, '_')}`,
        'Save or Share CAPA Report'
      );
    } catch (error) {
      console.error('Error generating CAPA PDF:', error);
      Alert.alert('Error', 'Failed to generate CAPA PDF');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#8B5CF6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!audit) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
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
        <Text style={styles.headerTitle}>CAPA Report</Text>
        {entries.length > 0 && (
          <TouchableOpacity onPress={handleDownloadPDF} style={styles.pdfButton} disabled={downloading}>
            {downloading ? (
              <ActivityIndicator size="small" color="#8B5CF6" />
            ) : (
              <Ionicons name="download-outline" size={22} color="#8B5CF6" />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Audit meta strip */}
      <View style={styles.metaStrip}>
        {audit.audit_id ? (
          <View style={styles.auditIdBadge}>
            <Ionicons name="barcode-outline" size={14} color="#6D28D9" />
            <Text style={styles.auditIdText}>{audit.audit_id}</Text>
          </View>
        ) : null}
        <Text style={styles.metaTitle} numberOfLines={1}>
          {audit.title}
        </Text>
        <Text style={styles.metaSub} numberOfLines={1}>
          {audit.questionnaire_name} • {new Date(audit.created_at).toLocaleDateString()}
        </Text>
      </View>

      {entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle-outline" size={64} color="#10B981" />
          <Text style={styles.emptyTitle}>No Non-Conformances</Text>
          <Text style={styles.emptyText}>
            This audit has no minor or major non-conformances recorded, so a CAPA report is not required.
          </Text>
        </View>
      ) : (
        <>
          {/* Mode toggle */}
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'prepare' && styles.toggleBtnActive]}
              onPress={() => setMode('prepare')}
            >
              <Ionicons name="create-outline" size={16} color={mode === 'prepare' ? '#1F2937' : '#6B7280'} />
              <Text style={[styles.toggleText, mode === 'prepare' && styles.toggleTextActive]}>Prepare CAPA</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, mode === 'report' && styles.toggleBtnActive]}
              onPress={() => setMode('report')}
            >
              <Ionicons name="easel-outline" size={16} color={mode === 'report' ? '#1F2937' : '#6B7280'} />
              <Text style={[styles.toggleText, mode === 'report' && styles.toggleTextActive]}>View Report</Text>
            </TouchableOpacity>
          </View>

          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
              {mode === 'report' && (
                <View style={styles.summaryRow}>
                  <SummaryCard num={entries.length} label="Total NCs" color="#1F2937" />
                  <SummaryCard num={entries.filter((e) => e.status === 'Open').length} label="Open" color="#DC2626" />
                  <SummaryCard
                    num={entries.filter((e) => e.status === 'In Progress').length}
                    label="In Progress"
                    color="#2563EB"
                  />
                  <SummaryCard
                    num={entries.filter((e) => e.status === 'Closed').length}
                    label="Closed"
                    color="#059669"
                  />
                </View>
              )}

              {entries.map((entry, idx) => {
                const sc = statusColor(entry.status);
                const isMajor = entry.category === 'Major NC';
                return (
                  <View key={entry.question_id} style={styles.findingCard}>
                    {/* Card header */}
                    <View style={styles.findingHeader}>
                      <View style={styles.findingHeaderLeft}>
                        <Text style={styles.findingNum}>NC #{idx + 1}</Text>
                        <View style={[styles.catBadge, { backgroundColor: isMajor ? '#FEE2E2' : '#FEF3C7' }]}>
                          <Text style={[styles.catBadgeText, { color: isMajor ? '#991B1B' : '#92400E' }]}>
                            {entry.category}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: sc.text }]}>{entry.status}</Text>
                      </View>
                    </View>

                    <Text style={styles.clauseRef}>{entry.standard_clause}</Text>
                    <Text style={styles.fieldLabel}>Requirement / Question</Text>
                    <Text style={styles.readonlyText}>{entry.question_text}</Text>
                    <Text style={styles.fieldLabel}>Description of Finding</Text>
                    <Text style={styles.readonlyText}>{entry.finding_description}</Text>

                    {mode === 'prepare' ? (
                      <>
                        <Text style={styles.fieldLabel}>Correction (immediate action)</Text>
                        <TextInput
                          style={styles.input}
                          multiline
                          placeholder="Action taken to eliminate the non-conformity..."
                          placeholderTextColor="#9CA3AF"
                          value={entry.correction}
                          onChangeText={(t) => updateEntry(entry.question_id, { correction: t })}
                        />
                        <Text style={styles.fieldLabel}>Root Cause Analysis</Text>
                        <TextInput
                          style={styles.input}
                          multiline
                          placeholder="Why did the non-conformity occur? (5-Why / fishbone...)"
                          placeholderTextColor="#9CA3AF"
                          value={entry.root_cause}
                          onChangeText={(t) => updateEntry(entry.question_id, { root_cause: t })}
                        />
                        <Text style={styles.fieldLabel}>Corrective Action (to eliminate root cause)</Text>
                        <TextInput
                          style={styles.input}
                          multiline
                          placeholder="Action to prevent recurrence..."
                          placeholderTextColor="#9CA3AF"
                          value={entry.corrective_action}
                          onChangeText={(t) => updateEntry(entry.question_id, { corrective_action: t })}
                        />
                        <View style={styles.rowFields}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.fieldLabel}>Responsible Person</Text>
                            <TextInput
                              style={styles.inputSingle}
                              placeholder="Name / role"
                              placeholderTextColor="#9CA3AF"
                              value={entry.responsible_person}
                              onChangeText={(t) => updateEntry(entry.question_id, { responsible_person: t })}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.fieldLabel}>Target Date</Text>
                            <TextInput
                              style={styles.inputSingle}
                              placeholder="DD/MM/YYYY"
                              placeholderTextColor="#9CA3AF"
                              value={entry.target_date}
                              onChangeText={(t) => updateEntry(entry.question_id, { target_date: t })}
                            />
                          </View>
                        </View>
                        <Text style={styles.fieldLabel}>Status</Text>
                        <View style={styles.statusRow}>
                          {STATUS_OPTIONS.map((s) => {
                            const active = entry.status === s;
                            const c = statusColor(s);
                            return (
                              <TouchableOpacity
                                key={s}
                                style={[
                                  styles.statusChip,
                                  active && { backgroundColor: c.bg, borderColor: c.text },
                                ]}
                                onPress={() => updateEntry(entry.question_id, { status: s })}
                              >
                                <Text style={[styles.statusChipText, active && { color: c.text, fontWeight: '700' }]}>
                                  {s}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <Text style={styles.fieldLabel}>Closure Evidence</Text>
                        <View style={styles.evidenceRow}>
                          {entry.closure_evidence.map((ev, evIdx) => (
                            <View key={evIdx} style={styles.evidenceWrap}>
                              <TouchableOpacity onPress={() => setViewerPhoto(ev)}>
                                <Image
                                  source={{ uri: `data:image/jpeg;base64,${ev.data}` }}
                                  style={styles.evidenceThumb}
                                />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.removeEv}
                                onPress={() => removeClosureEvidence(entry.question_id, evIdx)}
                              >
                                <Ionicons name="close-circle" size={20} color="#EF4444" />
                              </TouchableOpacity>
                            </View>
                          ))}
                          <TouchableOpacity
                            style={styles.addEvBtn}
                            onPress={() => addClosureEvidence(entry.question_id, false)}
                          >
                            <Ionicons name="images-outline" size={20} color="#8B5CF6" />
                            <Text style={styles.addEvText}>Gallery</Text>
                          </TouchableOpacity>
                          {Platform.OS !== 'web' && (
                            <TouchableOpacity
                              style={styles.addEvBtn}
                              onPress={() => addClosureEvidence(entry.question_id, true)}
                            >
                              <Ionicons name="camera-outline" size={20} color="#8B5CF6" />
                              <Text style={styles.addEvText}>Camera</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </>
                    ) : (
                      <>
                        <ReportField label="Correction" value={entry.correction} />
                        <ReportField label="Root Cause Analysis" value={entry.root_cause} />
                        <ReportField label="Corrective Action" value={entry.corrective_action} />
                        <View style={styles.rowFields}>
                          <View style={{ flex: 1 }}>
                            <ReportField label="Responsible Person" value={entry.responsible_person} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <ReportField label="Target Date" value={entry.target_date} />
                          </View>
                        </View>
                        {entry.closure_evidence.length > 0 && (
                          <>
                            <Text style={styles.fieldLabel}>Closure Evidence ({entry.closure_evidence.length})</Text>
                            <View style={styles.evidenceRow}>
                              {entry.closure_evidence.map((ev, evIdx) => (
                                <TouchableOpacity key={evIdx} onPress={() => setViewerPhoto(ev)}>
                                  <Image
                                    source={{ uri: `data:image/jpeg;base64,${ev.data}` }}
                                    style={styles.evidenceThumb}
                                  />
                                </TouchableOpacity>
                              ))}
                            </View>
                          </>
                        )}
                      </>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </KeyboardAvoidingView>

          {/* Save bar (prepare mode only) */}
          {mode === 'prepare' && (
            <View style={styles.saveBar}>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={20} color="#fff" />
                    <Text style={styles.saveBtnText}>Save CAPA Report</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* Fullscreen photo viewer */}
      <Modal visible={!!viewerPhoto} transparent animationType="fade" onRequestClose={() => setViewerPhoto(null)}>
        <View style={styles.viewerOverlay}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerPhoto(null)}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {viewerPhoto && (
            <Image
              source={{ uri: `data:image/jpeg;base64,${viewerPhoto.data}` }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ReportField({ label, value }: { label: string; value: string }) {
  return (
    <>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={value ? styles.readonlyText : styles.emptyValue}>{value || 'Not provided yet'}</Text>
    </>
  );
}

function SummaryCard({ num, label, color }: { num: number; label: string; color: string }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={[styles.summaryNum, { color }]}>{num}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#1F2937' },
  pdfButton: { padding: 8, minWidth: 44, alignItems: 'center' },
  metaStrip: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  auditIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    marginBottom: 4,
  },
  auditIdText: { color: '#6D28D9', fontWeight: '700', fontSize: 12 },
  metaTitle: { fontSize: 15, fontWeight: '600', color: '#1F2937' },
  metaSub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginTop: 16 },
  emptyText: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  toggleRow: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    gap: 6,
  },
  toggleBtnActive: { backgroundColor: '#fff' },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  toggleTextActive: { color: '#1F2937' },
  content: { flex: 1 },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 8 },
  summaryCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  summaryNum: { fontSize: 20, fontWeight: '800' },
  summaryLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  findingCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  findingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  findingHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  findingNum: { fontSize: 15, fontWeight: '800', color: '#1F2937' },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  catBadgeText: { fontSize: 11, fontWeight: '800' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },
  clauseRef: { fontSize: 12, color: '#8B5CF6', fontWeight: '600', marginBottom: 6 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 4,
  },
  readonlyText: { fontSize: 13, color: '#374151', lineHeight: 19 },
  emptyValue: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  inputSingle: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
    minHeight: 44,
  },
  rowFields: { flexDirection: 'row', gap: 12 },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
  },
  statusChipText: { fontSize: 12, color: '#6B7280' },
  evidenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  evidenceWrap: { position: 'relative' },
  evidenceThumb: { width: 72, height: 72, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  removeEv: { position: 'absolute', top: -8, right: -8 },
  addEvBtn: {
    width: 72,
    height: 72,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C4B5FD',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
  },
  addEvText: { fontSize: 10, color: '#8B5CF6', marginTop: 2, fontWeight: '600' },
  saveBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  saveBtn: {
    backgroundColor: '#8B5CF6',
    borderRadius: 10,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  viewerImage: { width: '92%', height: '75%' },
});
