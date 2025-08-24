import React, { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import SubjectModal from '../components/SubjectModal';
import './GenerateQuiz.css';

// 임시 데이터 (실제로는 props나 API에서 받아올 데이터)
const mockUser = { id: 1, name: '사용자' }; // useAuth에서 받아올 user 데이터
const mockSubjects = [
    { subject_id: 1, name: '수학' },
    { subject_id: 2, name: '영어' },
    { subject_id: 3, name: '과학' },
];

// 각 과목별 자료 데이터
const mockMaterials = {
    1: [
        { id: 1, name: '1차함수 개념정리' },
        { id: 2, name: '이차방정식 문제집' },
        { id: 3, name: '확률과 통계 요약본' },
    ],
    2: [
        { id: 1, name: '영문법 기초' },
        { id: 2, name: '영어 단어장' },
    ],
    3: [
        { id: 1, name: '물리학 개념' },
        { id: 2, name: '화학 반응식' },
        { id: 3, name: '생물학 기초' },
        { id: 4, name: '지구과학 요약' },
    ],
};

type Subject = {
    subject_id: number;
    name: string;
};

type QuestionType = '객관식' | '단답형' | '주관식';
type Difficulty = '쉬움' | '보통' | '어려움';

export default function GenerateQuiz({ onQuiz }: { onQuiz: (subjectId: number) => void }) {
    const user = mockUser; // 실제로는 useAuth()에서 가져올 데이터

    const [subject, setSubject] = useState<Subject | null>(null);
    const [openSubject, setOpenSubject] = useState(false);
    const [selectedQuestionTypes, setSelectedQuestionTypes] = useState<QuestionType[]>([]);
    const [difficulty, setDifficulty] = useState<Difficulty>('보통');
    const [questionCount, setQuestionCount] = useState(5);
    const [selectedMaterial, setSelectedMaterial] = useState<number | null>(null);
    const [showDifficultyDropdown, setShowDifficultyDropdown] = useState(false);
    const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);

    const availableMaterials = useMemo(() => {
        if (!subject) return [];
        return mockMaterials[subject.subject_id as keyof typeof mockMaterials] || [];
    }, [subject]);

    function requireLogin(action: () => void) {
        if (!user) {
            alert('먼저 로그인해주세요.');
            return;
        }
        action();
    }

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

    const isFormValid = () => {
        return (
            subject && selectedQuestionTypes.length > 0 && difficulty && questionCount > 0 && selectedMaterial !== null
        );
    };

    const handleGenerateQuiz = () => {
        if (!isFormValid()) {
            alert('모든 설정을 완료해주세요.');
            return;
        }

        if (subject) {
            onQuiz(subject.subject_id);
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

                    {/* 문제 개수 선택 */}
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
                                    {!subject
                                        ? '먼저 과목을 선택해주세요'
                                        : selectedMaterial
                                        ? availableMaterials.find((m) => m.id === selectedMaterial)?.name
                                        : availableMaterials.length > 0
                                        ? '자료를 선택해주세요'
                                        : '사용 가능한 자료가 없습니다'}
                                </span>
                                <ChevronDown className="gq-select-btn__icon" />
                            </button>

                            {showMaterialDropdown && subject && availableMaterials.length > 0 && (
                                <div className="gq-dropdown__menu gq-dropdown__menu--scrollable">
                                    {availableMaterials.map((material) => (
                                        <button
                                            key={material.id}
                                            className="gq-dropdown__item"
                                            onClick={() => {
                                                setSelectedMaterial(material.id);
                                                setShowMaterialDropdown(false);
                                            }}
                                        >
                                            <span className="gq-dropdown__item-text">{material.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* AI 문제 생성하기 버튼 */}
                    <div className="gq-submit">
                        <button
                            onClick={handleGenerateQuiz}
                            disabled={!isFormValid()}
                            className={`gq-submit__btn ${
                                isFormValid() ? 'gq-submit__btn--active' : 'gq-submit__btn--disabled'
                            }`}
                        >
                            AI 문제 생성하기
                        </button>
                    </div>
                </div>
            </section>

            {/* 과목 선택 모달 */}
            <SubjectModal
                open={openSubject}
                onClose={() => setOpenSubject(false)}
                onPick={(selectedSubject) => {
                    setSubject(selectedSubject);
                    setSelectedMaterial(null); // 과목 변경시 자료 선택 초기화
                }}
            />
        </>
    );
}
