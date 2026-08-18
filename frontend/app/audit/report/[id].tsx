import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useAuth, API_URL } from '../../../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
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
  audit_scope?: string;
  audit_criteria?: string;
  auditor?: string;
}

const getConformanceInfo = (conformance?: string) => {
  if (conformance === 'C' || conformance === 'CO' || conformance === 'M') {
    return { label: 'COMPLIANT', color: '#065F46', bg: '#D1FAE5' };
  }
  if (conformance === 'Mi') {
    return { label: 'MINOR NC', color: '#92400E', bg: '#FEF3C7' };
  }
  if (conformance === 'Ma' || conformance === 'MA') {
    return { label: 'MAJOR NC', color: '#991B1B', bg: '#FEE2E2' };
  }
  return { label: 'NOT ANSWERED', color: '#6B7280', bg: '#F3F4F6' };
};

const guessMime = (filename: string, type: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (type === 'photo' || ['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'image/jpeg';
  if (ext === 'pdf') return 'application/pdf';
  if (['m4a', 'mp3', 'wav', 'aac'].includes(ext)) return 'audio/mp4';
  if (['mp4', 'mov'].includes(ext)) return 'video/mp4';
  return 'application/octet-stream';
};

export default function AuditReportScreen() {
  const { id } = useLocalSearchParams();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [responses, setResponses] = useState<Map<string, Response>>(new Map());
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [findingsOnly, setFindingsOnly] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState<Evidence | null>(null);
  const { token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      const auditRes = await axios.get(`${API_URL}/api/audits/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAudit(auditRes.data);
      const qRes = await axios.get(`${API_URL}/api/questionnaires/${auditRes.data.questionnaire_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setQuestionnaire(qRes.data);
      const map = new Map<string, Response>();
      (auditRes.data.responses || []).forEach((r: Response) => map.set(r.question_id, r));
      setResponses(map);
    } catch (error) {
      console.error('Error loading report:', error);
      Alert.alert('Error', 'Failed to load audit report');
    } finally {
      setLoading(false);
    }
  };

  const getSummary = () => {
    let total = 0, answered = 0, compliant = 0, minor = 0, major = 0;
    questionnaire?.clauses.forEach((clause) =>
      clause.subclauses.forEach((sub) =>
        sub.questions.forEach((q) => {
          total++;
          const r = responses.get(q.id);
          if (r && (r.observations?.trim() || r.conformance?.trim())) answered++;
          if (r?.conformance === 'C' || r?.conformance === 'CO' || r?.conformance === 'M') compliant++;
          else if (r?.conformance === 'Mi') minor++;
          else if (r?.conformance === 'Ma' || r?.conformance === 'MA') major++;
        })
      )
    );
    const assessed = compliant + minor + major;
    const complianceRate = assessed > 0 ? Math.round((compliant / assessed) * 100) : 0;
    return { total, answered, compliant, minor, major, complianceRate };
  };

  const openEvidence = async (ev: Evidence) => {
    if (ev.type === 'photo') {
      setViewerPhoto(ev);
      return;
    }
    try {
      if (Platform.OS === 'web') {
        const byteChars = atob(ev.data);
        const bytes = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
        const blob = new Blob([bytes], { type: guessMime(ev.filename, ev.type) });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        const fileUri = `${FileSystem.documentDirectory}${ev.filename}`;
        await FileSystem.writeAsStringAsync(fileUri, ev.data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await Sharing.shareAsync(fileUri, { dialogTitle: `Open ${ev.filename}` });
      }
    } catch (error) {
      console.error('Error opening evidence:', error);
      Alert.alert('Error', 'Failed to open attachment');
    }
  };

  const handleDownloadPDF = async () => {
    if (!audit || !questionnaire) return;
    setDownloading(true);
    const summary = getSummary();

    let html = `
      <!DOCTYPE html><html><head><meta charset="utf-8"><style>
        @page { size: A4; margin: 12mm; }
        body { font-family: Arial, sans-serif; padding: 24px; color: #1F2937; }
        h1 { text-align: center; color: #111827; border-bottom: 3px solid #3B82F6; padding-bottom: 12px; letter-spacing: 1px; }
        .meta { background: #F3F4F6; padding: 16px; border-radius: 8px; margin: 16px 0; }
        .meta p { margin: 4px 0; font-size: 13px; }
        .audit-id { display:inline-block; background:#DBEAFE; color:#1D4ED8; font-weight:bold; padding:4px 12px; border-radius:6px; font-size:14px; }
        .summary { display: flex; gap: 10px; margin: 16px 0; }
        .sum-card { flex:1; text-align:center; padding:12px; border-radius:8px; border:1px solid #E5E7EB; }
        .sum-num { font-size: 22px; font-weight: bold; }
        .clause { margin: 24px 0; page-break-inside: avoid; }
        .clause-title { background: #1E3A8A; color: white; padding: 10px 14px; font-weight: bold; font-size: 15px; border-radius: 6px 6px 0 0; }
        .subclause-title { font-weight: bold; color: #374151; margin: 12px 0 6px; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 12px; }
        th { background: #E5E7EB; padding: 8px; text-align: left; border: 1px solid #D1D5DB; }
        td { padding: 8px; border: 1px solid #D1D5DB; vertical-align: top; }
        .badge { font-weight: bold; text-align: center; }
        .meets { background:#D1FAE5; color:#065F46; } .minor { background:#FEF3C7; color:#92400E; }
        .major { background:#FEE2E2; color:#991B1B; } .na { background:#F3F4F6; color:#6B7280; font-style:italic; }
        .ev-imgs img { max-width: 180px; max-height: 140px; margin: 4px; border: 1px solid #D1D5DB; border-radius: 4px; }
        .ev-file { font-style: italic; color: #4B5563; font-size: 11px; }
        .footer { margin-top: 32px; text-align:center; color:#6B7280; font-size: 11px; border-top: 2px solid #E5E7EB; padding-top: 12px; }
      </style></head><body>
      <h1>INTERNAL AUDIT REPORT</h1>
      <div class="meta">
        ${audit.audit_id ? `<p><span class="audit-id">Audit ID: ${audit.audit_id}</span></p>` : ''}
        <p><strong>Audit Title:</strong> ${audit.title}</p>
        <p><strong>Standard:</strong> ${audit.questionnaire_name}</p>
        <p><strong>Status:</strong> ${audit.status.toUpperCase()}</p>
        <p><strong>Date:</strong> ${new Date(audit.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
        ${audit.plant_name ? `<p><strong>Plant / Site:</strong> ${audit.plant_name}</p>` : ''}
        <p><strong>Auditor:</strong> ${audit.auditor_name || audit.auditor || 'N/A'}</p>
        ${audit.auditee_name ? `<p><strong>Auditee:</strong> ${audit.auditee_name}</p>` : ''}
        ${audit.audit_scope ? `<p><strong>Scope:</strong> ${audit.audit_scope}</p>` : ''}
        ${audit.audit_criteria ? `<p><strong>Criteria:</strong> ${audit.audit_criteria}</p>` : ''}
      </div>
      <div class="summary">
        <div class="sum-card"><div class="sum-num" style="color:#059669">${summary.compliant}</div>Compliant</div>
        <div class="sum-card"><div class="sum-num" style="color:#D97706">${summary.minor}</div>Minor NC</div>
        <div class="sum-card"><div class="sum-num" style="color:#DC2626">${summary.major}</div>Major NC</div>
        <div class="sum-card"><div class="sum-num" style="color:#2563EB">${summary.complianceRate}%</div>Compliance</div>
      </div>
    `;

    questionnaire.clauses.forEach((clause) => {
      let clauseHtml = '';
      clause.subclauses.forEach((sub) => {
        let rows = '';
        sub.questions.forEach((q, idx) => {
          const r = responses.get(q.id);
          if (findingsOnly && !(r?.conformance === 'Mi' || r?.conformance === 'Ma' || r?.conformance === 'MA')) return;
          const info = getConformanceInfo(r?.conformance);
          const cls = info.label === 'COMPLIANT' ? 'meets' : info.label === 'MINOR NC' ? 'minor' : info.label === 'MAJOR NC' ? 'major' : 'na';
          const photos = (r?.evidence || []).filter((e) => e.type === 'photo');
          const files = (r?.evidence || []).filter((e) => e.type !== 'photo');
          rows += `<tr>
            <td style="width:45%"><strong>Q${idx + 1}.</strong> ${q.question_text}</td>
            <td class="badge ${cls}" style="width:13%">${info.label}</td>
            <td style="width:42%">${r?.observations || 'No observations recorded'}
              ${photos.length > 0 ? `<div class="ev-imgs">${photos.map((p) => `<img src="data:image/jpeg;base64,${p.data}" />`).join('')}</div>` : ''}
              ${files.length > 0 ? files.map((f) => `<div class="ev-file">📎 ${f.filename}</div>`).join('') : ''}
            </td></tr>`;
        });
        if (rows) {
          clauseHtml += `<div class="subclause-title">${sub.clause_no} — ${sub.title}</div>
            <table><thead><tr><th>Requirement / Question</th><th>Result</th><th>Observations & Evidence</th></tr></thead><tbody>${rows}</tbody></table>`;
        }
      });
      if (clauseHtml) {
        html += `<div class="clause"><div class="clause-title">CLAUSE ${clause.clause_no}: ${clause.title}</div>${clauseHtml}</div>`;
      }
    });

    html += `<div class="footer"><p>End of Internal Audit Report — Generated on ${new Date().toLocaleString('en-US')}</p><p>${audit.questionnaire_name}</p></div></body></html>`;

    try {
      await exportHtmlAsPdf(
        html,
        `Audit_Report_${(audit.audit_id || audit.title).replace(/[^a-z0-9]/gi, '_')}`,
        'Save or Share Audit Report'
      );
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF report');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!audit || !questionnaire) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text>Report not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const summary = getSummary();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Audit Report</Text>
        <TouchableOpacity onPress={handleDownloadPDF} style={styles.pdfButton} disabled={downloading}>
          {downloading ? (
            <ActivityIndicator size="small" color="#3B82F6" />
          ) : (
            <Ionicons name="download-outline" size={22} color="#3B82F6" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Report Title Block */}
        <View style={styles.titleBlock}>
          <Text style={styles.reportHeading}>INTERNAL AUDIT REPORT</Text>
          {audit.audit_id ? (
            <View style={styles.auditIdBadge}>
              <Ionicons name="barcode-outline" size={16} color="#1D4ED8" />
              <Text style={styles.auditIdText}>Audit ID: {audit.audit_id}</Text>
            </View>
          ) : null}
          <Text style={styles.auditTitle}>{audit.title}</Text>
          <Text style={styles.standardName}>{audit.questionnaire_name}</Text>
        </View>

        {/* Meta grid */}
        <View style={styles.metaCard}>
          <MetaRow label="Status" value={audit.status.toUpperCase()} />
          <MetaRow
            label="Date"
            value={new Date(audit.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          />
          <MetaRow label="Plant / Site" value={audit.plant_name || 'Not specified'} />
          <MetaRow label="Auditor" value={audit.auditor_name || audit.auditor || 'N/A'} />
          <MetaRow label="Auditee" value={audit.auditee_name || 'Not specified'} />
          {audit.audit_scope ? <MetaRow label="Scope" value={audit.audit_scope} /> : null}
          {audit.audit_criteria ? <MetaRow label="Criteria" value={audit.audit_criteria} /> : null}
        </View>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <SummaryCard num={summary.compliant} label="Compliant" color="#059669" />
          <SummaryCard num={summary.minor} label="Minor NC" color="#D97706" />
          <SummaryCard num={summary.major} label="Major NC" color="#DC2626" />
          <SummaryCard num={`${summary.complianceRate}%`} label="Compliance" color="#2563EB" />
        </View>

        {/* Filter toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, !findingsOnly && styles.toggleBtnActive]}
            onPress={() => setFindingsOnly(false)}
          >
            <Text style={[styles.toggleText, !findingsOnly && styles.toggleTextActive]}>Full Report</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, findingsOnly && styles.toggleBtnActive]}
            onPress={() => setFindingsOnly(true)}
          >
            <Text style={[styles.toggleText, findingsOnly && styles.toggleTextActive]}>Findings Only</Text>
          </TouchableOpacity>
        </View>

        {/* Clauses */}
        {questionnaire.clauses.map((clause) => {
          const subBlocks = clause.subclauses
            .map((sub) => {
              const qs = sub.questions.filter((q) => {
                if (!findingsOnly) return true;
                const r = responses.get(q.id);
                return r?.conformance === 'Mi' || r?.conformance === 'Ma' || r?.conformance === 'MA';
              });
              return { sub, qs };
            })
            .filter((b) => b.qs.length > 0);
          if (subBlocks.length === 0) return null;
          return (
            <View key={clause.clause_no} style={styles.clauseSection}>
              <View style={styles.clauseHeader}>
                <Text style={styles.clauseHeaderText}>
                  CLAUSE {clause.clause_no}: {clause.title}
                </Text>
              </View>
              {subBlocks.map(({ sub, qs }) => (
                <View key={sub.clause_no} style={styles.subclauseBlock}>
                  <Text style={styles.subclauseTitle}>
                    {sub.clause_no} — {sub.title}
                  </Text>
                  {qs.map((q, idx) => {
                    const r = responses.get(q.id);
                    const info = getConformanceInfo(r?.conformance);
                    return (
                      <View key={q.id} style={styles.questionCard}>
                        <View style={styles.questionTopRow}>
                          <Text style={styles.questionText}>
                            <Text style={styles.qNum}>Q{idx + 1}. </Text>
                            {q.question_text}
                          </Text>
                        </View>
                        <View style={[styles.confBadge, { backgroundColor: info.bg }]}>
                          <Text style={[styles.confBadgeText, { color: info.color }]}>{info.label}</Text>
                        </View>
                        <Text style={styles.obsLabel}>Observations</Text>
                        <Text style={styles.obsText}>{r?.observations || 'No observations recorded'}</Text>
                        {(r?.evidence?.length || 0) > 0 && (
                          <View style={styles.evidenceBlock}>
                            <Text style={styles.obsLabel}>Attachments ({r!.evidence.length})</Text>
                            <View style={styles.evidenceRow}>
                              {r!.evidence.map((ev, evIdx) => (
                                <TouchableOpacity
                                  key={evIdx}
                                  style={styles.evidenceItem}
                                  onPress={() => openEvidence(ev)}
                                >
                                  {ev.type === 'photo' ? (
                                    <Image
                                      source={{ uri: `data:image/jpeg;base64,${ev.data}` }}
                                      style={styles.evidenceThumb}
                                    />
                                  ) : (
                                    <View style={styles.fileChip}>
                                      <Ionicons
                                        name={
                                          ev.type === 'audio'
                                            ? 'mic-outline'
                                            : ev.type === 'video'
                                            ? 'videocam-outline'
                                            : 'document-outline'
                                        }
                                        size={20}
                                        color="#3B82F6"
                                      />
                                      <Text style={styles.fileChipText} numberOfLines={1}>
                                        {ev.filename}
                                      </Text>
                                    </View>
                                  )}
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          );
        })}

        <View style={styles.footerBlock}>
          <Text style={styles.footerText}>End of Internal Audit Report</Text>
          <Text style={styles.footerText}>Generated on {new Date().toLocaleString('en-US')}</Text>
        </View>
      </ScrollView>

      {/* Fullscreen photo viewer */}
      <Modal visible={!!viewerPhoto} transparent animationType="fade" onRequestClose={() => setViewerPhoto(null)}>
        <View style={styles.viewerOverlay}>
          <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerPhoto(null)}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          {viewerPhoto && (
            <>
              <Image
                source={{ uri: `data:image/jpeg;base64,${viewerPhoto.data}` }}
                style={styles.viewerImage}
                resizeMode="contain"
              />
              <Text style={styles.viewerCaption}>{viewerPhoto.filename}</Text>
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function SummaryCard({ num, label, color }: { num: number | string; label: string; color: string }) {
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
  content: { flex: 1 },
  titleBlock: {
    backgroundColor: '#fff',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 3,
    borderBottomColor: '#3B82F6',
  },
  reportHeading: { fontSize: 20, fontWeight: '800', color: '#111827', letterSpacing: 1.5 },
  auditIdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 10,
    gap: 6,
  },
  auditIdText: { color: '#1D4ED8', fontWeight: '700', fontSize: 14 },
  auditTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 10, textAlign: 'center' },
  standardName: { fontSize: 13, color: '#6B7280', marginTop: 4, textAlign: 'center' },
  metaCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  metaRow: { flexDirection: 'row', paddingVertical: 5 },
  metaLabel: { width: 100, fontSize: 13, fontWeight: '600', color: '#6B7280' },
  metaValue: { flex: 1, fontSize: 13, color: '#1F2937' },
  summaryRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginTop: 8 },
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
  toggleRow: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    padding: 4,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  toggleBtnActive: { backgroundColor: '#fff' },
  toggleText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  toggleTextActive: { color: '#1F2937' },
  clauseSection: { marginHorizontal: 16, marginBottom: 16 },
  clauseHeader: {
    backgroundColor: '#1E3A8A',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    padding: 12,
  },
  clauseHeaderText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  subclauseBlock: {
    backgroundColor: '#fff',
    padding: 12,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#E5E7EB',
  },
  subclauseTitle: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
  questionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  questionTopRow: { marginBottom: 8 },
  questionText: { fontSize: 13, color: '#1F2937', lineHeight: 19 },
  qNum: { fontWeight: '700' },
  confBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  confBadgeText: { fontSize: 11, fontWeight: '800' },
  obsLabel: { fontSize: 11, fontWeight: '700', color: '#6B7280', marginBottom: 3, textTransform: 'uppercase' },
  obsText: { fontSize: 13, color: '#374151', lineHeight: 19 },
  evidenceBlock: { marginTop: 10 },
  evidenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  evidenceItem: {},
  evidenceThumb: { width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    maxWidth: 180,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  fileChipText: { fontSize: 12, color: '#1D4ED8', flexShrink: 1 },
  footerBlock: { alignItems: 'center', marginTop: 8, paddingVertical: 16 },
  footerText: { fontSize: 12, color: '#9CA3AF' },
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  viewerImage: { width: '92%', height: '75%' },
  viewerCaption: { color: '#D1D5DB', marginTop: 12, fontSize: 13 },
});
