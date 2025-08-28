// ===============================
// 설명: 페이지 쉘(헤더 + 상단 배경 + UploadPage)
// ===============================
import React, { useState } from 'react';
import Header from './components/Header';
import UploadPage from './pages/UploadPage';
import Tabs, { type TabKey } from './components/Tabs';
import SummaryQA from './pages/SummaryQA';
import SmartQA from './pages/SmartQA';
import GenerateQuiz from './pages/GenerateQuiz';
import QuizPlayer from './pages/QuizPlayer';
import Analytics from './pages/Analytics';

export default function App() {
    // 현재 활성 탭 상태 (초기값: 자료 업로드)
    //const [tab, setTab] = useState<TabKey>('upload');
    // Tab -> View로 변환
    type View = 'upload' | 'summary' | 'qa' | 'gen' | 'solve' | 'analytics';
    const [view, setView] = useState<View>('upload');

    const [quizResult, setQuizResult] = useState<any | null>(null);
    const [subjectId, setSubjectId] = useState<number | null>(null);

    // 업로드 완료 콜백: subjectId 기억하고, 요약 탭으로 전환
    function handleUploaded(nextSubjectId: number) {
        setSubjectId(nextSubjectId);
        //setTab('qa'); // 요약 & Q&A 탭 활성화
        setView('summary'); // 업로드 이후, 곧바로 요약 단게로 이동!
    }

    // ✅ view를 탭 키로 변환 (요약/QA는 같은 'qa' 탭에 묶어서 하이라이트)
    const activeTab: TabKey =
        view === 'upload'
            ? 'upload'
            : view === 'summary' || view === 'qa'
            ? 'qa'
            : view === 'gen'
            ? 'gen'
            : view === 'solve'
            ? 'solve'
            : 'analytics';

    // 각 탭별 콘텐츠(일단은 플레이스홀더 텍스트 → 나중에 실제 페이지로 교체)
    const Content = () => {
        switch (view) {
            case 'upload':
                // ✅ 콜백 전달
                return <UploadPage onUploaded={handleUploaded} />;

            case 'summary':
                // 자동요약 모드 + 다음 단계로 넘어가는 콜백
                return <SummaryQA subjectId={subjectId} auto onNext={() => setView('qa')} />;

            case 'qa':
                // ✅ QA만 단독 페이지로
                return <SmartQA subjectId={subjectId} auto />;

            case 'gen':
                return (
                    <GenerateQuiz
                        // quizData.quiz_attempt_id + quizData.quiz
                        onQuiz={(quizData) => {
                            setQuizResult(quizData);
                            setView('solve');
                        }}
                    />
                );
            case 'solve':
                return quizResult ? (
                    <QuizPlayer quiz={quizResult.quiz} quizAttemptId={quizResult.quiz_attempt_id} onComplete={() => setView('analytics')}   // ✅ 제출 후 analytics로 이동
                     />
                ) : (
                    <Placeholder title="문제풀이" />
                );
            case 'analytics':
                return <Analytics subjectId={subjectId} onPickSubject={(id) => setSubjectId(id ?? null)}></Analytics>;
        }
    };

    // ✅ 탭 클릭 시 이동 규칙
    function handleTabSelect(next: TabKey) {
        if (next === 'upload') {
            setView('upload');
            return;
        }

        if (next === 'qa') {
            if (!subjectId) {
                alert('먼저 자료를 업로드하세요.');
                return;
            }
            // 규칙: QA 탭을 눌러도 항상 "자동 요약 → (확인 후) Q&A"로
            setView('summary'); // 요약 화면으로 들어가면 auto로 생성됨
            return;
        }

        if (next === 'gen') {
            if (!subjectId) {
                alert('먼저 자료를 업로드하세요.');
                return;
            }
            setView('gen');
            return;
        }

        if (next === 'solve') {
            setView('solve');
            return;
        }

        if (next === 'analytics') {
            setView('analytics');
            return;
        }
    }
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

                {/* ❌ Tabs 제거 (단계형 화면이므로) */}
                <Tabs active={activeTab} onSelect={handleTabSelect} />

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
