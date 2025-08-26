// // src/pages/SummaryQA.tsx
// // 설명: 업로드 후 도착하는 “요약 & Q&A” 탭의 좌측 요약 영역(간단 버전)
// // - subjectId가 없으면 빈 상태 안내
// // - "새 요약 생성" 버튼 클릭 시 /api/summaries 호출
// // - summary 문자열(마크다운 유사)을 1~4 구역으로 파싱해 카드에 표시

// import React, { useMemo, useState } from "react";
// import api from "../api";

// type Props = { subjectId: number | null };

// export default function SummaryQA({ subjectId }: Props) {
//   const [topic, setTopic] = useState("전체 요약");     // 기본 프롬프트 제목
//   const [loading, setLoading] = useState(false);
//   const [summary, setSummary] = useState<string>("");  // 백엔드 반환 문자열

//   // ✅ 간단 파서: “1) …”, “2) …”, “3) …”, “4) …” 섹션을 느슨하게 추출
//   const sections = useMemo(() => parseSections(summary), [summary]);

//   async function createSummary() {
//     if (!subjectId) { alert("먼저 자료를 업로드하거나 과목을 선택하세요."); return; }
//     try {
//       setLoading(true);
//       const { data } = await api.post("/summaries", {
//         subject_id: subjectId,
//         topic,
//         type: "overall"    // 백엔드 enum: overall | traps | concept_areas | three_lines
//       });
//       // 서버 response_model: { summary_id, ok, reason, summary }
//       setSummary(data.summary || "");
//     } finally {
//       setLoading(false);
//     }
//   }

//   return (
//     <section className="sa-card" style={{ padding: 20 }}>
//       <div className="sa-card__header" style={{ marginBottom: 12 }}>
//         <div className="sa-card__title" style={{ gap: 8 }}>
//           <span className="sa-title-icon" /> AI 자동 요약
//         </div>
//         <div className="sa-actions">
//           <input
//             className="sa-field-input"
//             placeholder="요약 주제(예: 전체 요약 / 1~3장 위주 / 오개념만 등)"
//             value={topic}
//             onChange={(e)=>setTopic(e.target.value)}
//             style={{ border:'1px solid var(--ring)', borderRadius:10, padding:'8px 10px', width: 280 }}
//           />
//           <button className="sa-btn primary" disabled={loading || !subjectId} onClick={createSummary}>
//             {loading ? "생성 중…" : "새 요약 생성"}
//           </button>
//         </div>
//       </div>

//       {/* 초기 빈 상태 */}
//       {!summary && (
//         <div style={{ color: 'var(--sub)' }}>
//           아직 생성된 요약이 없습니다. 상단의 <b>새 요약 생성</b> 버튼을 눌러 요약을 만들어보세요.
//         </div>
//       )}

//       {/* 요약 결과(있을 때만) */}
//       {summary && (
//         <div className="grid" style={{ display:'grid', gap:12 }}>
//           <SummaryBlock title="1) 핵심 개념"      content={sections.core} />
//           <SummaryBlock title="2) 자주 나오는 함정/오개념" content={sections.traps} />
//           <SummaryBlock title="3) 주요 개념 영역별 요약"  content={sections.areas} />
//           <SummaryBlock title="4) 3줄 최종 요약"    content={sections.lines3} />
//         </div>
//       )}
//     </section>
//   );
// }

// /** 마크다운 유사 텍스트에서 1~4번 섹션을 느슨하게 추출 */
// function parseSections(raw: string) {
//   const norm = (raw || "").replace(/\r\n/g, "\n");
//   const idx = (label: string) => {
//     // "**1) 핵심 개념", "1) 핵심 개념", "1)  " 등 변형 허용
//     const re = new RegExp(`(^|\\n)\\s*\\**\\s*${label}\\)\\s*`, "i");
//     return norm.search(re);
//   };
//   const i1 = idx("1"), i2 = idx("2"), i3 = idx("3"), i4 = idx("4");
//   const s = (start: number, end: number) =>
//     start >= 0 ? norm.slice(start).slice(norm.slice(start).search(/\)\s*/)+2, end >= 0 ? end - start : undefined).trim() : "";

//   return {
//     core:   s(i1, i2),
//     traps:  s(i2, i3),
//     areas:  s(i3, i4),
//     lines3: s(i4, -1),
//   };
// }

// function SummaryBlock({ title, content }: { title: string; content: string }) {
//   return (
//     <div style={{ border:'1px solid #eef2ff', borderRadius:12, padding:16, background:'#fff' }}>
//       <div className="sa-card__title" style={{ fontSize:16, marginBottom:8 }}>{title}</div>
//       {content ? (
//         <div style={{ whiteSpace:'pre-wrap', lineHeight:1.6 }}>{content}</div>
//       ) : (
//         <div style={{ color:'var(--sub)' }}>해당 섹션 내용이 아직 없습니다.</div>
//       )}
//     </div>
//   );
// }

// src/pages/SummaryQA.tsx
// 설명: 좌측 요약 패널(절반 영역). 아코디언(접/펼) + 정리 출력(굵게/중복제목 제거)


import React, { useMemo, useState } from "react";
import api from "../api";

type Props = { subjectId: number | null };

export default function SummaryQA({ subjectId }: Props) {
  const [topic, setTopic] = useState("전체 요약");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string>("");

  // 서버가 돌려준 요약 문자열을 1~4 섹션으로 쪼개고, 보기 좋게 정리
    // 3) Fallback: 섹션이 전부 비면 원문 그대로 표시
const sections = useMemo(() => tidySections(parseSections(summary)), [summary]);
const gotAny = !!(sections.core || sections.traps || sections.areas || sections.lines3);

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
    } finally {
      setLoading(false);
    }
  }



  return (
    <section className="sa-card" style={{ padding: 20 }}>
      {/* 헤더 */}
      <div className="sa-card__header" style={{ marginBottom: 12 }}>
        <div className="sa-card__title" style={{ gap: 8 }}>
          <span className="sa-title-icon" /> AI 자동 요약
        </div>
        <div className="sa-actions">
          <input
            className="sa-field-input"
            placeholder="요약 주제(예: 전체 요약 / 1~3장 위주 / 오개념만 등)"
            value={topic}
            onChange={(e)=>setTopic(e.target.value)}
            style={{ border:'1px solid var(--ring)', borderRadius:10, padding:'8px 10px', width: 280 }}
          />
          <button className="sa-btn primary" disabled={loading || !subjectId} onClick={createSummary}>
            {loading ? "생성 중…" : "새 요약 생성"}
          </button>
        </div>
      </div>

      {/* 초기 빈 상태 */}
      {!summary && (
        <div style={{ color: 'var(--sub)' }}>
          아직 생성된 요약이 없습니다. 상단의 <b>새 요약 생성</b> 버튼을 눌러 요약을 만들어보세요.
        </div>
      )}

      {/* 아코디언: 1)~4) */}
        {summary && (
        gotAny ? (
            <div className="sa-accordion">
            <AccordionSection title="1) 핵심 개념" defaultOpen content={sections.core}/>
            <AccordionSection title="2) 자주 나오는 함정/오개념" content={sections.traps}/>
            <AccordionSection title="3) 주요 개념 영역별 요약"  content={sections.areas}/>
            <AccordionSection title="4) 3줄 최종 요약"          content={sections.lines3}/>
            </div>
        ) : (
            <div className="sa-acc open">
            <div className="sa-acc__body" style={{whiteSpace:'pre-wrap', lineHeight:1.64}}>
                {summary}
            </div>
            </div>
        )
        )}
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
