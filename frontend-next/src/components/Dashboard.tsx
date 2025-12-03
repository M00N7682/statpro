'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { 
  BarChart3, 
  ScatterChart, 
  PieChart, 
  TrendingUp, 
  Upload, 
  FileSpreadsheet,
  ArrowRight,
  Loader2,
  CheckSquare,
  Square,
  LayoutDashboard,
  Table as TableIcon,
  Sigma,
  Network,
  Bot
} from 'lucide-react';
import VisualizationBuilder from './VisualizationBuilder';
import ChatAgent from './ChatAgent';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

// Types
interface AnalysisType {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface DataPreview {
  filename: string;
  columns: { name: string; type: string }[];
  preview: Record<string, any>[];
  total_rows: number;
}

interface BasicStats {
  stats: Record<string, Record<string, number>>;
}

interface CorrelationData {
  x: string[];
  y: string[];
  z: number[][];
}

interface RegressionResult {
  slope: number;
  intercept: number;
  r_squared: number;
  p_value: number;
  std_err: number;
  scatter_data: { x: number[], y: number[] };
  line_data: { x: number[], y: number[] };
}

export default function Dashboard() {
  const [analysisTypes, setAnalysisTypes] = useState<AnalysisType[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [dataPreview, setDataPreview] = useState<DataPreview | null>(null);
  const [basicStats, setBasicStats] = useState<BasicStats | null>(null);
  
  // Correlation State
  const [correlationData, setCorrelationData] = useState<CorrelationData | null>(null);
  const [selectedCorrColumns, setSelectedCorrColumns] = useState<string[]>([]);
  
  // Regression State
  const [regressionX, setRegressionX] = useState<string>("");
  const [regressionY, setRegressionY] = useState<string>("");
  const [regressionResult, setRegressionResult] = useState<RegressionResult | null>(null);

  // AI Analysis State
  const [aiAnalysisResult, setAiAnalysisResult] = useState<{ type: 'plot' | 'table', data: any } | null>(null);

    const [activeTab, setActiveTab] = useState<'preview' | 'stats' | 'correlation' | 'visualization' | 'regression' | 'ai_result'>('preview');
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    // Mock or fetch analysis types
    setAnalysisTypes([
      { id: "basic_stats", name: "기초 통계", description: "데이터의 분포와 요약 통계", icon: "BarChart3" },
      { id: "correlation", name: "상관 분석", description: "변수 간의 관계 파악", icon: "ScatterChart" },
      { id: "regression", name: "회귀 분석", description: "인과 관계 예측 모델링", icon: "TrendingUp" },
      { id: "visualization", name: "시각화", description: "다양한 차트로 데이터 표현", icon: "PieChart" },
    ]);
  }, []);

  const handleAiAnalysisResult = (result: { type: 'plot' | 'table', data: any }) => {
    setAiAnalysisResult(result);
    setActiveTab('ai_result');
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      handleUpload(file);
    }
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:8000/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setDataPreview(response.data);
      
      // 초기 데이터 로드
      fetchBasicStats(response.data.filename);
      fetchCorrelation(response.data.filename); 
      
