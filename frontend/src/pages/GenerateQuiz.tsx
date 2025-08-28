import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import SubjectModal from '../components/SubjectModal';
import api, { getAuthToken } from '../api';
import './GenerateQuiz.css';
import QuizPlayer from './QuizPlayer.tsx';

type Subject = { subject_id: number; name: string };
type Material = { id: number; title: string };
type QuestionType = '객관식' | '단답형' | '주관식';
type Difficulty = '쉬움' | '보통' | '어려움';

export default function GenerateQuiz({ onQuiz }: { onQuiz: (quizData: any) => void }) {
    const [subject, setSubject] = useState<Subject | null>(null);
    const [openSubject, setOpenSubject] = useState(false);

    const [materials, setMaterials] = useState<Material[]>([]);
    const [selectedMaterial, setSelectedMaterial] = useState<number | null>(null);

    const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<QuestionType[]>([]);
    const [difficulty, setDifficulty] = useState<Difficulty>('보통');
    const [questionCount, setQuestionCount] = useState(5);

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

    const isFormValid = () => subject && selectedQuestionTypes.length > 0 && difficulty && questionCount > 0;

    // ✅ 과목에 해당하는 자료 목록 불러오기
    const fetchMaterials = async (subjectId: number) => {
        try {
            const { data } = await api.get(`/subjects/${subjectId}/documents`);
            setMaterials(data);
        } catch (err) {
            console.error('자료 목록 불러오기 실패', err);
            setMaterials([]);
        }
    };

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
                qtype: selectedQuestionTypes,
                difficulty,
                num_questions: questionCount,
                doc_ids: selectedMaterial ? [selectedMaterial] : undefined, // ✅ 선택 자료 반영
            };

            const { data } = await api.post('/quiz/generate', payload);
            setResult(data);
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

                    {/* 문제 유형 */}
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

                    {/* 난이도 */}
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

                    {/* 자료 선택 */}
                    <div className="gq-field">
                        <label className="gq-field__label">자료 선택</label>
                        <div className="gq-dropdown">
                            <button
                                className={`gq-select-btn ${!subject ? 'gq-select-btn--disabled' : ''}`}
                                onClick={() => setShowMaterialDropdown(!showMaterialDropdown)}
                                disabled={!subject}
                            >
                                <span
                                    className={
                                        selectedMaterial
                                            ? 'gq-select-btn__text--selected'
                                            : 'gq-select-btn__text--placeholder'
                                    }
                                >
                                    {selectedMaterial
                                        ? `선택된 자료: ${materials.find((m) => m.id === selectedMaterial)?.title}`
                                        : subject
                                        ? '자료를 선택하세요'
                                        : '먼저 과목을 선택하세요'}
                                </span>
                                <ChevronDown className="gq-select-btn__icon" />
                            </button>

                            {showMaterialDropdown && subject && (
                                <div className="gq-dropdown__menu">
                                    {materials.length === 0 && <div className="gq-dropdown__item">자료 없음</div>}
                                    {materials.map((mat) => (
                                        <button
                                            key={mat.id}
                                            className="gq-dropdown__item"
                                            onClick={() => {
                                                setSelectedMaterial(mat.id);
                                                setShowMaterialDropdown(false);
                                            }}
                                        >
                                            {mat.title}
                                        </button>
                                    ))}
                                </div>
                            )}
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

            {/* 문제 생성 후 결과 → 바로 풀이 */}
            {result && <QuizPlayer quiz={result.quiz} quizAttemptId={result.quiz_attempt_id} />}

            {/* 과목 선택 모달 */}
            <SubjectModal
                open={openSubject}
                onClose={() => setOpenSubject(false)}
                onPick={(selectedSubject) => {
                    setSubject(selectedSubject);
                    setSelectedMaterial(null);
                    fetchMaterials(selectedSubject.subject_id); // ✅ 과목 변경 시 자료 목록 로드
                }}
            />
        </>
    );
}
