'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import axios from 'axios';
import { Settings2, Download, RefreshCw } from 'lucide-react';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface VisualizationBuilderProps {
  filename: string;
  columns: { name: string; type: string }[];
}

export default function VisualizationBuilder({ filename, columns }: VisualizationBuilderProps) {
  const [chartType, setChartType] = useState<'bar' | 'line' | 'scatter' | 'pie' | 'histogram' | 'box'>('bar');
  const [xAxis, setXAxis] = useState<string>('');
  const [yAxis, setYAxis] = useState<string>('');
  const [colorColumn, setColorColumn] = useState<string>('');
  const [title, setTitle] = useState<string>('My Chart');
  const [plotData, setPlotData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // 초기값 설정
  useEffect(() => {
    if (columns.length > 0) {
      setXAxis(columns[0].name);
      if (columns.length > 1) setYAxis(columns[1].name);
    }
  }, [columns]);

  const fetchData = async () => {
    if (!xAxis) return;
    setLoading(true);
    try {
      // 필요한 컬럼만 가져오기 (최적화)
      const cols = [xAxis];
      if (yAxis) cols.push(yAxis);
      if (colorColumn) cols.push(colorColumn);
      
      // 실제로는 전체 데이터를 가져오거나, 백엔드에서 특정 컬럼만 주는 API가 필요함.
      // 현재 백엔드 구조상 /analyze/column/{filename}/{column} 을 여러번 호출하거나
      // 전체 데이터를 가져오는 방식이 필요. 
      // 여기서는 편의상 각 컬럼을 개별 호출하여 조합합니다.
      
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
        type: chartType,
        name: yAxis || xAxis,
      };

      if (chartType === 'histogram') {
        trace.x = xData;
      } else if (chartType === 'pie') {
        trace.labels = xData;
        trace.values = yData;
        trace.type = 'pie';
      } else if (chartType === 'box') {
        trace.y = xData; // Box plot usually takes y for vertical
        trace.type = 'box';
        if (yAxis) trace.x = yData; // Group by
      } else {
        // Bar, Line, Scatter
        trace.x = xData;
        trace.y = yData;
        trace.mode = chartType === 'scatter' ? 'markers' : 'lines+markers';
        if (chartType === 'bar') trace.mode = undefined;
        
        if (colorData) {
            trace.marker = { color: colorData };
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
  }, [chartType, xAxis, yAxis, colorColumn]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
      {/* Controls Sidebar */}
      <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-6">
        <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
          <Settings2 className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-slate-900">차트 설정</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">차트 유형</label>
            <select 
              value={chartType} 
              onChange={(e) => setChartType(e.target.value as any)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            >
              <option value="bar">막대 차트 (Bar)</option>
              <option value="line">선 차트 (Line)</option>
              <option value="scatter">산점도 (Scatter)</option>
              <option value="pie">파이 차트 (Pie)</option>
              <option value="histogram">히스토그램 (Histogram)</option>
              <option value="box">박스 플롯 (Box)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">X 축 (데이터)</label>
            <select 
              value={xAxis} 
              onChange={(e) => setXAxis(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            >
              {columns.map(col => (
                <option key={col.name} value={col.name}>{col.name} ({col.type})</option>
              ))}
            </select>
          </div>

          {chartType !== 'histogram' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {chartType === 'pie' ? '값 (Values)' : chartType === 'box' ? '그룹 (Optional)' : 'Y 축 (값)'}
              </label>
              <select 
                value={yAxis} 
                onChange={(e) => setYAxis(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                <option value="">선택 안함</option>
                {columns.map(col => (
                  <option key={col.name} value={col.name}>{col.name} ({col.type})</option>
                ))}
              </select>
            </div>
          )}

          {(chartType === 'scatter' || chartType === 'bar') && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">색상 기준 (Optional)</label>
              <select 
                value={colorColumn} 
                onChange={(e) => setColorColumn(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              >
                <option value="">단일 색상</option>
                {columns.map(col => (
                  <option key={col.name} value={col.name}>{col.name} ({col.type})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">차트 제목</label>
            <input 
              type="text" 
              value={title} 
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <button 
            onClick={fetchData}
            className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      {/* Chart Area */}
      <div className="lg:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[500px] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button className="text-slate-400 hover:text-blue-600 transition-colors">
            <Download className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 w-full h-full min-h-[400px]">
          <Plot
            data={plotData}
            layout={{
              autosize: true,
              title: undefined, // handled by custom header
              xaxis: { title: xAxis },
              yaxis: { title: yAxis },
              margin: { l: 50, r: 20, t: 20, b: 50 },
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)',
            }}
            useResizeHandler={true}
            style={{ width: '100%', height: '100%' }}
            config={{ responsive: true }}
          />
        </div>
      </div>
    </div>
  );
}
