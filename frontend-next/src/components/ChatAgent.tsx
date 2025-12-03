'use client';

import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { Send, Bot, User, Key, AlertCircle, Loader2 } from 'lucide-react';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface ChatAgentProps {
  filename: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type: 'text' | 'plot' | 'table';
  plotConfig?: any;
  tableData?: any;
  timestamp: Date;
}

export default function ChatAgent({ filename }: ChatAgentProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `안녕하세요! ${filename} 데이터에 대해 무엇이든 물어보세요. (예: "데이터 요약해줘", "가격 컬럼의 평균은?", "판매량 분포 그려줘")`,
      type: 'text',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const storedKey = localStorage.getItem('openai_api_key');
    if (storedKey) setApiKey(storedKey);
  }, []);

  const handleSaveApiKey = () => {
    localStorage.setItem('openai_api_key', apiKey);
    setShowApiKeyInput(false);
    alert('API Key가 저장되었습니다.');
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      type: 'text',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await axios.post('http://localhost:8000/analyze/chat', {
        filename,
        query: userMessage.content,
        api_key: apiKey || null
      });

      const data = response.data;
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content || '결과를 생성했습니다.',
        type: data.type || 'text',
        plotConfig: data.plot_config,
        tableData: data.table,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '죄송합니다. 분석 중 오류가 발생했습니다.',
        type: 'text',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-slate-900">AI 데이터 분석가</h3>
        </div>
        <button 
          onClick={() => setShowApiKeyInput(!showApiKeyInput)}
          className={`p-2 rounded-lg transition-colors ${apiKey ? 'text-green-600 bg-green-50' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
          title="OpenAI API Key 설정"
        >
          <Key className="w-4 h-4" />
        </button>
      </div>

      {/* API Key Input Area */}
      {showApiKeyInput && (
        <div className="p-4 bg-blue-50 border-b border-blue-100 animate-fade-in">
          <div className="flex gap-2">
            <input 
              type="password" 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              onClick={handleSaveApiKey}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              저장
            </button>
          </div>
          <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            API Key는 브라우저에만 저장되며 서버로 전송될 때만 사용됩니다.
          </p>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/30 custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-slate-900 text-white' : 'bg-blue-100 text-blue-600'}`}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            
            <div className={`max-w-[80%] space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-slate-900 text-white rounded-tr-none' 
                  : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
              }`}>
                {msg.content}
              </div>

              {/* Plot Rendering */}
              {msg.type === 'plot' && msg.plotConfig && (
                <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm w-full h-[300px]">
                  <Plot
                    data={msg.plotConfig.data}
                    layout={{
                      ...msg.plotConfig.layout,
                      autosize: true,
                      margin: { l: 40, r: 20, t: 30, b: 40 },
                      font: { size: 10 }
                    }}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: false }}
                  />
                </div>
              )}

              {/* Table Rendering */}
              {msg.type === 'table' && msg.tableData && (
                 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-w-full">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="px-4 py-2 font-medium text-slate-500">Metric</th>
                                    {Object.keys(msg.tableData).map(col => (
                                        <th key={col} className="px-4 py-2 font-medium text-slate-900">{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max'].map(metric => (
                                    <tr key={metric} className="border-b border-slate-50 last:border-0">
                                        <td className="px-4 py-2 font-medium text-slate-500 bg-slate-50/50">{metric}</td>
                                        {Object.keys(msg.tableData).map(col => (
                                            <td key={`${col}-${metric}`} className="px-4 py-2 text-slate-700 font-mono">
                                                {msg.tableData[col][metric] !== undefined 
                                                    ? typeof msg.tableData[col][metric] === 'number' 
                                                        ? msg.tableData[col][metric].toFixed(2) 
                                                        : msg.tableData[col][metric]
                                                    : '-'}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                 </div>
              )}
              
              <span className="text-[10px] text-slate-400 px-1">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={apiKey ? "데이터에 대해 궁금한 점을 물어보세요..." : "API Key가 없으면 간단한 질문만 가능합니다 (예: 컬럼 보여줘)"}
            className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className={`p-3 rounded-xl transition-all ${
              isLoading || !input.trim() 
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
            }`}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
