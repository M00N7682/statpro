'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import axios from 'axios';
import { Settings2, Download, RefreshCw, Palette, Layout, Database } from 'lucide-react';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface VisualizationBuilderProps {
  filename: string;
  columns: { name: string; type: string }[];
}

export default function VisualizationBuilder({ filename, columns }: VisualizationBuilderProps) {
  // Data Settings
  const [chartType, setChartType] = useState<'bar' | 'line' | 'scatter' | 'pie' | 'histogram' | 'box'>('bar');
  const [xAxis, setXAxis] = useState<string>('');
  const [yAxis, setYAxis] = useState<string>('');
  const [colorColumn, setColorColumn] = useState<string>('');
  const [aggregation, setAggregation] = useState<'none' | 'count' | 'sum' | 'avg'>('none');

  // Style Settings
  const [title, setTitle] = useState<string>('My Analysis Chart');
  const [showLegend, setShowLegend] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [orientation, setOrientation] = useState<'v' | 'h'>('v');
  const [colorTheme, setColorTheme] = useState('default');

  const [plotData, setPlotData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'data' | 'style'>('data');

  // 초기값 설정
  useEffect(() => {
    if (columns.length > 0 && !xAxis) {
      setXAxis(columns[0].name);
      if (columns.length > 1) setYAxis(columns[1].name);
    }
  }, [columns]);

  const fetchData = async () => {
    if (!xAxis) return;
    setLoading(true);
    try {
      const xRes = await axios.get(`http://localhost:8000/analyze/column/${filename}/${xAxis}`);
      let yRes = null;
      if (yAxis) {
        yRes = await axios.get(`http://localhost:8000/analyze/column/${filename}/${yAxis}`);
      }
      
      let colorRes = null;
      if (colorColumn) {
        colorRes = await axios.get(`http://localhost:8000/analyze/column/${filename}/${colorColumn}`);
      }

      const xData = xRes.data.data;
      const yData = yRes ? yRes.data.data : null;
      const colorData = colorRes ? colorRes.data.data : null;

      let trace: any = {
        type: chartType === 'scatter' || chartType === 'line' ? 'scatter' : chartType,
        name: yAxis || xAxis,
      };

      // Aggregation Logic (Simple Client-side)
      let finalX = xData;
      let finalY = yData;

      if (aggregation !== 'none' && (chartType === 'bar' || chartType === 'pie')) {
        // Group by X and aggregate Y
        const grouped: Record<string, number[]> = {};
        xData.forEach((val: any, idx: number) => {
          const key = String(val);
          if (!grouped[key]) grouped[key] = [];
          if (yData && yData[idx] !== undefined) {
             grouped[key].push(Number(yData[idx]));
          } else {
             grouped[key].push(1); // Count case if no Y
          }
        });

        finalX = Object.keys(grouped);
        finalY = finalX.map(key => {
          const vals = grouped[key];
          if (aggregation === 'count') return vals.length;
          if (aggregation === 'sum') return vals.reduce((a, b) => a + b, 0);
          if (aggregation === 'avg') return vals.reduce((a, b) => a + b, 0) / vals.length;
          return vals[0];
        });
      }

      if (chartType === 'histogram') {
        trace.x = xData;
        trace.marker = { color: '#6366f1' };
      } else if (chartType === 'pie') {
        trace.labels = finalX;
        trace.values = finalY;
        trace.type = 'pie';
        trace.textinfo = 'label+percent';
      } else if (chartType === 'box') {
        if (orientation === 'v') {
            trace.y = xData;
            if (yAxis) trace.x = yData; // Grouping
        } else {
            trace.x = xData;
            if (yAxis) trace.y = yData;
        }
        trace.type = 'box';
        trace.boxpoints = 'outliers';
      } else {
        // Bar, Line, Scatter
        if (orientation === 'h' && chartType === 'bar') {
            trace.y = finalX;
            trace.x = finalY;
            trace.orientation = 'h';
        } else {
            trace.x = finalX;
            trace.y = finalY;
        }

        if (chartType === 'line') {
            trace.mode = 'lines+markers';
            trace.line = { shape: 'spline', width: 3 };
        } else if (chartType === 'scatter') {
            trace.mode = 'markers';
            trace.marker = { size: 10, opacity: 0.7 };
        }

        if (colorData && !aggregation) {
            trace.marker = { ...trace.marker, color: colorData, colorscale: 'Viridis', showscale: true };
        } else if (!colorData) {
             // Default colors
             if (chartType === 'bar') trace.marker = { color: '#3b82f6' };
             if (chartType === 'line') trace.line = { color: '#f59e0b', width: 3 };
        }
      }

      setPlotData([trace]);
    } catch (error) {
      console.error("Failed to fetch visualization data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [chartType, xAxis, yAxis, colorColumn, aggregation, orientation]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
      {/* Controls Sidebar */}
      <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        <div className="flex border-b border-slate-100">
            <button 
                onClick={() => setActiveTab('data')}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'data' ? 'text-blue-600 bg-blue-50/50 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <Database className="w-4 h-4" /> 데이터
            </button>
            <button 
                onClick={() => setActiveTab('style')}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'style' ? 'text-blue-600 bg-blue-50/50 border-b-2 border-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
                <Palette className="w-4 h-4" /> 스타일
            </button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
          {activeTab === 'data' ? (
              <>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">차트 유형</label>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { id: 'bar', label: 'Bar' },
                            { id: 'line', label: 'Line' },
                            { id: 'scatter', label: 'Scatter' },
                            { id: 'pie', label: 'Pie' },
                            { id: 'histogram', label: 'Hist' },
                            { id: 'box', label: 'Box' },
                        ].map(type => (
                            <button
                                key={type.id}
                                onClick={() => setChartType(type.id as any)}
                                className={`py-2 px-1 text-xs rounded-lg border transition-all ${chartType === type.id ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">X 축 (Main)</label>
                    <select 
                    value={xAxis} 
                    onChange={(e) => setXAxis(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                    {columns.map(col => (
                        <option key={col.name} value={col.name}>{col.name}</option>
                    ))}
                    </select>
                </div>

                {chartType !== 'histogram' && (
                    <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        {chartType === 'pie' ? '값 (Values)' : 'Y 축 (Values)'}
                    </label>
                    <select 
                        value={yAxis} 
                        onChange={(e) => setYAxis(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                        <option value="">선택 안함 (Count)</option>
                        {columns.map(col => (
                        <option key={col.name} value={col.name}>{col.name}</option>
                        ))}
                    </select>
                    </div>
                )}

                {(chartType === 'bar' || chartType === 'pie') && (
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">집계 방식 (Aggregation)</label>
                        <select 
                            value={aggregation} 
                            onChange={(e) => setAggregation(e.target.value as any)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        >
                            <option value="none">없음 (Raw Data)</option>
                            <option value="count">개수 (Count)</option>
                            <option value="sum">합계 (Sum)</option>
                            <option value="avg">평균 (Average)</option>
                        </select>
                    </div>
                )}

                {(chartType === 'scatter' || chartType === 'bar') && aggregation === 'none' && (
                    <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">색상 기준 (Color)</label>
                    <select 
                        value={colorColumn} 
                        onChange={(e) => setColorColumn(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                        <option value="">단일 색상</option>
                        {columns.map(col => (
                        <option key={col.name} value={col.name}>{col.name}</option>
                        ))}
                    </select>
                    </div>
                )}
              </>
          ) : (
              <>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">차트 제목</label>
                    <input 
                    type="text" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                </div>

                {chartType === 'bar' && (
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">방향</label>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setOrientation('v')}
                                className={`flex-1 py-2 text-xs rounded-lg border ${orientation === 'v' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200'}`}
                            >
                                세로 (Vertical)
                            </button>
                            <button 
                                onClick={() => setOrientation('h')}
                                className={`flex-1 py-2 text-xs rounded-lg border ${orientation === 'h' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-200'}`}
                            >
                                가로 (Horizontal)
                            </button>
                        </div>
                    </div>
                )}

                <div className="space-y-3 pt-2">
                    <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                        <input 
                            type="checkbox" 
                            checked={showLegend} 
                            onChange={(e) => setShowLegend(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-slate-700">범례 표시 (Legend)</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                        <input 
                            type="checkbox" 
                            checked={showGrid} 
                            onChange={(e) => setShowGrid(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-slate-700">그리드 표시 (Grid)</span>
                    </label>
                </div>
              </>
          )}

          <button 
            onClick={fetchData}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 rounded-xl transition-all shadow-lg shadow-slate-200 mt-4"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            차트 업데이트
          </button>
        </div>
      </div>

      {/* Chart Area */}
      <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[500px] flex flex-col relative">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <button className="text-slate-400 hover:text-blue-600 transition-colors p-2 hover:bg-blue-50 rounded-lg">
            <Download className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 w-full h-full min-h-[400px] bg-slate-50/50 rounded-lg border border-slate-100 p-4">
          <Plot
            data={plotData}
            layout={{
              autosize: true,
              title: undefined,
              xaxis: { 
                  title: orientation === 'h' ? yAxis : xAxis, 
                  showgrid: showGrid,
                  zeroline: false,
              },
              yaxis: { 
                  title: orientation === 'h' ? xAxis : yAxis, 
                  showgrid: showGrid,
                  zeroline: false,
              },
              showlegend: showLegend,
              margin: { l: 50, r: 20, t: 20, b: 50 },
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)',
              font: { family: 'Inter, sans-serif' },
              hovermode: 'closest',
            }}
            useResizeHandler={true}
            style={{ width: '100%', height: '100%' }}
            config={{ 
                responsive: true, 
                displayModeBar: true, 
                displaylogo: false,
                modeBarButtonsToRemove: ['lasso2d', 'select2d']
            }}
          />
        </div>
      </div>
    </div>
  );
}
