import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import SubjectModal from '../components/SubjectModal';
import api, { getAuthToken } from '../api';
import './GenerateQuiz.css';
import QuizPlayer from './Quizplayer';

type Subject = { subject_id: number; name: string };
type QuestionType = '객관식' | '단답형' | '주관식';
type Difficulty = '쉬움' | '보통' | '어려움';

export default function GenerateQuiz({ onQuiz }: { onQuiz: (quizData: any) => void }) {
    const [subject, setSubject] = useState<Subject | null>(null);
    const [openSubject, setOpenSubject] = useState(false);

    const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<QuestionType[]>([]);
    const [difficulty, setDifficulty] = useState<Difficulty>('보통');
    const [questionCount, setQuestionCount] = useState(5);

    // 자료 선택(백엔드는 현재 subject_id만 사용)
    const [selectedMaterial, setSelectedMaterial] = useState<number | null>(null);
    const [showDifficultyDropdown, setShowDifficultyDropdown] = useState(false);
    const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);

    // API 상태
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<any | null>(null);

    const requireLogin = (action: () => void) => {
        if (!getAuthToken()) {
            alert('먼저 로그인해주세요.');
            return;
        }
        action();
    };

    const handleQuestionTypeChange = (type: QuestionType) => {
        setSelectedQuestionTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
    };

    const getDifficultyColor = (diff: Difficulty) => {
        switch (diff) {
            case '쉬움':
                return 'gq-difficulty-indicator--easy';
            case '보통':
                return 'gq-difficulty-indicator--medium';
            case '어려움':
                return 'gq-difficulty-indicator--hard';
        }
    };

    // ⚠️ 백엔드가 subject만 요구 → 자료 선택은 검증 대상에서 제외
    const isFormValid = () => subject && selectedQuestionTypes.length > 0 && difficulty && questionCount > 0;

    const handleGenerateQuiz = async () => {
        if (!isFormValid()) {
            alert('모든 설정을 완료해주세요.');
            return;
        }
        if (!subject) return;

        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const payload = {
                subject_id: subject.subject_id,
                qtype: selectedQuestionTypes, // "객관식, 주관식" 형태로 전달
                difficulty,
                num_questions: questionCount,
                // model_name: 'gemini-1.5-flash', // 필요 시 옵션
            };

            const { data } = await api.post('/quiz/generate', payload);
            setResult(data); // QuizSet { source, items: [...] }
            onQuiz(data);
        } catch (e: any) {
            const msg = e?.response?.data?.detail || e?.message || '문제 생성 중 오류가 발생했습니다.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <section className="gq-card">
                <div className="gq-card__header">
                    <div className="gq-card__title">
                        <div className="gq-card__title-icon">📝</div>
                        <h2 className="gq-card__title-text">문제 생성 설정</h2>
                    </div>
                </div>

                <div className="gq-card__content">
                    {/* 과목 선택 */}
                    <div className="gq-field">
                        <label className="gq-field__label">과목 선택</label>
                        <button className="gq-select-btn" onClick={() => requireLogin(() => setOpenSubject(true))}>
                            <span
                                className={
                                    subject ? 'gq-select-btn__text--selected' : 'gq-select-btn__text--placeholder'
                                }
                            >
                                {subject ? `선택된 과목: ${subject.name}` : '과목을 선택해주세요'}
                            </span>
                            <ChevronDown className="gq-select-btn__icon" />
                        </button>
                    </div>

                    {/* 문제 유형 선택 */}
                    <div className="gq-field">
                        <label className="gq-field__label">문제 유형 (중복 선택 가능)</label>
                        <div className="gq-checkbox-group">
                            {(['객관식', '단답형', '주관식'] as QuestionType[]).map((type) => (
                                <label key={type} className="gq-checkbox">
                                    <input
                                        type="checkbox"
                                        checked={selectedQuestionTypes.includes(type)}
                                        onChange={() => handleQuestionTypeChange(type)}
                                        className="gq-checkbox__input"
                                    />
                                    <span className="gq-checkbox__text">{type}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* 난이도 선택 */}
                    <div className="gq-field">
                        <label className="gq-field__label">난이도</label>
                        <div className="gq-dropdown">
                            <button
                                className="gq-select-btn"
                                onClick={() => setShowDifficultyDropdown(!showDifficultyDropdown)}
                            >
                                <div className="gq-difficulty-selected">
                                    <div className={`gq-difficulty-indicator ${getDifficultyColor(difficulty)}`}></div>
                                    <span className="gq-select-btn__text--selected">{difficulty}</span>
                                </div>
                                <ChevronDown className="gq-select-btn__icon" />
                            </button>

                            {showDifficultyDropdown && (
                                <div className="gq-dropdown__menu">
                                    {(['쉬움', '보통', '어려움'] as Difficulty[]).map((diff) => (
                                        <button
                                            key={diff}
                                            className="gq-dropdown__item"
                                            onClick={() => {
                                                setDifficulty(diff);
                                                setShowDifficultyDropdown(false);
                                            }}
                                        >
                                            <div
                                                className={`gq-difficulty-indicator ${getDifficultyColor(diff)}`}
                                            ></div>
                                            <span className="gq-dropdown__item-text">{diff}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 문제 개수 */}
                    <div className="gq-field">
                        <label className="gq-field__label">문제 개수: {questionCount}개</label>
                        <div className="gq-slider">
                            <input
                                type="range"
                                min="1"
                                max="20"
                                value={questionCount}
                                onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                                className="gq-slider__input"
                            />
                            <div className="gq-slider__labels">
                                <span className="gq-slider__label">1개</span>
                                <span className="gq-slider__label">20개</span>
                            </div>
                        </div>
                    </div>

                    {/* 자료 선택 (현재 백엔드 미사용) */}
                    <div className="gq-field">
                        <label className="gq-field__label">자료 선택</label>
                        <div className="gq-dropdown">
                            <button
                                className={`gq-select-btn ${!subject ? 'gq-select-btn--disabled' : ''}`}
                                onClick={() => setShowMaterialDropdown(!showMaterialDropdown)}
                                disabled={!subject}
                            >
                                <span className="gq-select-btn__text--placeholder">
                                    현재는 과목만으로 출제합니다 (추후 document 선택 연동 예정)
                                </span>
                                <ChevronDown className="gq-select-btn__icon" />
                            </button>
                            {/* 자료 드롭다운은 아직 비워둠 */}
                        </div>
                    </div>

                    {/* 생성 버튼 */}
                    <div className="gq-submit">
                        <button
                            onClick={handleGenerateQuiz}
                            disabled={!isFormValid() || loading}
                            className={`gq-submit__btn ${
                                isFormValid() && !loading ? 'gq-submit__btn--active' : 'gq-submit__btn--disabled'
                            }`}
                        >
                            {loading ? '생성 중...' : 'AI 문제 생성하기'}
                        </button>
                    </div>

                    {/* 에러/결과 */}
                    {error && <div className="gq-error">⚠ {error}</div>}
                    {result && (
                        <div className="gq-result">
                            <h3>생성 결과</h3>
                            <pre className="gq-result__json">{JSON.stringify(result, null, 2)}</pre>
                        </div>
                    )}
                </div>
            </section>
            {/* 문제 생성 후 결과가 있으면 문제 풀이 컴포넌트 렌더링 */}
            {result && <QuizPlayer quiz={result} />}

            {/* 과목 선택 모달 (API 내부에서 불러오는 구현이면 그대로 사용) */}
            <SubjectModal
                open={openSubject}
                onClose={() => setOpenSubject(false)}
                onPick={(selectedSubject) => {
                    setSubject(selectedSubject);
                    setSelectedMaterial(null); // 과목 변경 시 초기화
                }}
            />
        </>
    );
}
