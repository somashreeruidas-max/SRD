import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';
import {
  Plus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Edit,
  Trash2,
  ThumbsUp,
  Calendar,
  User,
  FileCheck,
  Mail,
  Bell
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const CAPA = () => {
  const [searchParams] = useSearchParams();
  const { hasRole } = useAuth();
  const [capas, setCapas] = useState([]);
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCapa, setSelectedCapa] = useState(null);
  const [filterFinding, setFilterFinding] = useState(searchParams.get('finding') || '');
  const [filterStatus, setFilterStatus] = useState('');

  const [formData, setFormData] = useState({
    finding_id: searchParams.get('finding') || '',
    action_type: 'corrective',
    action_plan: '',
    responsible_person: '',
    responsible_email: '',
    target_date: '',
    resources_required: '',
    verification_method: ''
  });

  useEffect(() => {
    fetchData();
  }, [filterFinding, filterStatus]);

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (filterFinding) params.append('finding_id', filterFinding);
      if (filterStatus) params.append('status', filterStatus);

      const [capaRes, findingsRes] = await Promise.all([
        axios.get(`${API_URL}/api/capa?${params}`),
        axios.get(`${API_URL}/api/findings`)
      ]);
      setCapas(capaRes.data);
      setFindings(findingsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedCapa) {
        await axios.put(`${API_URL}/api/capa/${selectedCapa.id}`, formData);
        toast.success('CAPA updated');
      } else {
        await axios.post(`${API_URL}/api/capa`, formData);
        toast.success('CAPA created');
      }
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to save CAPA');
    }
  };

  const handleStatusChange = async (capaId, status) => {
    try {
      await axios.put(`${API_URL}/api/capa/${capaId}`, { 
        status,
        completion_date: status === 'Completed' ? new Date().toISOString() : null
      });
      toast.success('Status updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleApproval = async (capaId) => {
    try {
      await axios.put(`${API_URL}/api/capa/${capaId}`, { approval_status: 'Approved' });
      toast.success('CAPA approved');
      fetchData();
    } catch (error) {
      toast.error('Failed to approve CAPA');
    }
  };

  const handleVerification = async (capaId, verified, notes) => {
    try {
      await axios.put(`${API_URL}/api/capa/${capaId}`, { 
        effectiveness_verified: verified,
        effectiveness_notes: notes
      });
      toast.success('Verification recorded');
      fetchData();
    } catch (error) {
      toast.error('Failed to record verification');
    }
  };

  const handleSendReminder = async (capaId) => {
    try {
      const response = await axios.post(`${API_URL}/api/notifications/send-reminder?capa_id=${capaId}`);
      toast.success(response.data.message);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send reminder');
    }
  };

  const handleCheckAllReminders = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/notifications/check-due-capas`);
      toast.success(response.data.message);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to check reminders');
    }
  };

  const resetForm = () => {
    setSelectedCapa(null);
    setFormData({
      finding_id: filterFinding || '',
      action_type: 'corrective',
      action_plan: '',
      responsible_person: '',
      responsible_email: '',
      target_date: '',
      resources_required: '',
      verification_method: ''
    });
  };

  const openEditDialog = (capa) => {
    setSelectedCapa(capa);
    setFormData({
      finding_id: capa.finding_id,
      action_type: capa.action_type,
      action_plan: capa.action_plan,
      responsible_person: capa.responsible_person,
      responsible_email: capa.responsible_email || '',
      target_date: capa.target_date,
      resources_required: capa.resources_required || '',
      verification_method: capa.verification_method || ''
    });
    setIsDialogOpen(true);
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      Pending: 'bg-amber-100 text-amber-800',
      'In Progress': 'bg-blue-100 text-blue-800',
      Completed: 'bg-emerald-100 text-emerald-800'
    };
    return classes[status] || 'bg-slate-100 text-slate-800';
  };

  const isOverdue = (targetDate) => {
    return new Date(targetDate) < new Date() && targetDate;
  };

  const getFindingDescription = (findingId) => {
    const finding = findings.find(f => f.id === findingId);
    return finding?.finding_description?.substring(0, 50) + '...' || 'Unknown Finding';
  };

  return (
    <div className="space-y-6" data-testid="capa-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            CAPA Management
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Corrective and Preventive Actions with approval workflow
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700" data-testid="new-capa-btn">
              <Plus className="w-4 h-4 mr-2" />
              New CAPA
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
                {selectedCapa ? 'Edit CAPA' : 'Create New CAPA'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Related Finding *</Label>
                  <Select
                    value={formData.finding_id}
                    onValueChange={(value) => setFormData({ ...formData, finding_id: value })}
                  >
                    <SelectTrigger data-testid="capa-finding-select">
                      <SelectValue placeholder="Select finding" />
                    </SelectTrigger>
                    <SelectContent>
                      {findings.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.finding_description?.substring(0, 40)}...
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Action Type *</Label>
                  <Select
                    value={formData.action_type}
                    onValueChange={(value) => setFormData({ ...formData, action_type: value })}
                  >
                    <SelectTrigger data-testid="action-type-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corrective">Corrective Action</SelectItem>
                      <SelectItem value="preventive">Preventive Action</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Action Plan *</Label>
                <Textarea
                  value={formData.action_plan}
                  onChange={(e) => setFormData({ ...formData, action_plan: e.target.value })}
                  rows={3}
                  placeholder="Describe the corrective/preventive action..."
                  required
                  data-testid="action-plan-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Responsible Person *</Label>
                  <Input
                    value={formData.responsible_person}
                    onChange={(e) => setFormData({ ...formData, responsible_person: e.target.value })}
                    placeholder="Name"
                    required
                    data-testid="responsible-person-input"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.responsible_email}
                    onChange={(e) => setFormData({ ...formData, responsible_email: e.target.value })}
                    placeholder="email@example.com"
                    data-testid="responsible-email-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Target Date *</Label>
                  <Input
                    type="date"
                    value={formData.target_date}
                    onChange={(e) => setFormData({ ...formData, target_date: e.target.value })}
                    required
                    data-testid="target-date-input"
                  />
                </div>
                <div>
                  <Label>Resources Required</Label>
                  <Input
                    value={formData.resources_required}
                    onChange={(e) => setFormData({ ...formData, resources_required: e.target.value })}
                    placeholder="Equipment, budget, etc."
                    data-testid="resources-input"
                  />
                </div>
              </div>

              <div>
                <Label>Verification Method</Label>
                <Textarea
                  value={formData.verification_method}
                  onChange={(e) => setFormData({ ...formData, verification_method: e.target.value })}
                  rows={2}
                  placeholder="How will effectiveness be verified?"
                  data-testid="verification-method-input"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" data-testid="save-capa-btn">
                  {selectedCapa ? 'Update' : 'Create'} CAPA
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
            <Select
              value={filterFinding}
              onValueChange={(value) => setFilterFinding(value === 'all' ? '' : value)}
            >
              <SelectTrigger className="w-[250px]" data-testid="filter-finding">
                <SelectValue placeholder="Filter by Finding" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Findings</SelectItem>
                {findings.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.finding_description?.substring(0, 40)}...
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filterStatus}
              onValueChange={(value) => setFilterStatus(value === 'all' ? '' : value)}
            >
              <SelectTrigger className="w-[150px]" data-testid="filter-capa-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="In Progress">In Progress</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* CAPA List */}
      {loading ? (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : capas.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No CAPAs found</p>
            <p className="text-sm text-slate-400 mt-1">Create a new CAPA to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {capas.map((capa) => (
            <Card key={capa.id} className="hover:shadow-md transition-shadow" data-testid={`capa-${capa.id}`}>
              <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={capa.action_type === 'corrective' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}>
                        {capa.action_type === 'corrective' ? 'Corrective' : 'Preventive'}
                      </Badge>
                      <Badge className={getStatusBadgeClass(capa.status)}>
                        {capa.status}
                      </Badge>
                      {capa.approval_status === 'Approved' && (
                        <Badge className="bg-emerald-100 text-emerald-800">
                          <ThumbsUp className="w-3 h-3 mr-1" />
                          Approved
                        </Badge>
                      )}
                      {isOverdue(capa.target_date) && capa.status !== 'Completed' && (
                        <Badge className="bg-red-100 text-red-800">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Overdue
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-slate-700 mb-3">{capa.action_plan}</p>

                    <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {capa.responsible_person}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Target: {capa.target_date}
                      </span>
                      {capa.verification_method && (
                        <span className="flex items-center gap-1">
                          <FileCheck className="w-3 h-3" />
                          Verification defined
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 mt-2">
                      Finding: {getFindingDescription(capa.finding_id)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {/* Status Actions */}
                    {capa.status === 'Pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(capa.id, 'In Progress')}
                        data-testid={`start-capa-${capa.id}`}
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        Start
                      </Button>
                    )}
                    {capa.status === 'In Progress' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(capa.id, 'Completed')}
                        className="text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                        data-testid={`complete-capa-${capa.id}`}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Complete
                      </Button>
                    )}

                    {/* Approval */}
                    {capa.approval_status !== 'Approved' && hasRole(['admin', 'qa_manager']) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApproval(capa.id)}
                        className="text-blue-600 border-blue-600 hover:bg-blue-50"
                        data-testid={`approve-capa-${capa.id}`}
                      >
                        <ThumbsUp className="w-3 h-3 mr-1" />
                        Approve
                      </Button>
                    )}

                    {/* Effectiveness Verification */}
                    {capa.status === 'Completed' && !capa.effectiveness_verified && hasRole(['admin', 'qa_manager']) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleVerification(capa.id, true, 'Verified effective')}
                        className="text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                        data-testid={`verify-capa-${capa.id}`}
                      >
                        <FileCheck className="w-3 h-3 mr-1" />
                        Verify
                      </Button>
                    )}

                    {capa.effectiveness_verified && (
                      <Badge className="bg-emerald-100 text-emerald-800">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Verified Effective
                      </Badge>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditDialog(capa)}
                      data-testid={`edit-capa-${capa.id}`}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
