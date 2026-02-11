import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { cn } from '../lib/utils';
import { AlertTriangle, Info } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const SEVERITY_LABELS = ['Negligible', 'Minor', 'Moderate', 'Major', 'Critical'];
const LIKELIHOOD_LABELS = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Almost Certain'];

const getCellColor = (severity, likelihood) => {
  const score = (5 - severity) * 5 + likelihood + 1;
  const actualSeverity = 5 - severity;
  const riskScore = (actualSeverity + 1) * (likelihood + 1);
  
  if (riskScore >= 20) return 'bg-red-100 hover:bg-red-200 border-red-200';
  if (riskScore >= 12) return 'bg-orange-100 hover:bg-orange-200 border-orange-200';
  if (riskScore >= 6) return 'bg-amber-100 hover:bg-amber-200 border-amber-200';
  return 'bg-emerald-100 hover:bg-emerald-200 border-emerald-200';
};

const getRiskLabel = (severity, likelihood) => {
  const actualSeverity = 5 - severity;
  const riskScore = (actualSeverity + 1) * (likelihood + 1);
  
  if (riskScore >= 20) return 'Critical';
  if (riskScore >= 12) return 'High';
  if (riskScore >= 6) return 'Medium';
  return 'Low';
};

export const RiskMatrix = () => {
  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState(null);

  useEffect(() => {
    fetchMatrixData();
  }, []);

  const fetchMatrixData = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/risk-matrix`);
      setMatrixData(response.data);
    } catch (error) {
      console.error('Failed to fetch risk matrix:', error);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-[500px] bg-slate-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="risk-matrix-page">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Risk Assessment Matrix
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Severity vs Likelihood scoring for audit findings
        </p>
      </div>

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-6">
            <span className="text-sm font-medium text-slate-700">Risk Levels:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-100 border border-emerald-200 rounded" />
              <span className="text-sm text-slate-600">Low (1-5)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-amber-100 border border-amber-200 rounded" />
              <span className="text-sm text-slate-600">Medium (6-11)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-100 border border-orange-200 rounded" />
              <span className="text-sm text-slate-600">High (12-19)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 border border-red-200 rounded" />
              <span className="text-sm text-slate-600">Critical (20-25)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Matrix */}
      <Card>
        <CardHeader>
          <CardTitle style={{ fontFamily: 'Manrope, sans-serif' }}>Risk Assessment Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Header Row */}
              <div className="grid grid-cols-6 gap-1 mb-1">
                <div className="p-3 text-center">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Severity ↓ / Likelihood →</span>
                </div>
                {LIKELIHOOD_LABELS.map((label, index) => (
                  <div key={label} className="p-3 bg-slate-100 rounded-lg text-center">
                    <span className="text-xs font-semibold text-slate-700 block">{index + 1}</span>
                    <span className="text-[10px] text-slate-500">{label}</span>
                  </div>
                ))}
              </div>

              {/* Matrix Rows */}
              <TooltipProvider>
                {[4, 3, 2, 1, 0].map((severityIndex) => (
                  <div key={severityIndex} className="grid grid-cols-6 gap-1 mb-1">
                    {/* Row Label */}
                    <div className="p-3 bg-slate-100 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <span className="text-xs font-semibold text-slate-700 block">{5 - severityIndex}</span>
                        <span className="text-[10px] text-slate-500">{SEVERITY_LABELS[4 - severityIndex]}</span>
                      </div>
                    </div>

                    {/* Cells */}
                    {[0, 1, 2, 3, 4].map((likelihoodIndex) => {
                      const findings = matrixData?.matrix?.[severityIndex]?.[likelihoodIndex] || [];
                      const riskLabel = getRiskLabel(severityIndex, likelihoodIndex);
                      
                      return (
                        <Tooltip key={likelihoodIndex}>
                          <TooltipTrigger asChild>
                            <button
                              className={cn(
                                'p-3 rounded-lg border transition-all min-h-[80px] flex flex-col items-center justify-center cursor-pointer',
                                getCellColor(severityIndex, likelihoodIndex),
                                selectedCell?.severity === severityIndex && selectedCell?.likelihood === likelihoodIndex && 'ring-2 ring-blue-500'
                              )}
                              onClick={() => setSelectedCell(findings.length > 0 ? { severity: severityIndex, likelihood: likelihoodIndex, findings } : null)}
                              data-testid={`matrix-cell-${severityIndex}-${likelihoodIndex}`}
                            >
                              <span className="text-lg font-bold text-slate-700">
                                {findings.length}
                              </span>
                              <span className="text-[10px] text-slate-500 mt-1">
                                {riskLabel}
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="font-medium">{findings.length} finding(s)</p>
                            <p className="text-xs text-slate-400">
                              Severity: {5 - severityIndex} | Likelihood: {likelihoodIndex + 1}
                            </p>
                            <p className="text-xs">Risk Score: {(5 - severityIndex) * (likelihoodIndex + 1)}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}
              </TooltipProvider>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selected Cell Details */}
      {selectedCell && selectedCell.findings.length > 0 && (
        <Card className="animate-slide-up" data-testid="selected-findings">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Findings in Selected Cell
              <Badge className={getRiskBadgeClass(getRiskLabel(selectedCell.severity, selectedCell.likelihood))}>
                {getRiskLabel(selectedCell.severity, selectedCell.likelihood)} Risk
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {selectedCell.findings.map((finding, index) => (
                <div
                  key={finding.id || index}
                  className="p-3 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-700">{finding.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={getRiskBadgeClass(finding.risk_rating)} variant="outline">
                          {finding.risk_rating}
                        </Badge>
                        <Badge variant="outline" className={
                          finding.status === 'Closed' ? 'bg-emerald-50 text-emerald-700' :
                          finding.status === 'In Progress' ? 'bg-blue-50 text-blue-700' :
                          'bg-amber-50 text-amber-700'
                        }>
                          {finding.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-700 mb-1">How to use the Risk Matrix:</p>
              <ul className="list-disc list-inside space-y-1 text-slate-500">
                <li>Each cell shows the number of findings at that risk level</li>
                <li>Risk Score = Severity × Likelihood (ranges from 1 to 25)</li>
                <li>Click on any cell to view the findings at that risk level</li>
                <li>Prioritize addressing Critical and High risk findings first</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
