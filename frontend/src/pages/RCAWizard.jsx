import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  AlertTriangle,
  FileText,
  Target,
  Search,
  GitBranch
} from 'lucide-react';
import { cn } from '../lib/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const STEPS = [
  { id: 1, name: 'Select Finding', description: 'Choose the audit finding' },
  { id: 2, name: 'Problem Statement', description: 'Define the problem clearly' },
  { id: 3, name: 'Analysis Method', description: 'Choose RCA method' },
  { id: 4, name: 'Root Cause', description: 'Identify the root cause' },
];

const FISHBONE_CATEGORIES = [
  { key: 'Man', label: 'Man (People)', color: 'bg-blue-100 text-blue-800' },
  { key: 'Machine', label: 'Machine (Equipment)', color: 'bg-purple-100 text-purple-800' },
  { key: 'Method', label: 'Method (Process)', color: 'bg-green-100 text-green-800' },
  { key: 'Material', label: 'Material (Input)', color: 'bg-amber-100 text-amber-800' },
  { key: 'Measurement', label: 'Measurement', color: 'bg-cyan-100 text-cyan-800' },
  { key: 'Environment', label: 'Environment', color: 'bg-rose-100 text-rose-800' },
];

export const RCAWizard = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    finding_id: searchParams.get('finding') || '',
    problem_statement: '',
    rca_type: '5-why',
    five_whys: [
      { why: 'Why did this happen?', answer: '' },
      { why: 'Why?', answer: '' },
      { why: 'Why?', answer: '' },
      { why: 'Why?', answer: '' },
      { why: 'Why?', answer: '' }
    ],
    fishbone: {
      Man: [],
      Machine: [],
      Method: [],
      Material: [],
      Measurement: [],
      Environment: []
    },
    fault_tree: { top_event: '', gates: [] },
    root_cause: ''
  });

  const [selectedFinding, setSelectedFinding] = useState(null);
  const [newCause, setNewCause] = useState({});

  useEffect(() => {
    fetchFindings();
  }, []);

  useEffect(() => {
    if (formData.finding_id && findings.length > 0) {
      const found = findings.find(f => f.id === formData.finding_id);
      if (found) {
        setSelectedFinding(found);
        setFormData(prev => ({
          ...prev,
          problem_statement: found.finding_description
        }));
      }
    }
  }, [formData.finding_id, findings]);

  const fetchFindings = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/findings`);
      setFindings(response.data.filter(f => f.status !== 'Closed'));
    } catch (error) {
      console.error('Failed to fetch findings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && !formData.finding_id) {
      toast.error('Please select a finding');
      return;
    }
    if (currentStep === 2 && !formData.problem_statement.trim()) {
      toast.error('Please enter a problem statement');
      return;
    }
    setCurrentStep(prev => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const addFishboneCause = (category) => {
    const cause = newCause[category]?.trim();
    if (!cause) return;
    
    setFormData(prev => ({
      ...prev,
      fishbone: {
        ...prev.fishbone,
        [category]: [...prev.fishbone[category], cause]
      }
    }));
    setNewCause(prev => ({ ...prev, [category]: '' }));
  };

  const removeFishboneCause = (category, index) => {
    setFormData(prev => ({
      ...prev,
      fishbone: {
        ...prev.fishbone,
        [category]: prev.fishbone[category].filter((_, i) => i !== index)
      }
    }));
  };

  const updateWhyAnswer = (index, answer) => {
    setFormData(prev => ({
      ...prev,
      five_whys: prev.five_whys.map((item, i) => 
        i === index ? { ...item, answer } : item
      )
    }));
  };

  const handleSubmit = async () => {
    if (!formData.root_cause.trim()) {
      toast.error('Please enter the identified root cause');
      return;
    }

    setSaving(true);
    try {
      await axios.post(`${API_URL}/api/rca`, {
        finding_id: formData.finding_id,
        rca_type: formData.rca_type,
        problem_statement: formData.problem_statement,
        five_whys: formData.rca_type === '5-why' ? formData.five_whys : null,
        fishbone: formData.rca_type === 'fishbone' ? formData.fishbone : null,
        fault_tree: formData.rca_type === 'fault-tree' ? formData.fault_tree : null,
        root_cause: formData.root_cause
      });
      toast.success('Root cause analysis saved!');
      navigate(`/capa?finding=${formData.finding_id}`);
    } catch (error) {
      toast.error('Failed to save RCA');
    } finally {
      setSaving(false);
    }
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

  return (
    <div className="max-w-4xl mx-auto space-y-6" data-testid="rca-wizard">
      {/* Progress Steps */}
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex items-center">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors',
                      currentStep > step.id
                        ? 'bg-emerald-500 text-white'
                        : currentStep === step.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-500'
                    )}
                  >
                    {currentStep > step.id ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      step.id
                    )}
                  </div>
                  <div className="ml-3 hidden sm:block">
                    <p className={cn(
                      'text-sm font-medium',
                      currentStep >= step.id ? 'text-slate-900' : 'text-slate-500'
                    )}>
                      {step.name}
                    </p>
                    <p className="text-xs text-slate-500">{step.description}</p>
                  </div>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-1 mx-4 rounded-full',
                      currentStep > step.id ? 'bg-emerald-500' : 'bg-slate-200'
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      <Card className="min-h-[400px]">
        <CardContent className="p-6">
          {/* Step 1: Select Finding */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Select Audit Finding
                </h3>
                <p className="text-sm text-slate-500">
                  Choose the finding you want to analyze
                </p>
              </div>

              <div>
                <Label>Finding</Label>
                <Select
                  value={formData.finding_id}
                  onValueChange={(value) => setFormData({ ...formData, finding_id: value })}
                >
                  <SelectTrigger className="w-full" data-testid="finding-select">
                    <SelectValue placeholder="Select a finding" />
                  </SelectTrigger>
                  <SelectContent>
                    {findings.map((finding) => (
                      <SelectItem key={finding.id} value={finding.id}>
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[300px]">
                            {finding.finding_description?.substring(0, 50)}...
                          </span>
                          <Badge className={getRiskBadgeClass(finding.risk_rating)} variant="outline">
                            {finding.risk_rating}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedFinding && (
                <Card className="bg-slate-50 border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{selectedFinding.audit_type}</Badge>
                          <Badge variant="outline">{selectedFinding.department}</Badge>
                          <Badge className={getRiskBadgeClass(selectedFinding.risk_rating)}>
                            {selectedFinding.risk_rating}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-700">{selectedFinding.finding_description}</p>
                        <p className="text-xs text-slate-500 mt-2">
                          <strong>Evidence:</strong> {selectedFinding.objective_evidence}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 2: Problem Statement */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Define Problem Statement
                </h3>
                <p className="text-sm text-slate-500">
                  Clearly describe the problem to be analyzed
                </p>
              </div>

              <div>
                <Label>Problem Statement *</Label>
                <Textarea
                  value={formData.problem_statement}
                  onChange={(e) => setFormData({ ...formData, problem_statement: e.target.value })}
                  rows={4}
                  placeholder="Describe the problem clearly and specifically..."
                  className="mt-1"
                  data-testid="problem-statement-input"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Tip: Be specific about what happened, when, where, and the impact
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Analysis Method */}
          {currentStep === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Root Cause Analysis
                </h3>
                <p className="text-sm text-slate-500">
                  Select and apply an analysis method
                </p>
              </div>

              <div className="flex gap-4 mb-6">
                <Button
                  variant={formData.rca_type === '5-why' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, rca_type: '5-why' })}
                  className={formData.rca_type === '5-why' ? 'bg-blue-600' : ''}
                  data-testid="5why-method-btn"
                >
                  <Search className="w-4 h-4 mr-2" />
                  5-Why Analysis
                </Button>
                <Button
                  variant={formData.rca_type === 'fishbone' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, rca_type: 'fishbone' })}
                  className={formData.rca_type === 'fishbone' ? 'bg-blue-600' : ''}
                  data-testid="fishbone-method-btn"
                >
                  <GitBranch className="w-4 h-4 mr-2" />
                  Fishbone Diagram
                </Button>
              </div>

              {/* 5-Why Analysis */}
              {formData.rca_type === '5-why' && (
                <div className="space-y-4" data-testid="5why-analysis">
                  {formData.five_whys.map((item, index) => (
                    <div key={index} className="flex gap-4 items-start">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-sm font-semibold text-blue-600">{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <Label className="text-slate-700">{item.why}</Label>
                        <Textarea
                          value={item.answer}
                          onChange={(e) => updateWhyAnswer(index, e.target.value)}
                          rows={2}
                          placeholder="Enter your answer..."
                          className="mt-1"
                          data-testid={`why-answer-${index}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Fishbone Analysis */}
              {formData.rca_type === 'fishbone' && (
                <div className="space-y-4" data-testid="fishbone-analysis">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {FISHBONE_CATEGORIES.map((category) => (
                      <Card key={category.key} className="bg-slate-50">
                        <CardHeader className="py-3 px-4">
                          <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Badge className={category.color}>{category.label}</Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 pt-0">
                          <div className="flex gap-2 mb-2">
                            <Input
                              placeholder="Add a cause..."
                              value={newCause[category.key] || ''}
                              onChange={(e) => setNewCause({ ...newCause, [category.key]: e.target.value })}
                              onKeyPress={(e) => e.key === 'Enter' && addFishboneCause(category.key)}
                              className="text-sm"
                              data-testid={`fishbone-input-${category.key}`}
                            />
                            <Button
                              size="icon"
                              variant="outline"
                              onClick={() => addFishboneCause(category.key)}
                            >
                              <Plus className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="space-y-1">
                            {formData.fishbone[category.key].map((cause, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between bg-white px-2 py-1 rounded text-sm"
                              >
                                <span>{cause}</span>
                                <button
                                  onClick={() => removeFishboneCause(category.key, index)}
                                  className="text-slate-400 hover:text-red-500"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Root Cause */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Identified Root Cause
                </h3>
                <p className="text-sm text-slate-500">
                  Summarize the root cause based on your analysis
                </p>
              </div>

              {/* Analysis Summary */}
              <Card className="bg-slate-50">
                <CardContent className="p-4">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Analysis Summary</h4>
                  {formData.rca_type === '5-why' && (
                    <div className="space-y-2">
                      {formData.five_whys.filter(w => w.answer).map((item, index) => (
                        <div key={index} className="flex gap-2 text-sm">
                          <span className="font-medium text-blue-600">Why {index + 1}:</span>
                          <span className="text-slate-600">{item.answer}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {formData.rca_type === 'fishbone' && (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(formData.fishbone).map(([key, causes]) =>
                        causes.map((cause, i) => (
                          <Badge key={`${key}-${i}`} variant="outline" className="text-xs">
                            {key}: {cause}
                          </Badge>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <div>
                <Label>Root Cause Statement *</Label>
                <Textarea
                  value={formData.root_cause}
                  onChange={(e) => setFormData({ ...formData, root_cause: e.target.value })}
                  rows={4}
                  placeholder="State the identified root cause clearly..."
                  className="mt-1"
                  data-testid="root-cause-input"
                />
                <p className="text-xs text-slate-500 mt-2">
                  This should be the fundamental cause that, if eliminated, would prevent recurrence
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">Next Step</p>
                  <p className="text-sm text-amber-700">
                    After saving, you'll be directed to create Corrective and Preventive Actions (CAPA)
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        {/* Footer Navigation */}
        <div className="border-t px-6 py-4 flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
            data-testid="back-btn"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          {currentStep < 4 ? (
            <Button
              onClick={handleNext}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="next-btn"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700"
              data-testid="save-rca-btn"
            >
              {saving ? 'Saving...' : 'Save & Continue to CAPA'}
              <Target className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};
