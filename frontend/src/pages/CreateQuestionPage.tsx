import { useState } from 'react';
import './CreateQuestionPage.css';

const checkBoxList = ['객관식', '단답형', '주관식'];

export default function CreateQuestionPage() {
    const [checkedList, setCheckedList] = useState<string[]>([]);
    const [isChecked, setIsChecked] = useState(false);

    const checkedItemHandler = (value: string, isChecked: boolean) => {
        if (isChecked) {
            setCheckedList((prev) => [...prev, value]);
            return;
        }
        if (!isChecked && checkedList.includes(value)) {
            setCheckedList(checkedList.filter((item) => item !== value));
            return;
        }
        return;
    };

    const checkHandler = (e: React.ChangeEvent<HTMLInputElement>, value: string) => {
        setIsChecked(!isChecked);
        checkedItemHandler(value, e.target.checked);
    };

    return (
        <>
            <div className="container">
                <div style={{ backgroundColor: 'blue' }}>
                    <div className="wrapperWithImg">
                        <img src="../../public/vite.svg" alt="image" />
                        <div>
                            <p>문제 생성 설정</p>
                            <p>맞춤형 문제를 생성하세요</p>
                        </div>
                    </div>
                    <form>
                        <p>문제유형</p>
                        {checkBoxList.map((item, idx) => (
                            <div className="checkbox" key={idx}>
                                <input
                                    type="checkbox"
                                    id={item}
                                    checked={checkedList.includes(item)}
                                    onChange={(e) => checkHandler(e, item)}
                                />
                                <label htmlFor={item}>{item}</label>
                            </div>
                        ))}
                        <div>
                            <p>난이도</p>
                            <label>
                                이미지
                                <select>
                                    <option value="easy">쉬움</option>
                                    <option value="normal">보통</option>
                                    <option value="hard">어려움</option>
                                </select>
                            </label>
                        </div>
                        <div>
                            <p>
                                문제 개수: <span>8개</span>
                            </p>
                            <div>슬라이드바</div>
                        </div>
                        <div className="choiceFile">
                            <p>자료 선택</p>
                            <select>
                                <option value="easy">쉬움</option>
                                <option value="normal">보통</option>
                                <option value="hard">어려움</option>
                            </select>
                        </div>
                        <button>AI 문제 생성하기</button>
                    </form>
                </div>
                <div style={{ backgroundColor: 'blue' }}>
                    <div className="wrapperWithImg">
                        <div style={{ display: 'flex' }}>
                            <img src="../../public/vite.svg" alt="image" />
                            <div>
                                <span>생성된 문제 (3개)</span>
                                <p>AI가 생성한 맞춤형 예상 문제들</p>
                            </div>
                            <div>
                                <p>준비완료</p>
                            </div>
                        </div>
                    </div>
                    <div className="contentBox">
                        <div>
                            <img src="../../public/vite.svg" alt="image" />
                            <span>객관식</span>
                            <span>쉬움</span>
                        </div>
                        <div>챕터</div>
                    </div>
                    <div>asdfasdfafddsfsfd</div>
                    <div>문제들1</div>
                    <div>문제들1</div>
                    <div>문제들1</div>
                    <div>문제들1</div>
                    <div>해설</div>
                    <div className="contentFooter">
                        <span>출저</span>
                        <span>생성일</span>
                    </div>
                </div>
            </div>
        </>
    );
}
