import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import {
  Download,
  FileText,
  BarChart3,
  TrendingUp,
  PieChart,
  Filter,
  Calendar,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart as RechartsPie,
  Pie,
  Cell,
  Legend
} from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
const AUDIT_TYPES = ['ISO 9001', 'ISO 14001', 'ISO 45001', 'FSSC 22000'];
const DEPARTMENTS = ['Production', 'QA', 'Maintenance', 'Warehouse', 'HR', 'Utilities'];

export const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [compliance, setCompliance] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterAuditType, setFilterAuditType] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchData();
  }, [filterAuditType, filterDepartment]);

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (filterAuditType) params.append('audit_type', filterAuditType);
      if (filterDepartment) params.append('department', filterDepartment);

      const [analyticsRes, complianceRes, reportRes] = await Promise.all([
        axios.get(`${API_URL}/api/analytics/dashboard`),
        axios.get(`${API_URL}/api/analytics/compliance?${params}`),
        axios.get(`${API_URL}/api/reports/management-review`)
      ]);
      setAnalytics(analyticsRes.data);
      setCompliance(complianceRes.data);
      setReportData(reportRes.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePDFReport = async () => {
    setGenerating(true);
    try {
      // Create PDF content in a new window
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Please allow popups to generate the report');
        return;
      }

      const reportHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Management Review Report - Global Acqua</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
            .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { color: #0f172a; margin: 0; }
            .header p { color: #64748b; margin: 5px 0; }
            .section { margin-bottom: 30px; }
            .section h2 { color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; }
            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
            .kpi-card { border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; text-align: center; }
            .kpi-value { font-size: 28px; font-weight: bold; color: #0f172a; }
            .kpi-label { font-size: 12px; color: #64748b; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
            th { background: #f8fafc; font-weight: 600; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
            .badge-critical { background: #fee2e2; color: #991b1b; }
            .badge-high { background: #ffedd5; color: #9a3412; }
            .badge-medium { background: #fef3c7; color: #92400e; }
            .badge-low { background: #d1fae5; color: #065f46; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b; }
            @media print { body { margin: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Management Review Report</h1>
            <p>Global Acqua RCA Tool</p>
            <p>Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>

          <div class="section">
            <h2>Executive Summary</h2>
            <div class="kpi-grid">
              <div class="kpi-card">
                <div class="kpi-value">${reportData?.summary?.total_findings || 0}</div>
                <div class="kpi-label">Total Findings</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-value">${reportData?.summary?.by_status?.Open || 0}</div>
                <div class="kpi-label">Open Findings</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-value">${reportData?.summary?.closure_rate || 0}%</div>
                <div class="kpi-label">Closure Rate</div>
              </div>
              <div class="kpi-card">
                <div class="kpi-value">${reportData?.summary?.overdue_capas || 0}</div>
                <div class="kpi-label">Overdue CAPAs</div>
              </div>
            </div>
          </div>

          <div class="section">
            <h2>Findings by Status</h2>
            <table>
              <tr><th>Status</th><th>Count</th><th>Percentage</th></tr>
              <tr><td>Open</td><td>${reportData?.summary?.by_status?.Open || 0}</td><td>${((reportData?.summary?.by_status?.Open || 0) / (reportData?.summary?.total_findings || 1) * 100).toFixed(1)}%</td></tr>
              <tr><td>In Progress</td><td>${reportData?.summary?.by_status?.['In Progress'] || 0}</td><td>${((reportData?.summary?.by_status?.['In Progress'] || 0) / (reportData?.summary?.total_findings || 1) * 100).toFixed(1)}%</td></tr>
              <tr><td>Closed</td><td>${reportData?.summary?.by_status?.Closed || 0}</td><td>${((reportData?.summary?.by_status?.Closed || 0) / (reportData?.summary?.total_findings || 1) * 100).toFixed(1)}%</td></tr>
            </table>
          </div>

          <div class="section">
            <h2>Findings by Risk Level</h2>
            <table>
              <tr><th>Risk Level</th><th>Count</th></tr>
              <tr><td><span class="badge badge-critical">Critical</span></td><td>${reportData?.summary?.by_risk?.Critical || 0}</td></tr>
              <tr><td><span class="badge badge-high">High</span></td><td>${reportData?.summary?.by_risk?.High || 0}</td></tr>
              <tr><td><span class="badge badge-medium">Medium</span></td><td>${reportData?.summary?.by_risk?.Medium || 0}</td></tr>
              <tr><td><span class="badge badge-low">Low</span></td><td>${reportData?.summary?.by_risk?.Low || 0}</td></tr>
            </table>
          </div>

          ${reportData?.critical_findings?.length > 0 ? `
          <div class="section">
            <h2>Critical Findings Requiring Attention</h2>
            <table>
              <tr><th>Standard</th><th>Department</th><th>Description</th><th>Status</th></tr>
              ${reportData.critical_findings.map(f => `
                <tr>
                  <td>${f.audit_type}</td>
                  <td>${f.department}</td>
                  <td>${f.finding_description?.substring(0, 100)}...</td>
                  <td>${f.status}</td>
                </tr>
              `).join('')}
            </table>
          </div>
          ` : ''}

          ${reportData?.overdue_actions?.length > 0 ? `
          <div class="section">
            <h2>Overdue Actions</h2>
            <table>
              <tr><th>Action Plan</th><th>Responsible</th><th>Target Date</th></tr>
              ${reportData.overdue_actions.map(c => `
                <tr>
                  <td>${c.action_plan?.substring(0, 80)}...</td>
                  <td>${c.responsible_person}</td>
                  <td>${c.target_date}</td>
                </tr>
              `).join('')}
            </table>
          </div>
          ` : ''}

          ${reportData?.root_causes?.length > 0 ? `
          <div class="section">
            <h2>Identified Root Causes</h2>
            <ul>
              ${reportData.root_causes.slice(0, 5).map(r => `<li>${r.root_cause}</li>`).join('')}
            </ul>
          </div>
          ` : ''}

          <div class="footer">
            <p>This report was generated by Global Acqua RCA Tool</p>
            <p>ISO 9001 | ISO 14001 | ISO 45001 | FSSC 22000 Compliant</p>
          </div>
        </body>
        </html>
      `;

      printWindow.document.write(reportHTML);
      printWindow.document.close();
      printWindow.focus();
      
      setTimeout(() => {
        printWindow.print();
      }, 500);

      toast.success('Report generated - use Print dialog to save as PDF');
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const statusData = analytics?.by_status ? [
    { name: 'Open', value: analytics.by_status.Open || 0 },
    { name: 'In Progress', value: analytics.by_status['In Progress'] || 0 },
    { name: 'Closed', value: analytics.by_status.Closed || 0 }
  ] : [];

  const riskData = analytics?.by_risk ? [
    { name: 'Low', value: analytics.by_risk.Low || 0, color: '#10b981' },
    { name: 'Medium', value: analytics.by_risk.Medium || 0, color: '#f59e0b' },
    { name: 'High', value: analytics.by_risk.High || 0, color: '#f97316' },
    { name: 'Critical', value: analytics.by_risk.Critical || 0, color: '#ef4444' }
  ] : [];

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 bg-slate-200 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="analytics-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Analytics & Reports
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Audit trends, compliance analytics, and management reports
          </p>
        </div>
        <Button 
          onClick={generatePDFReport}
          disabled={generating}
          className="bg-blue-600 hover:bg-blue-700"
          data-testid="generate-report-btn"
        >
          <Download className="w-4 h-4 mr-2" />
          {generating ? 'Generating...' : 'Generate PDF Report'}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select
              value={filterAuditType}
              onValueChange={(value) => setFilterAuditType(value === 'all' ? '' : value)}
            >
              <SelectTrigger className="w-[180px]" data-testid="filter-analytics-standard">
                <SelectValue placeholder="All Standards" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Standards</SelectItem>
                {AUDIT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterDepartment}
              onValueChange={(value) => setFilterDepartment(value === 'all' ? '' : value)}
            >
              <SelectTrigger className="w-[180px]" data-testid="filter-analytics-department">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {DEPARTMENTS.map((dept) => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Findings Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <TrendingUp className="w-5 h-5 text-blue-600" />
              Findings Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analytics?.trend_data || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <PieChart className="w-5 h-5 text-blue-600" />
              Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPie>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </RechartsPie>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Risk Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} stroke="#64748b" />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} stroke="#64748b" width={80} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {riskData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Compliance by Clause */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Compliance by Clause
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {compliance?.by_clause?.slice(0, 8).map((item, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-32 text-sm font-mono text-slate-600 truncate">{item.clause}</div>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${item.rate}%` }}
                    />
                  </div>
                  <div className="w-16 text-sm text-right">
                    <span className="font-semibold text-slate-700">{item.rate}%</span>
                  </div>
                </div>
              ))}
              {(!compliance?.by_clause || compliance.by_clause.length === 0) && (
                <p className="text-sm text-slate-500 text-center py-8">No compliance data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Findings by Department
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.by_department || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#64748b" />
                <YAxis tick={{ fontSize: 12 }} stroke="#64748b" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="count" fill="#0f172a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-emerald-50 border-emerald-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-emerald-700">Closure Rate</p>
                <p className="text-2xl font-bold text-emerald-900">{analytics?.closure_rate || 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-amber-700">Total CAPAs</p>
                <p className="text-2xl font-bold text-amber-900">{analytics?.total_capas || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={analytics?.overdue_capas > 0 ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${analytics?.overdue_capas > 0 ? 'bg-red-100' : 'bg-slate-100'}`}>
                <AlertTriangle className={`w-6 h-6 ${analytics?.overdue_capas > 0 ? 'text-red-600' : 'text-slate-600'}`} />
              </div>
              <div>
                <p className={`text-sm ${analytics?.overdue_capas > 0 ? 'text-red-700' : 'text-slate-700'}`}>Overdue Actions</p>
                <p className={`text-2xl font-bold ${analytics?.overdue_capas > 0 ? 'text-red-900' : 'text-slate-900'}`}>{analytics?.overdue_capas || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
