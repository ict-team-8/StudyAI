import React, { useMemo, useState } from 'react';
import api from '../api';
import { Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import './QuizPlayer.css';

type QuestionType = '객관식' | '단답형' | '주관식';

export type QuizQuestion = {
    id: number; // 1부터
    type: QuestionType; // "객관식" | "단답형" | "주관식"
    difficulty: '쉬움' | '보통' | '어려움' | string;
    question: string; // 지문
    options?: string[] | null; // 객관식 보기 (정확히 4개가 이상적)
    answer: string; // 정답 또는 채점 포인트
    // 백엔드가 explanation을 주지 않지만, 확장을 대비해 선택값으로 선언
    explanation?: string | null;
};

export type QuizSet = {
    source: string; // 사용한 자료명
    items: QuizQuestion[];
};

type Props = {
    quiz: QuizSet;
    quizAttemptId: number;
    onComplete?: () => void; // ✅ 콜백 props
};

type UserAnswer = {
    // 객관식: 보기 인덱스 번호 (0~3), 단/주관식: 입력 텍스트
    value: number | string | null;
    correct?: boolean; // 채점 결과
    checked?: boolean; // 채점 여부(확인 버튼 누름)
};

const normalize = (s: string) => (s ?? '').toString().trim().replace(/\s+/g, ' ').toLowerCase();

export default function QuizPlayer({ quiz, quizAttemptId, onComplete }: Props) {
    const { items } = quiz;

    // 현재 문항 index
    const [idx, setIdx] = useState(0);
    // 사용자 답 상태
    const [answers, setAnswers] = useState<Record<number, UserAnswer>>({});

    // 진행률
    const progress = useMemo(() => {
        const checked = Object.values(answers).filter((a) => a.checked).length;
        return Math.round((checked / items.length) * 100);
    }, [answers, items.length]);

    const current = items[idx];

    const setAnswer = (qid: number, updater: (prev: UserAnswer) => UserAnswer) => {
        setAnswers((prev) => {
            const cur = prev[qid] ?? { value: null, checked: false, correct: undefined };
            return { ...prev, [qid]: updater(cur) };
        });
    };

    const handleChoice = (choiceIndex: number) => {
        setAnswer(current.id, (prev) => ({ ...prev, value: choiceIndex, checked: false, correct: undefined }));
    };

    const handleTextInput = (text: string) => {
        setAnswer(current.id, (prev) => ({ ...prev, value: text, checked: false, correct: undefined }));
    };

    const handleComplete = async () => {
        try {
            await api.post('/quiz/complete', {
                quiz_attempt_id: quizAttemptId,
                finished_at: new Date().toISOString(), // 서버에서 UTC로 처리 가능
            });
            alert('퀴즈 풀이가 완료되었습니다!');
            if (onComplete) onComplete(); // ✅ 부모(App)에서 전달한 콜백 실행
        } catch (err) {
            console.error('퀴즈 제출 실패', err);
        }
    };

    const grade = (q: QuizQuestion, ua: UserAnswer): boolean => {
        if (ua.value === null || ua.value === undefined) return false;

        if (q.type === '객관식') {
            // 정답은 answer에 '텍스트'가 들어오므로, 보기 텍스트와 비교
            const chosenIdx = typeof ua.value === 'number' ? ua.value : -1;
            const chosen = q.options?.[chosenIdx] ?? '';
            return normalize(chosen) === normalize(q.answer);
        }

        if (q.type === '단답형') {
            // 단답형은 간단히 정규화 비교(대소문자/공백 무시)
            return normalize(String(ua.value)) === normalize(q.answer);
        }

        // 주관식은 자동채점 대신, 키워드 포함 여부 간단 체크(옵션)
        // 완전 자동 채점이 어려우므로, 일단 포함 여부만 힌트로.
        const userText = normalize(String(ua.value));
        const key = normalize(q.answer);
        return key.length > 0 && userText.includes(key.slice(0, Math.min(8, key.length)));
    };

    const handleCheck = async () => {
        const ua = answers[current.id] ?? { value: null };
        const ok = grade(current, ua);

        // state 업데이트 (프론트 즉시 표시)
        setAnswer(current.id, (prev) => ({ ...prev, checked: true, correct: ok }));

        // ✅ API 호출해서 서버 저장
        try {
            await api.post('/quiz/next', {
                quiz_attempt_id: quizAttemptId, // 부모 컴포넌트에서 props로 받아야 함
                question_bank_id: current.id, // 현재 문항 id
                user_answer: String(ua.value ?? ''),
                time_ms: 0, // ms 단위 (추후 측정 가능)
            });
        } catch (err) {
            console.error('풀이 저장 실패', err);
        }
    };

    const handlePrev = () => setIdx((i) => Math.max(0, i - 1));
    const handleNext = () => setIdx((i) => Math.min(items.length - 1, i + 1));

    const score = useMemo(() => {
        const list = Object.values(answers).filter((a) => a.checked);
        const correct = list.filter((a) => a.correct).length;
        return { correct, totalChecked: list.length };
    }, [answers]);

    return (
        <div className="qp-container">
            <section className="qp-card">
                {/* 헤더 */}
                <div className="qp-header">
                    <div className="qp-header__left">
                        <h2 className="qp-title">문제 풀이</h2>
                        <span className="qp-source">자료: {quiz.source}</span>
                    </div>
                    <div className="qp-header__right">
                        <span className="qp-progress">{progress}%</span>
                        <div className="qp-score">
                            점수: {score.correct}/{items.length}
                        </div>
                    </div>
                </div>

                {/* 문항 영역 */}
                <div className="qp-body">
                    <div className="qp-meta">
                        <span className="qp-number">Q{current.id}</span>
                        <span className={`qp-difficulty qp-diff--${tagOfDiff(current.difficulty)}`}>
                            {current.difficulty}
                        </span>
                        <span className="qp-type">{current.type}</span>
                    </div>

                    <div className="qp-question">{current.question}</div>

                    {/* 답변 UI */}
                    {current.type === '객관식' && (
                        <div className="qp-choices">
                            {(current.options ?? []).map((opt, i) => {
                                const selected = answers[current.id]?.value === i;
                                return (
                                    <button
                                        key={i}
                                        className={`qp-choice ${selected ? 'qp-choice--selected' : ''}`}
                                        onClick={() => handleChoice(i)}
                                    >
                                        <span className="qp-choice-index">{String.fromCharCode(65 + i)}.</span>
                                        <span className="qp-choice-text">{opt}</span>
                                    </button>
                                );
                            })}
                            {(!current.options || current.options.length === 0) && (
                                <div className="qp-hint">※ 이 문항은 보기 데이터가 부족합니다.</div>
                            )}
                        </div>
                    )}

                    {current.type !== '객관식' && (
                        <div className="qp-textanswer">
                            <textarea
                                className="qp-textarea"
                                placeholder={
                                    current.type === '단답형' ? '정답을 입력하세요' : '핵심 포인트 중심으로 서술하세요'
                                }
                                value={(answers[current.id]?.value as string) ?? ''}
                                onChange={(e) => handleTextInput(e.target.value)}
                                rows={current.type === '단답형' ? 1 : 5}
                            />
                        </div>
                    )}

                    {/* 채점/해설 */}
                    <div className="qp-actions">
                        <button className="qp-btn qp-btn--primary" onClick={handleCheck}>
                            정답 확인
                        </button>
                        <button className="qp-btn" onClick={handlePrev} disabled={idx === 0}>
                            <ChevronLeft size={16} /> 이전
                        </button>

                        {idx === items.length - 1 ? (
                            // ✅ 마지막 문제 → "제출"
                            <button className="qp-btn qp-btn--submit" onClick={handleComplete}>
                                제출
                            </button>
                        ) : (
                            // ✅ 마지막이 아닐 때 → "다음"
                            <button className="qp-btn" onClick={handleNext}>
                                다음 <ChevronRight size={16} />
                            </button>
                        )}
                    </div>

                    {/* 결과 표시 */}
                    {answers[current.id]?.checked && (
                        <div
                            className={`qp-result ${
                                answers[current.id]?.correct ? 'qp-result--correct' : 'qp-result--wrong'
                            }`}
                        >
                            {answers[current.id]?.correct ? (
                                <>
                                    <Check size={18} /> 정답입니다!
                                </>
                            ) : (
                                <>
                                    <X size={18} /> 오답입니다.
                                </>
                            )}
                        </div>
                    )}

                    {/* 정답/해설 영역 */}
                    {answers[current.id]?.checked && (
                        <div className="qp-explain">
                            <div className="qp-explain__row">
                                <span className="qp-explain__label">정답</span>
                                <span className="qp-explain__content">{current.answer}</span>
                            </div>
                            {current.explanation ? (
                                <div className="qp-explain__row">
                                    <span className="qp-explain__label">해설</span>
                                    <span className="qp-explain__content">{current.explanation}</span>
                                </div>
                            ) : (
                                <div className="qp-explain__note">
                                    ※ 해설이 제공되지 않은 문항입니다. 정답과 비교해보세요.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* 하단 네비 */}
                <div className="qp-footer">
                    {items.map((q) => {
                        const a = answers[q.id];
                        const status = a?.checked ? (a.correct ? 'ok' : 'no') : 'none';
                        return (
                            <button
                                key={q.id}
                                className={`qp-dot qp-dot--${status} ${q.id === current.id ? 'qp-dot--active' : ''}`}
                                onClick={() => setIdx(q.id - 1)}
                                title={`Q${q.id}`}
                            />
                        );
                    })}
                </div>
            </section>
        </div>
    );
}

function tagOfDiff(d: string) {
    if (d === '쉬움') return 'easy';
    if (d === '보통') return 'medium';
    if (d === '어려움') return 'hard';
    return 'etc';
}