      // 회귀분석 초기값 설정
      if (response.data.columns.length > 0) {
        setRegressionX(response.data.columns[0].name);
        if (response.data.columns.length > 1) {
            setRegressionY(response.data.columns[1].name);
        } else {
            setRegressionY(response.data.columns[0].name);
        }
      }
      
    } catch (error) {
      console.error("Upload failed", error);
      alert("파일 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  };

  const fetchBasicStats = async (filename: string) => {
    try {
      const response = await axios.get(`http://localhost:8000/analyze/basic/${filename}`);
      setBasicStats(response.data);
      if (response.data.stats) {
          setSelectedCorrColumns(Object.keys(response.data.stats));
      }
    } catch (error) {
      console.error("Failed to fetch stats", error);
    }
  };

  const fetchCorrelation = async (filename: string, cols?: string[]) => {
    try {
      let url = `http://localhost:8000/analyze/correlation/${filename}`;
      if (cols && cols.length > 0) {
          const queryParams = cols.map(c => `cols=${encodeURIComponent(c)}`).join('&');
          url += `?${queryParams}`;
      }
      const response = await axios.get(url);
      setCorrelationData(response.data);
    } catch (error) {
      console.error("Failed to fetch correlation", error);
    }
  };

  const fetchRegression = async () => {
      if (!dataPreview || !regressionX || !regressionY) return;
      try {
          const response = await axios.get(`http://localhost:8000/analyze/regression/${dataPreview.filename}`, {
              params: { x: regressionX, y: regressionY }
          });
          setRegressionResult(response.data);
      } catch (error) {
          console.error("Failed to fetch regression", error);
          alert("회귀분석에 실패했습니다. 수치형 변수를 선택했는지 확인해주세요.");
      }
  }

  const toggleCorrColumn = (column: string) => {
      const newSelection = selectedCorrColumns.includes(column)
        ? selectedCorrColumns.filter(c => c !== column)
        : [...selectedCorrColumns, column];
      
      setSelectedCorrColumns(newSelection);
      if (dataPreview) {
          fetchCorrelation(dataPreview.filename, newSelection);
      }
  };

  if (!dataPreview) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-center mb-12 animate-fade-in-up">
          <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-2xl mb-6">
            <BarChart3 className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
            EasyDataViz
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed">
            데이터 분석이 어려우신가요? <br className="hidden md:block" />
            파일만 업로드하면 통계, 시각화, 예측까지 자동으로 처리해드립니다.
          </p>
        </div>

        <div className="w-full max-w-xl">
          <div className={`bg-white rounded-3xl shadow-xl border-2 border-dashed transition-all duration-300 ${isUploading ? 'border-blue-400 bg-blue-50 scale-95' : 'border-slate-200 hover:border-blue-400 hover:shadow-2xl'}`}>
            <label className="flex flex-col items-center justify-center w-full h-80 cursor-pointer">
              <input 
                type="file" 
                className="hidden" 
                accept=".csv, .xlsx, .xls"
                onChange={handleFileChange}
                disabled={isUploading}
              />
              {isUploading ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                  <p className="text-lg font-medium text-slate-700">데이터 분석 중...</p>
                  <p className="text-sm text-slate-500 mt-2">잠시만 기다려주세요</p>
                </div>
              ) : (
                <div className="flex flex-col items-center group">
                  <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 group-hover:bg-blue-100 transition-colors">
                    <Upload className="w-10 h-10 text-blue-600 group-hover:scale-110 transition-transform" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">파일 업로드</h3>
                  <p className="text-slate-500 mb-6 text-center px-4">
                    CSV 또는 Excel 파일을 드래그하거나 클릭하여 선택하세요
                  </p>
                  <span className="px-6 py-3 bg-slate-900 text-white rounded-xl font-medium group-hover:bg-blue-600 transition-colors shadow-lg shadow-slate-200">
                    파일 선택하기
                  </span>
                </div>
              )}
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 w-full max-w-4xl">
          {analysisTypes.map((type) => (
            <div key={type.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex flex-col items-center text-center">
              <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center mb-3 text-slate-600">
                {type.id === 'basic_stats' && <TableIcon className="w-5 h-5" />}
                {type.id === 'correlation' && <Network className="w-5 h-5" />}
                {type.id === 'regression' && <TrendingUp className="w-5 h-5" />}
                {type.id === 'visualization' && <PieChart className="w-5 h-5" />}
              </div>
              <span className="font-bold text-slate-900 text-sm">{type.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-10">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3 cursor-pointer" onClick={() => window.location.reload()}>
          <div className="bg-blue-600 p-2 rounded-lg">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg text-slate-900">EasyDataViz</span>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-2">Analysis</h3>
            <nav className="space-y-1">
              {[
                { id: 'preview', label: '데이터 미리보기', icon: LayoutDashboard },
                { id: 'stats', label: '기초 통계', icon: Sigma },
                { id: 'correlation', label: '상관 분석', icon: Network },
                { id: 'regression', label: '회귀 분석', icon: TrendingUp },
                { id: 'visualization', label: '시각화', icon: PieChart },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      activeTab === item.id 
                        ? 'bg-blue-50 text-blue-700 shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${activeTab === item.id ? 'text-blue-600' : 'text-slate-400'}`} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-sm text-slate-900 truncate">{dataPreview.filename}</span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              {dataPreview.total_rows.toLocaleString()} rows • {dataPreview.columns.length} columns
            </p>
            <button 
              onClick={() => setDataPreview(null)}
              className="w-full text-xs bg-white border border-slate-200 text-slate-600 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              다른 파일 열기
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top: Data Preview (Persistent) */}
          {dataPreview && (
            <div className="h-72 bg-white border-b border-slate-200 flex-shrink-0 flex flex-col">
              <div className="px-6 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-1.5 rounded-md">
                    <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-700 text-sm">{dataPreview.filename}</h3>
                    <p className="text-[10px] text-slate-500">{dataPreview.total_rows.toLocaleString()} rows • {dataPreview.columns.length} columns</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsChatOpen(!isChatOpen)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    isChatOpen 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Bot className={`w-4 h-4 ${isChatOpen ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>AI 분석가</span>
                </button>
              </div>
              
              <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-sm text-left text-slate-600 relative border-collapse">
                  <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                    <tr>
                      {dataPreview.columns.map((col) => (
                        <th key={col.name} className="px-6 py-3 font-bold whitespace-nowrap bg-slate-50">
                          {col.name}
                          <span className="block text-[10px] text-slate-400 font-normal mt-0.5">{col.type}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dataPreview.preview.map((row, idx) => (
                      <tr key={idx} className="bg-white hover:bg-blue-50/30 transition-colors">
                        {dataPreview.columns.map((col) => (
                          <td key={`${idx}-${col.name}`} className="px-6 py-2 whitespace-nowrap font-mono text-xs">
                            {row[col.name] !== null ? String(row[col.name]) : <span className="text-slate-300 italic">null</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
            <header className="mb-6">
              <h2 className="text-xl font-bold text-slate-900">
                {activeTab === 'preview' && '데이터 전체보기'}
                {activeTab === 'stats' && '기초 통계 분석'}
                {activeTab === 'correlation' && '상관 분석'}
                {activeTab === 'regression' && '회귀 분석'}
                {activeTab === 'visualization' && '데이터 시각화'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {activeTab === 'preview' && '데이터의 전체 구조를 확인합니다.'}
                {activeTab === 'stats' && '수치형 변수들의 주요 통계 지표를 확인합니다.'}
                {activeTab === 'correlation' && '변수들 간의 상관관계를 히트맵으로 분석합니다.'}
                {activeTab === 'regression' && '두 변수 간의 선형 관계를 모델링하고 예측합니다.'}
                {activeTab === 'visualization' && '다양한 차트를 통해 데이터를 시각적으로 탐색합니다.'}
                {activeTab === 'ai_result' && 'AI가 생성한 분석 결과를 확인합니다.'}
              </p>
            </header>

            <div className="animate-fade-in pb-10">
              {activeTab === 'preview' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-4">
                    <LayoutDashboard className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">데이터 분석을 시작하세요</h3>
                  <p className="text-slate-500 max-w-md mx-auto mb-6">
                    상단에서 데이터 미리보기를 확인할 수 있습니다.<br/>
                    좌측 메뉴에서 원하는 분석 도구를 선택하거나, 우측 상단의 <strong>AI 분석가</strong>와 대화해보세요.
                  </p>
                </div>
              )}          {activeTab === 'stats' && basicStats && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.entries(basicStats.stats).map(([colName, stats]) => (
                <div key={colName} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all duration-300 group">
                  <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                    <h4 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {colName}
                    </h4>
                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase tracking-wide">Numeric</span>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-sm font-medium">평균 (Mean)</span>
                      <span className="font-mono font-bold text-slate-900 bg-slate-50 px-2 py-0.5 rounded">{stats['mean'].toFixed(2)}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3 rounded-lg">
                            <span className="block text-xs text-slate-400 mb-1">최소 (Min)</span>
                            <span className="font-mono font-semibold text-slate-700">{stats['min']}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg">
                            <span className="block text-xs text-slate-400 mb-1">최대 (Max)</span>
                            <span className="font-mono font-semibold text-slate-700">{stats['max']}</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                      <span className="text-slate-500 text-sm">표준편차 (Std)</span>
                      <span className="font-mono text-slate-600">{stats['std'].toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-500 text-sm">중앙값 (Median)</span>
                      <span className="font-mono text-slate-600">{stats['50%']}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'correlation' && (
            <div className="flex flex-col lg:flex-row gap-6 h-[600px]">
              <div className="w-full lg:w-64 bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
                <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2 pb-2 border-b border-slate-100">
                  <CheckSquare className="w-4 h-4 text-blue-600" />
                  변수 선택
                </h4>
                <div className="space-y-2 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                  {basicStats && Object.keys(basicStats.stats).map(col => (
                    <div 
                      key={col} 
                      className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition-colors"
                      onClick={() => toggleCorrColumn(col)}
                    >
                      {selectedCorrColumns.includes(col) ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300" />
                      )}
                      <span className={`text-sm ${selectedCorrColumns.includes(col) ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
                        {col}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                {correlationData && correlationData.x.length > 1 ? (
                  <Plot
                    data={[{
                      z: correlationData.z,
                      x: correlationData.x,
                      y: correlationData.y,
                      type: 'heatmap',
                      colorscale: 'RdBu',
                      zmin: -1,
                      zmax: 1,
                    }]}
                    layout={{
                      autosize: true,
                      margin: { l: 50, r: 50, b: 50, t: 20 },
                    }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <Network className="w-12 h-12 mb-4 opacity-20" />
                    <p>2개 이상의 변수를 선택해야 상관분석을 할 수 있습니다.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'regression' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex flex-wrap items-end gap-4 mb-8 p-6 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">독립변수 (X)</label>
                  <select 
                    value={regressionX} 
                    onChange={(e) => setRegressionX(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {dataPreview.columns.map(col => (
                      <option key={col.name} value={col.name}>{col.name}</option>
                    ))}
                  </select>
                </div>
                <div className="pb-3 text-slate-300">
                  <ArrowRight className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">종속변수 (Y)</label>
                  <select 
                    value={regressionY} 
                    onChange={(e) => setRegressionY(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {dataPreview.columns.map(col => (
                      <option key={col.name} value={col.name}>{col.name}</option>
                    ))}
                  </select>
                </div>
                <button 
                  onClick={fetchRegression}
                  className="px-8 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg shadow-blue-200"
                >
                  <TrendingUp className="w-4 h-4" />
                  분석 실행
                </button>
              </div>

              {regressionResult && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 h-[500px] border border-slate-100 rounded-xl p-2">
                    <Plot
                      data={[
                        {
                          x: regressionResult.scatter_data.x,
                          y: regressionResult.scatter_data.y,
                          mode: 'markers',
                          type: 'scatter',
                          name: 'Data',
                          marker: { color: '#94a3b8', size: 8, opacity: 0.6 }
                        },
                        {
                          x: regressionResult.line_data.x,
                          y: regressionResult.line_data.y,
                          mode: 'lines',
                          type: 'scatter',
                          name: 'Regression Line',
                          line: { color: '#2563eb', width: 3 }
                        }
                      ]}
                      layout={{
                        autosize: true,
                        xaxis: { title: regressionX },
                        yaxis: { title: regressionY },
                        hovermode: 'closest',
                        margin: { l: 50, r: 20, t: 20, b: 50 },
                      }}
                      useResizeHandler={true}
                      style={{ width: '100%', height: '100%' }}
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                      <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Sigma className="w-4 h-4 text-blue-600" />
                        통계 요약
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                          <span className="text-slate-500">R-squared</span>
                          <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{regressionResult.r_squared.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                          <span className="text-slate-500">P-value</span>
                          <span className={`font-mono font-bold px-2 py-0.5 rounded ${regressionResult.p_value < 0.05 ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                            {regressionResult.p_value.toExponential(4)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Slope</span>
                          <span className="font-mono text-slate-900">{regressionResult.slope.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500">Intercept</span>
                          <span className="font-mono text-slate-900">{regressionResult.intercept.toFixed(4)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                      <h4 className="font-bold text-blue-900 mb-2 text-sm">💡 해석 가이드</h4>
                      <p className="text-xs text-blue-800 leading-relaxed">
                        <strong>R-squared</strong>가 1에 가까울수록 모델이 데이터를 잘 설명합니다.<br/><br/>
                        <strong>P-value</strong>가 0.05 미만이면 두 변수 간의 관계가 통계적으로 유의미합니다.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'visualization' && (
            <VisualizationBuilder 
              filename={dataPreview.filename} 
              columns={dataPreview.columns} 
            />
          )}

          {activeTab === 'ai_result' && aiAnalysisResult && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[600px] flex flex-col">
              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-100">
                <Bot className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-slate-900">AI 분석 결과</h3>
              </div>
              
              <div className="flex-1 overflow-auto">
                {aiAnalysisResult.type === 'plot' && (
                  <Plot
                    data={aiAnalysisResult.data.data}
                    layout={{
                      ...aiAnalysisResult.data.layout,
                      autosize: true,
                      margin: { l: 50, r: 50, t: 50, b: 50 },
                    }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                  />
                )}

                {aiAnalysisResult.type === 'table' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="px-6 py-3 font-medium text-slate-500">Metric</th>
                          {Object.keys(aiAnalysisResult.data).map(col => (
                            <th key={col} className="px-6 py-3 font-medium text-slate-900">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max'].map(metric => (
                          <tr key={metric} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                            <td className="px-6 py-3 font-medium text-slate-500 bg-slate-50/30">{metric}</td>
                            {Object.keys(aiAnalysisResult.data).map(col => (
                              <td key={`${col}-${metric}`} className="px-6 py-3 text-slate-700 font-mono">
                                {aiAnalysisResult.data[col][metric] !== undefined 
                                  ? typeof aiAnalysisResult.data[col][metric] === 'number' 
                                    ? aiAnalysisResult.data[col][metric].toFixed(4) 
                                    : aiAnalysisResult.data[col][metric]
                                  : '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </main>
        </div>

        {/* Chat Sidebar */}
        {isChatOpen && (
          <aside className="w-[400px] border-l border-slate-200 bg-white h-full shadow-xl z-20 transition-all flex flex-col">
            <ChatAgent 
              filename={dataPreview.filename} 
              onAnalysisResult={handleAiAnalysisResult}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
