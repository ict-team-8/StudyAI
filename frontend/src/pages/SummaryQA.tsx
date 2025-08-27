
// src/pages/SummaryQA.tsx
// 설명: 좌측 요약 패널(절반 영역). 아코디언(접/펼) + 정리 출력(굵게/중복제목 제거)


import React, { useMemo, useRef, useState, useEffect } from "react";
import api from "../api";
import { Download } from "lucide-react"; // 다운로드 아이콘

type Props = { subjectId: number | null; auto?: boolean; onNext?: () => void };

export default function SummaryQA({ subjectId, auto=false, onNext }: Props) {
  const [topic, setTopic] = useState("전체 요약"); // auto에서 고정값 사용
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const autoFiredRef = useRef(false); // 중복 실행 방지

  // 번역 관련 상태 추가
  const [langs, setLangs] = useState<Record<string,string>>({}); // 서버에서 받은 {코드:이름} 맵
  const [lang, setLang] = useState<string>("en");                 // 현재 선택된 타겟 언어 코드
  const [tLoading, setTLoading] = useState(false);                // 번역 호출 중 로딩 상태
  const [translated, setTranslated] = useState<string>("");       // 번역된 텍스트 보관
  const [showTrans, setShowTrans] = useState(false);              // '번역 보기' 토글
  const [langQuery, setLangQuery] = useState<string>(""); // 요약, 언어 검색 상태값

  const btnS: React.CSSProperties = {
    height: 36,
    padding: "8px 12px",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    lineHeight: 1
  };

  // PDF 다운 때, 필요한 summaryId
  const [summaryId, setSummaryId] = useState<number | null>(null);

  // langs 로드 후 1회 초기화
  useEffect(() => {
    if (Object.keys(langs).length) {
      const code = lang in langs ? lang : (langs.en ? "en" : Object.keys(langs)[0]);
      setLang(code);
      setLangQuery(`${code} — ${langs[code] ?? ""}`);
    }
  }, [langs]);

  // lang 변경 시 표시 문자열 동기화
  useEffect(() => {
    if (lang && langs[lang]) setLangQuery(`${lang} — ${langs[lang]}`);
  }, [lang, langs]);

  // "en — english" → "en"
  function parseCode(v: string) {
    return (v || "").split(" — ")[0].trim();
  }

  // 사용자가 목록에서 고른 값이면 lang 확정
  function commitIfValid(v: string) {
    const code = parseCode(v);
    if (langs[code]) setLang(code);
  }

  // 서버가 돌려준 요약 문자열을 1~4 섹션으로 쪼개고, 보기 좋게 정리
    // 3) Fallback: 섹션이 전부 비면 원문 그대로 표시
  const sections = useMemo(() => tidySections(parseSections(summary)), [summary]);
  const gotAny = !!(sections.core || sections.traps || sections.areas || sections.lines3);


  // 마운트 시 1회, 서버에서 지원 언어 목록 로드
  useEffect(() => {
    // 지원 언어 목록 로드 (로그인/토큰 동일 axios 인스턴스 사용)
    api.get("/i18n/languages").then(({data})=>{
      setLangs(data || {}); // 예: { en: 'english', ko: 'korean', ... }

      if (data?.en) setLang("en"); // 영어 존재하면 기본값으로 세팅
    }).catch(()=>{/* 무시 */});
  }, []);

  // 새로운 요약이 생성되면, 이전 번역 결과 초기화 (혼동 방지)
    useEffect(() => {
    setTranslated("");
    setShowTrans(false);
  }, [summary]);


  // ✅ 자동요약: subjectId가 생기고 아직 안 돌렸으면 1회 실행
  useEffect(() => {
    if (!auto) return;
    if (!subjectId) return;
    if (autoFiredRef.current) return;
    autoFiredRef.current = true;
    createSummary();
  }, [auto, subjectId]);

  // PDF 다운로드 함수 
  async function downloadPdf() {
    if (!summaryId) return;
    try {
      const res = await api.get(`/summaries/${summaryId}/pdf`, { responseType: "blob" });

      // 파일명 파싱
      const dispo = (res.headers?.["content-disposition"] || "") as string;
      let filename = `${topic || "요약"}_요약.pdf`; // 백업값
      if (dispo) {
        const m1 = dispo.match(/filename\*=UTF-8''([^;]+)/i);
        const m2 = dispo.match(/filename="([^"]+)"/i);
        const raw = m1 ? decodeURIComponent(m1[1]) : (m2 ? m2[1] : null);
        if (raw) filename = raw;
      }

      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename; // 서버로부터 파싱한 파일명
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("PDF 다운로드에 실패했습니다.");
    }
  }

  // ✅ 확인 후 다음 단계로
  function goNext() {
    if(!onNext) return;
    const ok = window.confirm("스마트 Q&A 기능을 사용하시겠습니까?");
    if (ok) onNext();
  }

  // ai 요약 함수
    async function createSummary() {
    if (!subjectId) { alert("먼저 자료를 업로드하거나 과목을 선택하세요."); return; }
    try {
      setLoading(true);
      const { data } = await api.post("/summaries", {
        subject_id: subjectId,
        topic,
        type: "overall",
      });
      setSummary(data.summary || "");
      setSummaryId(data.summary_id ?? null); // 생성된 summary_id 저장
    } finally {
      setLoading(false);
    }
  }

  // 번역 실행 함수
    async function translateNow() {
    if (!summary?.trim()) return; // 요약이 없으면 아무것도 안함

    setTLoading(true);
    
    try{
      const { data } = await api.post("/i18n/translate", {
        text: summary,
        target_lang: lang,
      });
      setTranslated(data.text || "");
      setShowTrans(true);
    } finally {
      setTLoading(false);
    }
  }


  return (
    <section className="sa-card" style={{ padding: 20 }}>
      {/* 헤더 */}
      <div className="sa-card__header" style={{ marginBottom: 12 }}>
        <div className="sa-card__title" style={{ gap: 8 }}>
          <span className="sa-title-icon" /> AI 자동 요약
        </div>

        {/* ✅ 번역 UI는 항상 노출, 수동 생성 버튼만 !auto 조건 */}
        <div className="sa-actions">
          {/* 언어 검색 기능 */}
          <input
            className="sa-field-input"
            list="summary-lang-list"
            value={langQuery}
            onChange={(e) => {
              const v = e.target.value;
              setLangQuery(v);
              commitIfValid(v);          // 제안에서 선택되면 즉시 확정
            }}
            onBlur={(e) => commitIfValid(e.target.value)} // 포커스 아웃 시도 확정
            placeholder="언어 검색… ex) en, english"
            style={{ border:'1px solid var(--ring)', borderRadius:10, padding:'8px 10px', minWidth: 260 }}
            aria-label="번역 언어 검색"
            disabled={!summary}
          />

          <datalist id="summary-lang-list">
            {Array.from(new Set([
              // 추천 우선
              ...["en","ja","zh-CN","fr","de","es","vi","id","hi","ar","ru","th","tr","pt"]
                .filter(code => langs[code])
                .map(code => `${code} — ${langs[code]}`),
              // 전체
              ...Object.entries(langs).map(([code, name]) => `${code} — ${name}`)
            ])).map(v => <option key={v} value={v} />)}
          </datalist>

          {/* 번역 실행 */}
          <button className="sa-btn" style={btnS} onClick={translateNow} disabled={!summary || tLoading}>
            {tLoading ? "번역 중…" : "번역"}
          </button>

          {/* 수동 생성 컨트롤은 예전처럼 auto 아닐 때만 */}
          {!auto && (
            <>
              <input
                className="sa-field-input"
                placeholder="요약 주제"
                defaultValue={topic}
                readOnly
                style={{ border:'1px solid var(--ring)', borderRadius:10, padding:'8px 10px', width: 280 }}
              />
              <button className="sa-btn primary" disabled={loading || !subjectId} onClick={createSummary}>
                {loading ? "생성 중…" : "새 요약 생성"}
              </button>
            </>
          )}

            {/* ⬇️ 다운로드 버튼 (요약이 있고 summaryId가 있을 때 활성) */}
            <div>
              <button
                className="sa-btn"
                style={btnS}
                onClick={downloadPdf}
                disabled={!summaryId}
                title="요약을 PDF로 저장"
              >
                <Download size={16} style={{ marginRight: 6 }} />
                PDF
              </button>
            </div>
        </div>
      </div>

      {/* 상태 */}
      {!summary && (
        <div style={{ color: 'var(--sub)' }}>
          {auto ? "업로드한 자료로 요약을 자동 생성 중입니다…" : "상단의 새 요약 생성 버튼을 눌러 요약을 만들어보세요."}
        </div>
      )}

      {/* 보기 토글: 요약과 번역이 모두 있을 때만 표시 */}
      {!!summary && !!translated && (
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginBottom:8 }}>
          <button className="sa-btn ghost" onClick={()=>setShowTrans(false)} disabled={!showTrans}>원문 보기</button>
          <button className="sa-btn ghost" onClick={()=>setShowTrans(true)}  disabled={showTrans}>번역 보기</button>
        </div>
      )}

      {/* 결과 */}
      {!!summary && (() => {
        // 어떤 텍스트를 보여줄지 결정
        const toShow = showTrans && translated ? translated : summary;

        // 번역문도 원문처럼 1)~4) 구조일 수 있으니 즉석 파싱
        const s = showTrans && translated ? tidySections(parseSections(translated)) : sections;
        const any = !!(s.core || s.traps || s.areas || s.lines3);

        return any ? (
          <div className="sa-accordion">
            <AccordionSection title="1) 핵심 개념" defaultOpen content={s.core}/>
            <AccordionSection title="2) 자주 나오는 함정/오개념" content={s.traps}/>
            <AccordionSection title="3) 주요 개념 영역별 요약"  content={s.areas}/>
            <AccordionSection title="4) 3줄 최종 요약"          content={s.lines3}/>
          </div>
        ) : (
          // 파싱이 안 되면 통짜로
          <div className="sa-acc open">
            <div className="sa-acc__body" style={{whiteSpace:'pre-wrap', lineHeight:1.64}}>
              {toShow}
            </div>
          </div>
        );
      })()}

      {/* ✅ 다음 단계: Q&A로 이동 */}
      <div className="sa-card__footer" style={{ justifyContent:'flex-end' }}>
        <button className="sa-btn primary" onClick={goNext} disabled={!summary || loading}>
          다음 단계
        </button>
      </div>
    </section>
  );
}

