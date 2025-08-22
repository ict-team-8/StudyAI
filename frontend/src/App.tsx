// ===============================
// 설명: 페이지 쉘(헤더 + 상단 배경 + UploadPage)
// ===============================
import React, { useState } from "react";
import Header from "./components/Header";
import UploadPage from "./pages/UploadPage";
import Tabs, { type TabKey } from "./components/Tabs";

export default function App() {
  // ✅ 현재 활성 탭 상태 (초기값: 자료 업로드)
  const [tab, setTab] = useState<TabKey>("upload");

  // 각 탭별 콘텐츠(일단은 플레이스홀더 텍스트 → 나중에 실제 페이지로 교체)
  const Content = () => {
    switch (tab) {
      case "upload":
        return <UploadPage />; // 기존 업로드 화면 그대로
      case "qa":
        return <Placeholder title="요약 & Q&A" />;
      case "gen":
        return <Placeholder title="문제 생성" />;
      case "solve":
        return <Placeholder title="문제 풀이" />;
      case "analytics":
        return <Placeholder title="학습 분석" />;
    }
  };

  return (
    <div className="sa-root">
      <div className="sa-top-bg" />
      <Header />
      <main className="sa-main">
        {/* 히어로 영역은 고정 */}
        <section className="sa-hero">
          <h1 className="sa-hero__title">AI로 더 효율적인 학습을 시작하세요</h1>
          <p className="sa-hero__subtitle">
            자료 업로드부터 문제 풀이까지, 모든 학습 과정을 AI가 도와드립니다.
          </p>
        </section>

        {/* ✅ 탭: 현재 활성 탭 전달 + 클릭 시 상태 업데이트 */}
        <Tabs active={tab} onSelect={setTab} />

        {/* ✅ 탭에 따른 콘텐츠 전환 */}
        <Content />
      </main>
    </div>
  );
}

// 아주 간단한 임시 컴포넌트(디자인 톤 맞춤). 이후 실제 페이지로 바꿔치기만 하면 됨.
function Placeholder({ title }: { title: string }) {
  return (
    <section className="sa-card" style={{ padding: 32 }}>
      <div className="sa-card__title" style={{ marginBottom: 8 }}>
        {title}
      </div>
      <p className="sa-card__desc">이 탭의 화면은 아직 준비 중입니다.</p>
    </section>
  );
}