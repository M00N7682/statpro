import Dashboard from '@/components/Dashboard';

export const metadata = {
  title: 'EasyDataViz - 데이터 분석 및 시각화',
  description: '누구나 쉽게 사용할 수 있는 데이터 분석 및 시각화 도구입니다. 엑셀 파일을 업로드하여 통계 분석, 상관 분석, 회귀 분석을 수행하세요.',
};

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <Dashboard />
    </main>
  );
}