/* ---------- 텍스트 파서(섹션 분리) ---------- */
// 1) 섹션 파서: 헤딩/굵게/여러 라벨 변형 허용
function parseSections(raw: string) {
  const norm = (raw || "").replace(/\r\n/g, "\n");

  // n): "### **1) …", "(1) …", "1. …", "① …" 등 폭넓게 허용
  const mark = (n: number) =>
    new RegExp(
      String.raw`(^|\n)\s*(?:#{1,6}\s*)?(?:\*\*\s*)?(?:\(?\s*${n}\s*\)?|${["①","②","③","④"][n-1]})\s*[\.)]?:?\s*`,
      "i"
    );

  const i1 = norm.search(mark(1));
  const i2 = norm.search(mark(2));
  const i3 = norm.search(mark(3));
  const i4 = norm.search(mark(4));

  const slice = (start: number, end: number) => {
    if (start < 0) return "";
    // 라벨 줄 전체를 날리고 본문만
    const after = norm.slice(start).replace(/^.*?(\n|$)/, "");
    return after.slice(0, end >= 0 ? end - start : undefined).trim();
  };

  return {
    core:   slice(i1, i2),
    traps:  slice(i2, i3),
    areas:  slice(i3, i4),
    lines3: slice(i4, -1),
  };
}
// 2) 보기 좋게 정리(중복 타이틀/굵게/불릿)
function tidySections(s: {core:string; traps:string; areas:string; lines3:string}) {
  const tidy = (txt: string, hints: string[]) =>
    cleanBullets(stripBold(stripDupTitle(txt, hints)));
  return {
    core:   tidy(s.core,  ["핵심 개념","핵심개념"]),
    traps:  tidy(s.traps, ["자주 나오는 함정","오개념"]),
    areas:  tidy(s.areas, ["주요 개념 영역별 요약","개념 영역","영역별 요약"]),
    lines3: tidy(s.lines3,["3줄 최종 요약","최종 요약"]),
  };
}

