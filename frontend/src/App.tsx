import React, { useEffect, useState } from 'react';
import axios from 'axios';
import PlotlyComponent from 'react-plotly.js';
import { 
  BarChart3, 
  ScatterChart, 
  PieChart, 
  TrendingUp, 
  Upload, 
  FileSpreadsheet,
  ArrowRight,
  Loader2,
  Activity,
  CheckSquare,
  Square
} from 'lucide-react';

const Plot = (PlotlyComponent as any).default || PlotlyComponent;

// 아이콘 매핑
const iconMap: Record<string, React.ElementType> = {
  BarChart3,
  ScatterChart,
  PieChart,
  TrendingUp
};

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

function App() {
  const [analysisTypes, setAnalysisTypes] = useState<AnalysisType[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dataPreview, setDataPreview] = useState<DataPreview | null>(null);
  const [basicStats, setBasicStats] = useState<BasicStats | null>(null);
  
  // Correlation State
  const [correlationData, setCorrelationData] = useState<CorrelationData | null>(null);
  const [selectedCorrColumns, setSelectedCorrColumns] = useState<string[]>([]);
  
  // Visualization State
  const [selectedColumn, setSelectedColumn] = useState<string>("");
  const [columnData, setColumnData] = useState<any[]>([]);
  
  // Regression State
  const [regressionX, setRegressionX] = useState<string>("");
  const [regressionY, setRegressionY] = useState<string>("");
  const [regressionResult, setRegressionResult] = useState<RegressionResult | null>(null);

  const [activeTab, setActiveTab] = useState<'preview' | 'stats' | 'correlation' | 'visualization' | 'regression'>('preview');

  useEffect(() => {
    axios.get('http://localhost:8000/analysis-types')
      .then(response => {
        setAnalysisTypes(response.data);
      })
      .catch(error => {
        console.error("Failed to fetch analysis types", error);
        setAnalysisTypes([
          { id: "basic_stats", name: "기초 통계 분석", description: "기본 통계 정보 확인", icon: "BarChart3" },
          { id: "correlation", name: "상관 분석", description: "상관관계 히트맵", icon: "ScatterChart" },
        ]);
      });
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setSelectedFile(file);
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
      fetchCorrelation(response.data.filename); // 전체 컬럼으로 초기 로드
      
      // 첫 번째 컬럼 선택 (시각화용)
      if (response.data.columns.length > 0) {
        setSelectedColumn(response.data.columns[0].name);
        fetchColumnData(response.data.filename, response.data.columns[0].name);
        
        // 회귀분석 초기값 설정 (가능하면 수치형으로)
        // 여기서는 단순히 첫번째, 두번째 컬럼을 선택한다고 가정하거나 비워둠
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
      // 통계 분석 결과가 있는 컬럼들을 상관분석 초기 선택 컬럼으로 설정
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

  const fetchColumnData = async (filename: string, column: string) => {
    try {
      const response = await axios.get(`http://localhost:8000/analyze/column/${filename}/${column}`);
      setColumnData(response.data.data);
    } catch (error) {
      console.error("Failed to fetch column data", error);
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

  const handleColumnSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const column = e.target.value;
    setSelectedColumn(column);
    if (dataPreview) {
      fetchColumnData(dataPreview.filename, column);
    }
  };

  const toggleCorrColumn = (column: string) => {
      const newSelection = selectedCorrColumns.includes(column)
        ? selectedCorrColumns.filter(c => c !== column)
        : [...selectedCorrColumns, column];
      
      setSelectedCorrColumns(newSelection);
      if (dataPreview) {
          fetchCorrelation(dataPreview.filename, newSelection);
      }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.reload()}>
            <div className="bg-blue-600 p-2 rounded-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">EasyDataViz</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!dataPreview ? (
          <>
            {/* Hero Section */}
            <div className="text-center mb-16">
              <h2 className="text-4xl font-extrabold text-slate-900 mb-4">
                데이터만 올리세요, 분석은 저희가 합니다
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                복잡한 코딩 없이 엑셀 파일 하나로 통계 분석부터 시각화까지.
              </p>
            </div>

            {/* File Upload Section */}
            <div className="max-w-2xl mx-auto mb-20">
              <div className={`bg-white rounded-2xl shadow-xl border-2 border-dashed ${isUploading ? 'border-blue-400 bg-blue-50' : 'border-blue-100'} p-10 text-center hover:border-blue-300 transition-colors cursor-pointer group relative`}>
                <input 
                  type="file" 
                  className="hidden" 
                  id="file-upload"
                  accept=".csv, .xlsx, .xls"
                  onChange={handleFileChange}
                  disabled={isUploading}
                />
                <label htmlFor="file-upload" className="cursor-pointer w-full h-full block">
                  {isUploading ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                      <p className="text-lg font-medium text-slate-700">데이터를 분석하고 있습니다...</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-100 transition-colors">
                        <Upload className="w-10 h-10 text-blue-600" />
                      </div>
                      <h3 className="text-xl font-semibold text-slate-900 mb-2">
                        분석할 데이터 파일을 올려주세요
                      </h3>
                      <p className="text-slate-500 mb-6">
                        CSV, Excel 파일 지원
                      </p>
                      <span className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                        <FileSpreadsheet className="w-5 h-5" />
                        파일 선택하기
                      </span>
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* Analysis Types Grid */}
            <div className="mb-12">
              <h3 className="text-2xl font-bold text-slate-900 mb-8 text-center">
                제공하는 분석 기능
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {analysisTypes.map((type) => {
                  const Icon = iconMap[type.icon] || BarChart3;
                  return (
                    <div key={type.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                      <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center mb-4 text-indigo-600">
                        <Icon className="w-6 h-6" />
                      </div>
                      <h4 className="text-lg font-bold text-slate-900 mb-2">{type.name}</h4>
                      <p className="text-slate-600 text-sm leading-relaxed">
                        {type.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          /* Analysis Result View */
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                  {dataPreview.filename}
                </h2>
                <p className="text-slate-500 mt-1">
                  총 {dataPreview.total_rows}개의 행이 로드되었습니다.
                </p>
              </div>
              <button 
                onClick={() => setDataPreview(null)}
                className="text-slate-600 hover:text-slate-900 font-medium px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                다른 파일 올리기
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-slate-200 mb-8 overflow-x-auto">
              {[
                { id: 'preview', label: '데이터 미리보기' },
                { id: 'stats', label: '기초 통계 분석' },
                { id: 'correlation', label: '상관 분석' },
                { id: 'visualization', label: '시각화' },
                { id: 'regression', label: '회귀 분석' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`pb-4 px-2 font-medium text-sm transition-colors relative whitespace-nowrap ${
                    activeTab === tab.id ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600" />
                  )}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
              {activeTab === 'preview' && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-600">
                      <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                        <tr>
                          {dataPreview.columns.map((col) => (
                            <th key={col.name} className="px-6 py-4 font-bold whitespace-nowrap">
                              {col.name}
                              <span className="block text-[10px] text-slate-400 font-normal mt-1">{col.type}</span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dataPreview.preview.map((row, idx) => (
                          <tr key={idx} className="bg-white border-b border-slate-100 hover:bg-slate-50">
                            {dataPreview.columns.map((col) => (
                              <td key={`${idx}-${col.name}`} className="px-6 py-4 whitespace-nowrap">
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

              {activeTab === 'stats' && basicStats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(basicStats.stats).map(([colName, stats]) => (
                    <div key={colName} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                      <h4 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-100 pb-2">
                        {colName}
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 text-sm">평균 (Mean)</span>
                          <span className="font-mono font-medium text-slate-900">{stats['mean'].toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 text-sm">표준편차 (Std)</span>
                          <span className="font-mono font-medium text-slate-900">{stats['std'].toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 text-sm">최소값 (Min)</span>
                          <span className="font-mono font-medium text-slate-900">{stats['min']}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 text-sm">최대값 (Max)</span>
                          <span className="font-mono font-medium text-slate-900">{stats['max']}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-500 text-sm">중앙값 (50%)</span>
                          <span className="font-mono font-medium text-slate-900">{stats['50%']}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'correlation' && (
                <div className="flex flex-col lg:flex-row gap-6">
                    {/* Sidebar for Column Selection */}
                    <div className="w-full lg:w-64 bg-white p-4 rounded-xl shadow-sm border border-slate-200 h-fit">
                        <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                            변수 선택
                        </h4>
                        <div className="space-y-2 max-h-[500px] overflow-y-auto">
                            {basicStats && Object.keys(basicStats.stats).map(col => (
                                <div 
                                    key={col} 
                                    className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 p-1 rounded"
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

                    {/* Heatmap Area */}
                    <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900 mb-4">상관관계 히트맵</h3>
                        {correlationData && correlationData.x.length > 1 ? (
                            <div className="w-full h-[600px]">
                            <Plot
                                data={[
                                {
                                    z: correlationData.z,
                                    x: correlationData.x,
                                    y: correlationData.y,
                                    type: 'heatmap',
                                    colorscale: 'RdBu',
                                    zmin: -1,
                                    zmax: 1,
                                }
                                ]}
                                layout={{
                                autosize: true,
                                title: '변수 간 상관관계',
                                margin: { l: 100, r: 50, b: 100, t: 50 },
                                }}
                                useResizeHandler={true}
                                style={{ width: '100%', height: '100%' }}
                            />
                            </div>
                        ) : (
                            <div className="text-center py-20 text-slate-500">
                            2개 이상의 변수를 선택해야 상관분석을 할 수 있습니다.
                            </div>
                        )}
                    </div>
                </div>
              )}

              {activeTab === 'visualization' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center gap-4 mb-6">
                      <label className="font-medium text-slate-700">분석할 컬럼 선택:</label>
                      <select 
                        value={selectedColumn} 
                        onChange={handleColumnSelect}
                        className="border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {dataPreview.columns.map(col => (
                          <option key={col.name} value={col.name}>{col.name} ({col.type})</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="h-[400px] border border-slate-100 rounded-lg p-2">
                        <Plot
                          data={[
                            {
                              x: columnData,
                              type: 'histogram',
                              marker: { color: '#3b82f6' },
                            }
                          ]}
                          layout={{
                            autosize: true,
                            title: `${selectedColumn} 분포 (Histogram)`,
                            xaxis: { title: selectedColumn },
                            yaxis: { title: 'Count' }
                          }}
                          useResizeHandler={true}
                          style={{ width: '100%', height: '100%' }}
                        />
                      </div>
                      <div className="h-[400px] border border-slate-100 rounded-lg p-2">
                        <Plot
                          data={[
                            {
                              y: columnData,
                              type: 'box',
                              marker: { color: '#8b5cf6' },
                              name: selectedColumn
                            }
                          ]}
                          layout={{
                            autosize: true,
                            title: `${selectedColumn} 박스플롯 (Boxplot)`,
                          }}
                          useResizeHandler={true}
                          style={{ width: '100%', height: '100%' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'regression' && (
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                      <div className="flex flex-wrap items-end gap-4 mb-8 p-4 bg-slate-50 rounded-lg border border-slate-100">
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">독립변수 (X)</label>
                              <select 
                                  value={regressionX} 
                                  onChange={(e) => setRegressionX(e.target.value)}
                                  className="border border-slate-300 rounded-lg px-3 py-2 w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                  {dataPreview.columns.map(col => (
                                      <option key={col.name} value={col.name}>{col.name}</option>
                                  ))}
                              </select>
                          </div>
                          <div className="pb-3 text-slate-400">
                              <ArrowRight className="w-5 h-5" />
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-slate-700 mb-1">종속변수 (Y)</label>
                              <select 
                                  value={regressionY} 
                                  onChange={(e) => setRegressionY(e.target.value)}
                                  className="border border-slate-300 rounded-lg px-3 py-2 w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
                              >
                                  {dataPreview.columns.map(col => (
                                      <option key={col.name} value={col.name}>{col.name}</option>
                                  ))}
                              </select>
                          </div>
                          <button 
                              onClick={fetchRegression}
                              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                          >
                              <TrendingUp className="w-4 h-4" />
                              분석 실행
                          </button>
                      </div>

                      {regressionResult && (
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                              <div className="lg:col-span-2 h-[500px] border border-slate-100 rounded-lg p-2">
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
                                          title: `회귀분석: ${regressionX} vs ${regressionY}`,
                                          xaxis: { title: regressionX },
                                          yaxis: { title: regressionY },
                                          hovermode: 'closest'
                                      }}
                                      useResizeHandler={true}
                                      style={{ width: '100%', height: '100%' }}
                                  />
                              </div>
                              <div className="space-y-4">
                                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                      <h4 className="font-bold text-slate-900 mb-3">분석 결과 요약</h4>
                                      <div className="space-y-2 text-sm">
                                          <div className="flex justify-between">
                                              <span className="text-slate-600">R-squared (설명력)</span>
                                              <span className="font-mono font-bold text-blue-600">{regressionResult.r_squared.toFixed(4)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                              <span className="text-slate-600">P-value (유의확률)</span>
                                              <span className={`font-mono font-bold ${regressionResult.p_value < 0.05 ? 'text-green-600' : 'text-red-500'}`}>
                                                  {regressionResult.p_value.toExponential(4)}
                                              </span>
                                          </div>
                                          <div className="flex justify-between">
                                              <span className="text-slate-600">기울기 (Slope)</span>
                                              <span className="font-mono text-slate-900">{regressionResult.slope.toFixed(4)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                              <span className="text-slate-600">절편 (Intercept)</span>
                                              <span className="font-mono text-slate-900">{regressionResult.intercept.toFixed(4)}</span>
                                          </div>
                                      </div>
                                  </div>
                                  
                                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                      <h4 className="font-bold text-blue-900 mb-2 text-sm">💡 해석 가이드</h4>
                                      <p className="text-xs text-blue-800 leading-relaxed">
                                          <strong>R-squared</strong>가 1에 가까울수록 회귀선이 데이터를 잘 설명합니다.<br/><br/>
                                          <strong>P-value</strong>가 0.05보다 작으면 두 변수 간에 통계적으로 유의미한 관계가 있다고 볼 수 있습니다.
                                      </p>
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
