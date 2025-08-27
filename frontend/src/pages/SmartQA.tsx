
// src/pages/SmartQA.tsx
import React, { useEffect, useState } from "react";
import api from "../api";
import { MessageCircle, Send, User, Bot } from "lucide-react";

type Props = { subjectId: number | null; auto?: boolean; };
type Turn = { qa_turn_id: number; question: string; answer: string; citations: string[] };

export default function SmartQA({ subjectId, auto=false }: Props){
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [question, setQuestion]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [turns, setTurns]         = useState<Turn[]>([]);

  async function createSession(){
    if(!subjectId){ alert("과목을 먼저 선택/업로드하세요."); return; }
    const { data } = await api.post("/chat/sessions", { subject_id: subjectId, title: "스마트 Q&A" });
    setSessionId(data.chat_session_id);
    setTurns([]);
  }

  // ✅ 자동 세션 생성
  useEffect(() => {
    if(!auto) return;
    if(!subjectId) return;
    if(sessionId) return;
    createSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, subjectId]);

  async function ask(){
    if(!sessionId || !subjectId || !question.trim()) return;
    setLoading(true);
    try{
      const { data } = await api.post("/chat/ask", {
        chat_session_id: sessionId, subject_id: subjectId, question: question.trim()
      });
      setQuestion("");
      setTurns(prev => [...prev, data]);
    } finally { setLoading(false); }
  }

  useEffect(()=>{
    (async()=>{
      if(!sessionId) return;
      const { data } = await api.get<Turn[]>(`/chat/sessions/${sessionId}/turns`);
      setTurns(data);
    })();
  },[sessionId]);

  return (
    <section className="sa-card sa-card--tight">
      {/* 헤더 */}
      <div className="sa-card__header nowrap">
        <div className="sa-card__title">
          <span className="sa-title-badge sa-title-badge--green">
            <MessageCircle />
          </span>
          <span>스마트 Q&A</span>
        </div>

        {/* ❌ auto 모드에선 버튼 숨김, 수동만 표시 */}
        {!auto && !sessionId && (
          <button className="sa-btn sa-btn--gradient" disabled={!subjectId} onClick={createSession}>
            Q&A 세션 만들기
          </button>
        )}
      </div>

      {!sessionId && !auto && (
        <p className="sa-card__desc">업로드한 자료의 벡터 인덱스를 기반으로 답변합니다. 버튼을 눌러 새 세션을 시작하세요.</p>
      )}

      {sessionId && (
        <>
          {/* 입력창 */}
          <div className="sa-chat__composer sa-chat__composer--roomy">
            <input
              className="sa-field-input sa-chat__input"
              placeholder="예: React에서 useState는 어떻게 사용하나요?"
              value={question}
              onChange={(e)=>setQuestion(e.target.value)}
              onKeyDown={(e)=>{ if(e.key==="Enter") ask(); }}
            />
            <button 
                className="sa-btn sa-btn--gradient sa-chat__send" 
                disabled={loading || !question.trim()} 
                onClick={ask} 
                aria-label="보내기"
            >
              <Send size={16}/>
            </button>
          </div>

          {/* 대화 기록 (아바타 + 버블) */}
          <div className="sa-chat sa-chat--spacious">
            {turns.map(t => (
              <div key={t.qa_turn_id} className="sa-chat__turn">
                {/* Q: 사용자 (오른쪽 정렬) */}
                <div className="sa-msg sa-msg--me">
                  <div className="sa-avatar sa-avatar--me" aria-hidden>
                    <User size={14}/>
                  </div>
                  <div className="sa-bubble sa-bubble--me">
                    <div className="sa-bubble__text">{t.question}</div>
                  </div>
                </div>

                {/* A: AI (왼쪽 정렬) */}
                <div className="sa-msg sa-msg--ai">
                  <div className="sa-avatar sa-avatar--ai" aria-hidden>
                    <Bot size={14}/>
                  </div>
                  <div className="sa-bubble sa-bubble--ai">
                    <div
                      className="sa-bubble__text"
                      dangerouslySetInnerHTML={{__html: escapeHtmlAsText(t.answer)}}
                    />
                    {!!(t.citations?.length) && (
                      <div className="sa-cites">
                        <div className="sa-cites__title">근거</div>
                        <ul className="sa-cites__list">
                          {t.citations.map((c,i)=><li key={i}>{c}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* 간단 이스케이프(답변에 마크다운/[] 인용이 섞여도 안전하게 표시) */
function escapeHtmlAsText(s: string){
  return (s||"")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/\n/g,"<br/>");
}

