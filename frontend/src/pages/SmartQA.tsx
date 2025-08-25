// 설명: 우측 절반 영역. 세션 생성 → 질문 → 답변/근거 표시 + 대화기록 리스트
// import React, { useEffect, useState } from "react";
// import api from "../api";

// type Props = { subjectId: number | null };

// type Turn = { qa_turn_id: number; question: string; answer: string; citations: string[] };

// export default function SmartQA({ subjectId }: Props){
//   const [sessionId, setSessionId] = useState<number | null>(null); // 생성된 chat_session_id
//   const [question, setQuestion] = useState("");
//   const [loading, setLoading] = useState(false);
//   const [turns, setTurns] = useState<Turn[]>([]);                  // 대화 기록

//   // 세션 생성
//   async function createSession(){
//     if(!subjectId){ alert("과목을 먼저 선택/업로드하세요."); return; }
//     const { data } = await api.post("/chat/sessions", { subject_id: subjectId, title: "스마트 Q&A" });
//     setSessionId(data.chat_session_id);
//     setTurns([]); // 새 세션은 빈 기록
//   }

//   // 질문 전송
//   async function ask(){
//     if(!sessionId || !subjectId){ return; }
//     if(!question.trim()){ return; }
//     setLoading(true);
//     try{
//       const { data } = await api.post("/chat/ask", {
//         chat_session_id: sessionId,
//         subject_id: subjectId,
//         question: question.trim(),
//       });
//       setQuestion("");
//       // 새 턴 추가(낙관적 업데이트)
//       setTurns(prev => [...prev, data]);
//     } finally {
//       setLoading(false);
//     }
//   }

//   // 세션이 있으면 기록 불러오기
//   useEffect(()=>{
//     (async()=>{
//       if(!sessionId) return;
//       const { data } = await api.get<Turn[]>(`/chat/sessions/${sessionId}/turns`);
//       setTurns(data);
//     })();
//   },[sessionId]);

//   return (
//     <section className="sa-card" style={{ padding:20, minHeight: 300 }}>
//       <div className="sa-card__header">
//         <div className="sa-card__title" style={{ gap:8 }}>
//           <span className="sa-title-icon"/> 스마트 Q&A
//         </div>
//         {/* 세션이 없으면 생성 버튼 노출 */}
//         {!sessionId && (
//           <button className="sa-btn primary" disabled={!subjectId} onClick={createSession}>
//             Q&A 세션 만들기
//           </button>
//         )}
//       </div>

//       {/* 세션이 없을 때의 안내 */}
//       {!sessionId && (
//         <p className="sa-card__desc">업로드한 자료의 벡터 인덱스를 기반으로 답변합니다. 버튼을 눌러 새 세션을 시작하세요.</p>
//       )}

//       {/* 세션이 있으면 입력창 + 기록 */}
//       {sessionId && (
//         <>
//           {/* 입력 영역 */}
//           <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:8, marginBottom:12 }}>
//             <input
//               className="sa-field-input"
//               placeholder="예: React에서 useState는 어떻게 쓰나요?"
//               value={question}
//               onChange={(e)=>setQuestion(e.target.value)}
//               onKeyDown={(e)=>{ if(e.key==="Enter") ask(); }}
//               style={{ border:"1px solid var(--ring)", borderRadius:10, padding:"10px 12px" }}
//             />
//             <button className="sa-btn primary" disabled={loading || !question.trim()} onClick={ask}>
//               {loading ? "답변 중…" : "보내기"}
//             </button>
//           </div>

//           {/* 대화 기록 */}
//           <div style={{ display:"grid", gap:10 }}>
//             {turns.map(t => (
//               <div key={t.qa_turn_id} style={{ border:"1px solid #eef2ff", borderRadius:12, padding:12, background:"#fff" }}>
//                 <div style={{ fontWeight:700, marginBottom:6 }}>🙋‍♀️ Q. {t.question}</div>
//                 <div style={{ whiteSpace:"pre-wrap", lineHeight:1.6 }}>{t.answer}</div>
//                 {!!(t.citations?.length) && (
//                   <div style={{ marginTop:8, fontSize:13, color:"var(--sub)", borderTop:"1px dashed #e5e7eb", paddingTop:8 }}>
//                     📌 근거
//                     <ul style={{ margin: "6px 0 0 16px" }}>
//                       {t.citations.map((c, i)=><li key={i} style={{ margin:"2px 0" }}>{c}</li>)}
//                     </ul>
//                   </div>
//                 )}
//               </div>
//             ))}
//           </div>
//         </>
//       )}
//     </section>
//   );
// }

// src/pages/SmartQA.tsx
import React, { useEffect, useState } from "react";
import api from "../api";
import { MessageCircle, Send } from "lucide-react";

type Props = { subjectId: number | null };
type Turn = { qa_turn_id: number; question: string; answer: string; citations: string[] };

export default function SmartQA({ subjectId }: Props){
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
      {/* ── 헤더: 초록 말풍선 원형 + 제목 + 세션 버튼 */}
      <div className="sa-card__header nowrap">
        <div className="sa-card__title">
          <span className="sa-title-badge sa-title-badge--green">
            <MessageCircle />
          </span>
          <span>스마트 Q&A</span>
        </div>

        {!sessionId && (
          <button className="sa-btn sa-btn--gradient" disabled={!subjectId} onClick={createSession}>
            Q&A 세션 만들기
          </button>
        )}
      </div>

      {!sessionId && (
        <p className="sa-card__desc">업로드한 자료의 벡터 인덱스를 기반으로 답변합니다. 버튼을 눌러 새 세션을 시작하세요.</p>
      )}

      {sessionId && (
        <>
          {/* 입력창 */}
          <div className="sa-chat__composer">
            <input
              className="sa-field-input sa-chat__input"
              placeholder="예: React에서 useState는 어떻게 사용하나요?"
              value={question}
              onChange={(e)=>setQuestion(e.target.value)}
              onKeyDown={(e)=>{ if(e.key==="Enter") ask(); }}
            />
            <button className="sa-btn sa-btn--gradient sa-chat__send" disabled={loading || !question.trim()} onClick={ask} aria-label="보내기">
              <Send size={16}/>
            </button>
          </div>

          {/* 대화 버블 */}
          <div className="sa-chat">
            {turns.map(t => (
              <div key={t.qa_turn_id} className="sa-chat__turn">
                {/* Q (사용자) */}
                <div className="sa-bubble sa-bubble--me">
                  <div className="sa-bubble__text">{t.question}</div>
                </div>
                {/* A (AI) */}
                <div className="sa-bubble sa-bubble--ai">
                  <div className="sa-bubble__text" dangerouslySetInnerHTML={{__html: escapeHtmlAsText(t.answer)}} />
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

