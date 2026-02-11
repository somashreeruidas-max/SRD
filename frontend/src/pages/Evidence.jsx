import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { toast } from 'sonner';
import {
  Upload,
  FileText,
  Image,
  FileSpreadsheet,
  File,
  Download,
  Trash2,
  Search,
  Filter,
  FolderOpen
} from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DOCUMENT_TYPES = [
  { value: 'sop', label: 'SOP Reference', icon: FileText },
  { value: 'photo', label: 'Photo Evidence', icon: Image },
  { value: 'lab_report', label: 'Lab Report', icon: FileSpreadsheet },
  { value: 'verification_record', label: 'Verification Record', icon: FileText },
  { value: 'other', label: 'Other Document', icon: File }
];

export const Evidence = () => {
  const [evidence, setEvidence] = useState([]);
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterFinding, setFilterFinding] = useState('');

  const [uploadData, setUploadData] = useState({
    file: null,
    finding_id: '',
    title: '',
    description: '',
    document_type: 'other'
  });

  useEffect(() => {
    fetchData();
  }, [filterType, filterFinding]);

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (filterType) params.append('document_type', filterType);
      if (filterFinding) params.append('finding_id', filterFinding);

      const [evidenceRes, findingsRes] = await Promise.all([
        axios.get(`${API_URL}/api/evidence?${params}`),
        axios.get(`${API_URL}/api/findings`)
      ]);
      setEvidence(evidenceRes.data);
      setFindings(findingsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadData.file || !uploadData.title) {
      toast.error('Please select a file and enter a title');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', uploadData.file);
    formData.append('title', uploadData.title);
    formData.append('description', uploadData.description);
    formData.append('document_type', uploadData.document_type);
    if (uploadData.finding_id) {
      formData.append('finding_id', uploadData.finding_id);
    }

    try {
      await axios.post(`${API_URL}/api/evidence`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Document uploaded successfully');
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (item) => {
    try {
      const response = await axios.get(`${API_URL}/api/evidence/${item.id}/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', item.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Failed to download file');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await axios.delete(`${API_URL}/api/evidence/${id}`);
      toast.success('Document deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  const resetForm = () => {
    setUploadData({
      file: null,
      finding_id: '',
      title: '',
      description: '',
      document_type: 'other'
    });
  };

  const getTypeIcon = (type) => {
    const typeConfig = DOCUMENT_TYPES.find(t => t.value === type);
    return typeConfig?.icon || File;
  };

  const getTypeBadgeColor = (type) => {
    const colors = {
      sop: 'bg-blue-100 text-blue-800',
      photo: 'bg-purple-100 text-purple-800',
      lab_report: 'bg-green-100 text-green-800',
      verification_record: 'bg-amber-100 text-amber-800',
      other: 'bg-slate-100 text-slate-800'
    };
    return colors[type] || colors.other;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const filteredEvidence = evidence.filter(e =>
    e.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.filename?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6" data-testid="evidence-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Evidence Repository
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Store and manage SOPs, photos, lab reports, and verification records
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-blue-600 hover:bg-blue-700" data-testid="upload-evidence-btn">
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>Upload Document</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4 mt-4">
              <div>
                <Label>File *</Label>
                <div className="mt-1 border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    onChange={(e) => setUploadData({ ...uploadData, file: e.target.files[0] })}
                    className="hidden"
                    id="file-upload"
                    data-testid="file-input"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    {uploadData.file ? (
                      <p className="text-sm text-slate-700">{uploadData.file.name}</p>
                    ) : (
                      <p className="text-sm text-slate-500">Click to select a file</p>
                    )}
                  </label>
                </div>
              </div>

              <div>
                <Label>Title *</Label>
                <Input
                  value={uploadData.title}
                  onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
                  placeholder="Document title"
                  required
                  data-testid="evidence-title-input"
                />
              </div>

              <div>
                <Label>Document Type</Label>
                <Select
                  value={uploadData.document_type}
                  onValueChange={(value) => setUploadData({ ...uploadData, document_type: value })}
                >
                  <SelectTrigger data-testid="document-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Related Finding (optional)</Label>
                <Select
                  value={uploadData.finding_id}
                  onValueChange={(value) => setUploadData({ ...uploadData, finding_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger data-testid="evidence-finding-select">
                    <SelectValue placeholder="Select finding" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {findings.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.finding_description?.substring(0, 40)}...
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Description</Label>
                <Input
                  value={uploadData.description}
                  onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
                  placeholder="Brief description (optional)"
                  data-testid="evidence-description-input"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700" disabled={uploading} data-testid="upload-btn">
                  {uploading ? 'Uploading...' : 'Upload'}
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
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="search-evidence"
              />
            </div>
            <Select
              value={filterType}
              onValueChange={(value) => setFilterType(value === 'all' ? '' : value)}
            >
              <SelectTrigger className="w-[180px]" data-testid="filter-doc-type">
                <SelectValue placeholder="Document Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {DOCUMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterFinding}
              onValueChange={(value) => setFilterFinding(value === 'all' ? '' : value)}
            >
              <SelectTrigger className="w-[200px]" data-testid="filter-evidence-finding">
                <SelectValue placeholder="Related Finding" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Findings</SelectItem>
                {findings.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.finding_description?.substring(0, 30)}...
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Document Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-40 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filteredEvidence.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No documents found</p>
            <p className="text-sm text-slate-400 mt-1">Upload your first document to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvidence.map((item) => {
            const TypeIcon = getTypeIcon(item.document_type);
            return (
              <Card key={item.id} className="hover:shadow-md transition-shadow" data-testid={`evidence-${item.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <TypeIcon className="w-5 h-5 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{item.title}</p>
                      <p className="text-xs text-slate-500 truncate">{item.filename}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={getTypeBadgeColor(item.document_type)} variant="outline">
                          {DOCUMENT_TYPES.find(t => t.value === item.document_type)?.label || 'Other'}
                        </Badge>
                        <span className="text-xs text-slate-400">{formatFileSize(item.file_size)}</span>
                      </div>
                      {item.description && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2">{item.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-1 mt-4 pt-3 border-t">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownload(item)}
                      data-testid={`download-${item.id}`}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(item.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      data-testid={`delete-evidence-${item.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
