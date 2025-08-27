
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

  // 번역 관련 상태 hook 추가
  const [langs, setLangs] = useState<Record<string,string>>({});          // {코드:이름}
  const [lang, setLang] = useState<string>("en");                         // 선택 언어
  const [tLoadingIds, setTLoadingIds] = useState<Record<number, boolean>>({}); // 각 턴 로딩
  const [translations, setTranslations] = useState<Record<number, string>>({}); // turnId -> 번역문
  const [showOriginal, setShowOriginal] = useState<Record<number, boolean>>({}); // turnId -> 원문보기 여부
  const [langQuery, setLangQuery] = useState<string>(""); // 언어 검색

  // 언어 리스트 로딩 직후 표시값 초기화
  useEffect(() => {
    if (Object.keys(langs).length) {
      const code = lang in langs ? lang : (langs.en ? "en" : Object.keys(langs)[0]);
      setLang(code);
      setLangQuery(`${code} — ${langs[code] ?? ""}`);
    }
  }, [langs]); // langs 도착 시 1회

  // lang이 바뀌면 표시 문자열 동기화
  useEffect(() => {
    if (lang && langs[lang]) {
      setLangQuery(`${lang} — ${langs[lang]}`);
    }
  }, [lang, langs]);

  // 도우미: "en — english" → "en"
  function parseCode(v: string) {
    return (v || "").split(" — ")[0].trim();
  }

  // 도우미: 사용자가 목록에서 항목을 고른 시점에 언어 확정
  function commitIfValid(v: string) {
    const code = parseCode(v);
    if (langs[code]) setLang(code);
  }

  // 최초 마운트 시, 지원 언어 목록 
  useEffect(() => {
    api.get("/i18n/languages")
      .then(({data})=>{
        setLangs(data || {});
        if (data?.en) setLang("en");
      })
      .catch(()=>{ /* 무시 */ });
  }, []);

  // 언어 바뀌면 기존 번역 캐시 초기화 (혼동 방지)
    useEffect(() => {
    setTranslations({});
    setShowOriginal({});
    setTLoadingIds({});
  }, [lang]);

  // ⬇️ 추가: 언어 바뀌면 마지막 턴을 자동 번역
    useEffect(() => {
      const last = lastAnswer();
      if (last?.answer) {
        translateTurn(last);  // 선택된 lang으로 즉시 번역
      }
    }, [lang, turns.length]); // turns 길이도 의존에 넣으면 새 답변에도 자동 반응

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

      // ⬇️ 추가: 현재 선택된 lang으로 방금 답변 자동 번역
      translateTurn(data);
    } finally { setLoading(false); }
  }

  useEffect(()=>{
    (async()=>{
      if(!sessionId) return;
      const { data } = await api.get<Turn[]>(`/chat/sessions/${sessionId}/turns`);
      setTurns(data);
    })();
  },[sessionId]);


  async function createSession(){
    if(!subjectId){ alert("과목을 먼저 선택/업로드하세요."); return; }
    const { data } = await api.post("/chat/sessions", { subject_id: subjectId, title: "스마트 Q&A" });
    setSessionId(data.chat_session_id);
    setTurns([]);

    // 추가
    setTranslations({}); setShowOriginal({}); setTLoadingIds({});
  }

  // 번역 유틸 추가
  function lastAnswer(): Turn | null {
    if (!turns.length) return null;
    return turns[turns.length - 1];
  }

  async function translateTurn(turn: Turn){
    const id = turn?.qa_turn_id;
    const base = turn?.answer?.trim();
    if (!id || !base) return;

    setTLoadingIds(prev => ({...prev, [id]: true}));
    try{
      const { data } = await api.post("/i18n/translate", {
        text: base,
        target_lang: lang,
      });
      setTranslations(prev => ({...prev, [id]: data.text || ""}));
      setShowOriginal(prev => ({...prev, [id]: false})); // 번역 보기로 열기
    } finally {
      setTLoadingIds(prev => ({...prev, [id]: false}));
    }
  }


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

        {/* 🔻 헤더 액션(언어/자동/전체) (NEW) */}
        <div className="sa-actions">
          {/* 언어 선택 (검색 가능) */}
          <input
            className="sa-field-input"
            list="lang-list"
            value={langQuery}                     // ✅ 이제 표시용 state
            onChange={(e) => {                    // 타이핑 자유롭게
              const v = e.target.value;
              setLangQuery(v);
              // 사용자가 옵션을 '선택'하면 value가 정확히 일치하므로 그때 확정
              commitIfValid(v);
            }}
            onBlur={(e) => commitIfValid(e.target.value)} // 밖을 클릭해도 확정
            placeholder="언어 검색… ex) en, english"
            style={{ border: '1px solid var(--ring)', borderRadius: 10, padding: '8px 10px', minWidth: 260 }}
            aria-label="번역 언어 검색"
            disabled={!lastAnswer()?.answer}
          />

          <datalist id="lang-list">
            {Array.from(new Set([
              // 추천 우선 노출
              ...["en","ja","zh-CN","fr","de","es","vi","id","hi","ar","ru","th","tr","pt"]
                .filter(code => langs[code])
                .map(code => `${code} — ${langs[code]}`),
              // 전체
              ...Object.entries(langs).map(([code, name]) => `${code} — ${name}`)
            ])).map(v => (
              <option key={v} value={v} />
            ))}
          </datalist>

          {/* 기존: 세션 만들기 버튼 */}
          {!auto && !sessionId && (
            <button className="sa-btn sa-btn--gradient" disabled={!subjectId} onClick={createSession}>
              Q&A 세션 만들기
            </button>
          )}
        </div>
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
            {turns.map(t => {
              const id = t.qa_turn_id;
              const hasTrans = !!translations[id];
              const isLoadingThis = !!tLoadingIds[id];
              const showOrig = !!showOriginal[id];
              const content = hasTrans && !showOrig ? translations[id] : t.answer;

              return (
                <div key={id} className="sa-chat__turn">
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
                      {/* 본문 (원문/번역 토글 반영) */}
                      <div
                        className="sa-bubble__text"
                        dangerouslySetInnerHTML={{__html: escapeHtmlAsText(content)}}
                      />

                      {/* 인용/근거 */}
                      {!!(t.citations?.length) && (
                        <div className="sa-cites">
                          <div className="sa-cites__title">근거</div>
                          <ul className="sa-cites__list">
                            {t.citations.map((c,i)=><li key={i}>{c}</li>)}
                          </ul>
                        </div>
                      )}

                      {/* 번역 컨트롤 (버블 하단 오른쪽) (NEW) */}
                      <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                        {hasTrans ? (
                          <button
                            className="sa-btn ghost"
                            onClick={()=>setShowOriginal(prev => ({...prev, [id]: !prev[id]}))}
                            title={showOrig ? "번역으로 보기" : "원문으로 보기"}
                          >
                            {showOrig ? "번역 보기" : "원문 보기"}
                          </button>
                        ) : (
                          <button
                            className="sa-btn ghost"
                            onClick={()=>translateTurn(t)}
                            disabled={isLoadingThis}
                            title={`이 답변을 ${lang}로 번역`}
                          >
                            {isLoadingThis ? "번역 중…" : `번역(${lang})`}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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

