import React, { useEffect, useState } from 'react';
import api from '../api';
import './QuizComplete.css';

type AttemptItem = {
    question_id: number;
    stem: string;
    user_answer: string;
    correct_answer: string;
    is_correct: boolean;
    explanation?: string;
    difficulty: string;
};

type AttemptSummary = {
    quiz_attempt_id: number;
    quiz_id: number;
    started_at: string;
    finished_at: string;
    total_count: number;
    correct_count: number;
    accuracy: number;
    score: number;
    grade: string; // ✅ 백엔드에서 계산된 등급
    items: AttemptItem[];
};

type Props = {
    attemptId: number; // App.tsx에서 quiz_attempt_id를 넘겨받음
};

export default function QuizComplete({ attemptId }: Props) {
    const [result, setResult] = useState<AttemptSummary | null>(null);

    // API 호출
    useEffect(() => {
        async function fetchData() {
            try {
                const res = await api.get(`/quiz/attempt/${attemptId}`);
                setResult(res.data.data);
            } catch (err) {
                console.error('퀴즈 결과 조회 실패', err);
            }
        }
        fetchData();
    }, [attemptId]);

    // 메트릭 카드에 동적 값 설정
    useEffect(() => {
        if (result) {
            const elapsed = (() => {
                const start = new Date(result.started_at).getTime();
                const end = new Date(result.finished_at).getTime();
                const diff = Math.max(0, end - start) / 1000;
                const min = Math.floor(diff / 60);
                const sec = Math.floor(diff % 60);
                return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
            })();

            // 동적으로 카드 값들 설정
            const cards = document.querySelectorAll('.qc-metrics > div');
            if (cards.length >= 4) {
                // 정답 개수
                const correctCard = cards[0] as HTMLElement;
                correctCard.style.setProperty('--value', `${result.correct_count}`);
                correctCard.setAttribute('data-value', `${result.correct_count}`);

                // 정답률
                const accuracyCard = cards[1] as HTMLElement;
                accuracyCard.setAttribute('data-value', `${result.accuracy.toFixed(0)}%`);

                // 소요 시간
                const timeCard = cards[2] as HTMLElement;
                timeCard.setAttribute('data-value', elapsed);

                // 등급
                const gradeCard = cards[3] as HTMLElement;
                gradeCard.setAttribute('data-value', result.grade);
            }

            // ::after 콘텐츠 업데이트
            const summaryElement = document.querySelector('.qc-summary');
            if (summaryElement) {
                const style = document.createElement('style');
                style.textContent = `
            .qc-summary::after {
              content: "총 ${result.total_count}문제 중 ${result.correct_count}문제를 맞히셨습니다";
            }
          `;
                document.head.appendChild(style);
            }
        }
    }, [result]);

    if (!result) {
        return <div className="qc-container">결과를 불러오는 중...</div>;
    }

    const elapsed = (() => {
        const start = new Date(result.started_at).getTime();
        const end = new Date(result.finished_at).getTime();
        const diff = Math.max(0, end - start) / 1000;
        const min = Math.floor(diff / 60);
        const sec = Math.floor(diff % 60);
        return `${min}분 ${sec}초`;
    })();

    return (
        <div className="qc-container">
            {/* 상단 요약 */}
            <section className="qc-summary">
                <h2>퀴즈 결과</h2>
                <div className="qc-metrics">
                    <div>
                        <span className="qc-metric-value qc-metric-value--correct">{result.correct_count}</span>
                        맞춘 문제
                        <br />/ {result.total_count}문제
                    </div>
                    <div>
                        <span className="qc-metric-value qc-metric-value--accuracy">{result.accuracy.toFixed(0)}%</span>
                        정답률
                        <br />
                        실력 향상
                    </div>
                    <div>
                        <span className="qc-metric-value qc-metric-value--time">
                            {elapsed.replace('분 ', ':').replace('초', '')}
                        </span>
                        소요 시간
                        <br />총 {elapsed}
                    </div>
                    <div>
                        <span className="qc-metric-value qc-metric-value--grade">{result.grade}</span>
                        등급
                    </div>
                </div>
                <button className="qc-retry-btn">다시 풀어보기</button>
            </section>

            {/* 문제 복습 */}
            <section className="qc-review">
                <h3>문제별 상세 결과</h3>
                {result.items.map((item, idx) => (
                    <div
                        key={item.question_id}
                        className={`qc-question ${item.is_correct ? 'qc-correct' : 'qc-wrong'}`}
                    >
                        <div className="qc-qmeta">
                            <span>{idx + 1}번</span>
                            <span className={`qc-diff qc-diff--${item.difficulty}`}>{item.difficulty}</span>
                        </div>
                        <div className="qc-stem">{item.stem}</div>
                        <div className="qc-answer">
                            <strong>내 답: </strong> {item.user_answer || '미응답'}
                        </div>
                        <div className="qc-correct-answer">
                            <strong>정답: </strong> {item.correct_answer}
                        </div>
                        {item.explanation && (
                            <div className="qc-explain">
                                <strong>해설: </strong> {item.explanation}
                            </div>
                        )}
                    </div>
                ))}
            </section>
        </div>
    );
}