// 섹션 맨 앞에 같은 제목이 한 번 더 들어간 경우 제거(굵게/콜론/별표 허용)
function stripDupTitle(txt: string, hints: string[]) {
  const first = (txt.split("\n")[0] || "").trim();
  const norm  = first.replace(/\*\*/g,"").replace(/[:：]$/,"").replace(/\s+/g,"");
  if (hints.some(h => norm.includes(h.replace(/\s+/g,""))))
    return txt.split("\n").slice(1).join("\n").trim();
  return txt;
}

// **bold** → bold (별표 제거)
const stripBold    = (t:string)=> t.replace(/\*\*(.*?)\*\*/g,"$1");

// 마크다운 불릿을 단일 스타일로 정리
const cleanBullets = (t:string)=>
  t.replace(/^\s*[-*]\s+/gm, "• ")
   .replace(/^\s{2,}[-*]\s+/gm, " · ")
   .trim();

/* ---------- UI: 아코디언 섹션 ---------- */
function AccordionSection({
  title,
  content,
  defaultOpen = false,
}: {
  title: string;
  content: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  return (
    <div className={`sa-acc ${open ? "open" : ""}`}>
      <button className="sa-acc__header" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="sa-acc__title">{title}</span>
        <span className="sa-acc__chev" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="sa-acc__body">
          {content ? (
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.64 }}>{content}</div>
          ) : (
            <div style={{ color: "var(--sub)" }}>해당 섹션 내용이 없습니다.</div>
          )}
        </div>
      )}
    </div>
  );
}
