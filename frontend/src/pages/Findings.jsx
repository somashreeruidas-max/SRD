import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Filter,
  CalendarIcon,
  Eye,
  Edit,
  Trash2,
  FileText,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AUDIT_TYPES = ['ISO 9001', 'ISO 14001', 'ISO 45001', 'FSSC 22000', 'GAO', 'Corporate Audit', 'Other'];
const DEPARTMENTS = ['Production', 'QA', 'Maintenance', 'Warehouse', 'HR', 'Utilities'];
const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES = ['Open', 'In Progress', 'Closed'];

export const Findings = () => {
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: '',
    department: '',
    audit_type: '',
    risk_rating: ''
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState(null);
  const [formData, setFormData] = useState({
    audit_type: '',
    clause_reference: '',
    department: '',
    finding_description: '',
    objective_evidence: '',
    severity: 3,
    likelihood: 3,
    auditor_name: '',
    audit_date: new Date().toISOString().split('T')[0]
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchFindings();
  }, [filters]);

  const fetchFindings = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      const response = await axios.get(`${API_URL}/api/findings?${params}`);
      setFindings(response.data);
    } catch (error) {
      console.error('Failed to fetch findings:', error);
      toast.error('Failed to load findings');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedFinding) {
        await axios.put(`${API_URL}/api/findings/${selectedFinding.id}`, formData);
        toast.success('Finding updated successfully');
      } else {
        await axios.post(`${API_URL}/api/findings`, formData);
        toast.success('Finding created successfully');
      }
      setIsDialogOpen(false);
      resetForm();
      fetchFindings();
    } catch (error) {
      toast.error('Failed to save finding');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this finding?')) return;
    try {
      await axios.delete(`${API_URL}/api/findings/${id}`);
      toast.success('Finding deleted');
      fetchFindings();
    } catch (error) {
      toast.error('Failed to delete finding');
    }
  };

  const resetForm = () => {
    setSelectedFinding(null);
    setFormData({
      audit_type: '',
      clause_reference: '',
      department: '',
      finding_description: '',
      objective_evidence: '',
      severity: 3,
      likelihood: 3,
      auditor_name: '',
      audit_date: new Date().toISOString().split('T')[0]
    });
  };

  const openEditDialog = (finding) => {
    setSelectedFinding(finding);
    setFormData({
      audit_type: finding.audit_type,
      clause_reference: finding.clause_reference,
      department: finding.department,
      finding_description: finding.finding_description,
      objective_evidence: finding.objective_evidence,
      severity: finding.severity,
      likelihood: finding.likelihood,
      auditor_name: finding.auditor_name,
      audit_date: finding.audit_date
    });
    setIsDialogOpen(true);
  };

  const getRiskBadgeClass = (risk) => {
    const classes = {
      Low: 'bg-emerald-100 text-emerald-800',
      Medium: 'bg-amber-100 text-amber-800',
      High: 'bg-orange-100 text-orange-800',
      Critical: 'bg-red-100 text-red-800'
    };
    return classes[risk] || 'bg-slate-100 text-slate-800';
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      Open: 'bg-amber-100 text-amber-800',
      'In Progress': 'bg-blue-100 text-blue-800',
      Closed: 'bg-emerald-100 text-emerald-800'
    };
    return classes[status] || 'bg-slate-100 text-slate-800';
  };

  const filteredFindings = findings.filter(f =>
    f.finding_description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.clause_reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.auditor_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6" data-testid="findings-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Audit Findings
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Manage and track all audit findings across ISO standards
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700" data-testid="new-finding-btn">
              <Plus className="w-4 h-4 mr-2" />
              New Finding
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
                {selectedFinding ? 'Edit Finding' : 'Record New Audit Finding'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Audit Type *</Label>
                  <Select
                    value={formData.audit_type}
                    onValueChange={(value) => setFormData({ ...formData, audit_type: value })}
                  >
                    <SelectTrigger data-testid="audit-type-select">
                      <SelectValue placeholder="Select standard" />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Clause Reference *</Label>
                  <Input
                    placeholder="e.g., 8.5.1"
                    value={formData.clause_reference}
                    onChange={(e) => setFormData({ ...formData, clause_reference: e.target.value })}
                    required
                    data-testid="clause-reference-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Department *</Label>
                  <Select
                    value={formData.department}
                    onValueChange={(value) => setFormData({ ...formData, department: value })}
                  >
                    <SelectTrigger data-testid="department-select">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Auditor Name *</Label>
                  <Input
                    placeholder="Enter auditor name"
                    value={formData.auditor_name}
                    onChange={(e) => setFormData({ ...formData, auditor_name: e.target.value })}
                    required
                    data-testid="auditor-name-input"
                  />
                </div>
              </div>

              <div>
                <Label>Finding Description *</Label>
                <Textarea
                  placeholder="Describe the nonconformity or observation..."
                  value={formData.finding_description}
                  onChange={(e) => setFormData({ ...formData, finding_description: e.target.value })}
                  rows={3}
                  required
                  data-testid="finding-description-input"
                />
              </div>

              <div>
                <Label>Objective Evidence *</Label>
                <Textarea
                  placeholder="Document references, records, observations..."
                  value={formData.objective_evidence}
                  onChange={(e) => setFormData({ ...formData, objective_evidence: e.target.value })}
                  rows={2}
                  required
                  data-testid="objective-evidence-input"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Severity (1-5)</Label>
                  <Select
                    value={String(formData.severity)}
                    onValueChange={(value) => setFormData({ ...formData, severity: parseInt(value) })}
                  >
                    <SelectTrigger data-testid="severity-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} - {['Negligible', 'Minor', 'Moderate', 'Major', 'Critical'][n-1]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Likelihood (1-5)</Label>
                  <Select
                    value={String(formData.likelihood)}
                    onValueChange={(value) => setFormData({ ...formData, likelihood: parseInt(value) })}
                  >
                    <SelectTrigger data-testid="likelihood-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} - {['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'][n-1]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Audit Date</Label>
                  <Input
                    type="date"
                    value={formData.audit_date}
                    onChange={(e) => setFormData({ ...formData, audit_date: e.target.value })}
                    data-testid="audit-date-input"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" data-testid="save-finding-btn">
                  {selectedFinding ? 'Update Finding' : 'Save Finding'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search findings..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="search-findings"
              />
            </div>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters({ ...filters, status: value === 'all' ? '' : value })}
            >
              <SelectTrigger className="w-[150px]" data-testid="filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.department}
              onValueChange={(value) => setFilters({ ...filters, department: value === 'all' ? '' : value })}
            >
              <SelectTrigger className="w-[150px]" data-testid="filter-department">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.audit_type}
              onValueChange={(value) => setFilters({ ...filters, audit_type: value === 'all' ? '' : value })}
            >
              <SelectTrigger className="w-[150px]" data-testid="filter-audit-type">
                <SelectValue placeholder="Standard" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Standards</SelectItem>
                {AUDIT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filters.risk_rating}
              onValueChange={(value) => setFilters({ ...filters, risk_rating: value === 'all' ? '' : value })}
            >
              <SelectTrigger className="w-[150px]" data-testid="filter-risk">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risks</SelectItem>
                {RISK_LEVELS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Findings Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : filteredFindings.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">No findings found</p>
              <p className="text-sm text-slate-400 mt-1">Create a new finding to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" data-testid="findings-table">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Standard</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Clause</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Department</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase max-w-xs">Description</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Risk</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Date</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFindings.map((finding) => (
                    <tr
                      key={finding.id}
                      className="border-b hover:bg-slate-50 transition-colors"
                      data-testid={`finding-row-${finding.id}`}
                    >
                      <td className="px-4 py-4 text-sm text-slate-700">{finding.audit_type}</td>
                      <td className="px-4 py-4 text-sm font-mono text-slate-600">{finding.clause_reference}</td>
                      <td className="px-4 py-4 text-sm text-slate-700">{finding.department}</td>
                      <td className="px-4 py-4 text-sm text-slate-700 max-w-xs truncate">
                        {finding.finding_description}
                      </td>
                      <td className="px-4 py-4">
                        <Badge className={getRiskBadgeClass(finding.risk_rating)}>
                          {finding.risk_rating}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge className={getStatusBadgeClass(finding.status)}>
                          {finding.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-500">
                        {finding.audit_date?.split('T')[0]}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/rca?finding=${finding.id}`)}
                            title="Start RCA"
                            data-testid={`start-rca-${finding.id}`}
                          >
                            <Search className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(finding)}
                            data-testid={`edit-finding-${finding.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(finding.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            data-testid={`delete-finding-${finding.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
