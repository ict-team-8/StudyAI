// "자료 업로드" 탭 페이지

// ===============================
// 설명: 본 화면(히어로 + 탭 + 업로드 카드)
// ===============================
import React, { useRef, useState } from "react";
import { useAuth } from "../auth";
import api from "../api";
import SubjectModal from "../components/SubjectModal";
import Tabs from "../components/Tabs";

type Subject = { subject_id: number; name: string };

export default function UploadPage(){
  const { user } = useAuth();
  const [subject, setSubject] = useState<Subject|null>(null);
  const [openSubject, setOpenSubject] = useState(false);
  const [file, setFile] = useState<File|undefined>();
  const [text, setText] = useState("");
  const [out, setOut] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  function requireLogin(action: ()=>void){ if(!user){ alert("먼저 로그인해주세요."); return; } action(); }

  // 드래그앤드롭 비주얼 상태
  function onDrop(e: React.DragEvent){ e.preventDefault(); const f=e.dataTransfer.files?.[0]; if(f) setFile(f); dropRef.current?.classList.remove("dragover"); }
  function onDragOver(e: React.DragEvent){ e.preventDefault(); dropRef.current?.classList.add("dragover"); }
  function onDragLeave(){ dropRef.current?.classList.remove("dragover"); }

  async function submit(){
    if(!user){ alert("로그인이 필요합니다."); return; }
    if(!subject){ alert("과목을 선택/생성하세요."); return; }
    if(!file && !text.trim()){ alert("파일 또는 텍스트 중 하나를 입력하세요."); return; }

    const form = new FormData();
    form.append("subject_id", String(subject.subject_id));
    if(file) form.append("file", file);
    if(text.trim()) form.append("text", text.trim());

    const { data } = await api.post("/documents/upload", form, { headers: { "Content-Type":"multipart/form-data" } });
    setOut(JSON.stringify(data, null, 2));
  }

  return (
    <div className="sa-container">
      {/* 히어로 영역 (타이틀/서브카피) */}
      {/* <section className="sa-hero">
        <h1 className="sa-hero__title">AI로 더 효율적인 학습을 시작하세요</h1>
        <p className="sa-hero__subtitle">자료 업로드부터 문제 풀이까지, 모든 학습 과정을 AI가 도와드립니다.</p>
      </section> */}

      {/* 탭바 */}
      {/* <Tabs/> */}

      {/* 업로드 카드 */}
      <section className="sa-card">
        <div className="sa-card__header">
          <div className="sa-card__title"><span className="sa-title-icon"/>학습 자료 업로드</div>
          <div className="sa-card__actions">
            <button className="sa-btn ghost" onClick={()=>requireLogin(()=>setOpenSubject(true))}>
              {subject?`선택된 과목: ${subject.name}`:"과목 선택"}
            </button>
          </div>
        </div>
        <p className="sa-card__desc">PDF, 이미지, 문서 파일을 업로드하여 AI가 자동으로 분석합니다</p>

        <div ref={dropRef} className="sa-dropzone" onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}>
          <input ref={inputRef} type="file" accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png" onChange={(e)=>setFile(e.target.files?.[0]||undefined)} style={{display:"none"}}/>
          <div className="sa-dropzone__inner">
            <div className="sa-upload-badge">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 16V8" stroke="#fff" strokeWidth="2" strokeLinecap="round"/><path d="M8.5 11.5L12 8l3.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div className="sa-dropzone__title">파일을 여기엔 드래그하거나</div>
            <div className="sa-dropzone__subtitle">아래 버튼을 클릭하여 파일을 선택하세요</div>
            <button className="sa-btn primary" onClick={()=>inputRef.current?.click()}>파일 선택하기</button>
            <div className="sa-dropzone__meta"><span>• PDF, DOC, TXT</span><span>• JPG, PNG</span><span>• 최대 10MB</span></div>
          </div>
        </div>

        <div className="sa-or">또는 텍스트 붙여넣기</div>
        <textarea className="sa-textarea" rows={6} placeholder="긴 텍스트를 붙여넣을 수 있어요." value={text} onChange={(e)=>setText(e.target.value)} />

        <div className="sa-card__footer">
          <button className="sa-btn primary" onClick={submit}>업로드</button>
        </div>

        {out && <pre className="sa-result">{out}</pre>}
      </section>

      {/* 과목 선택/생성 모달 */}
      <SubjectModal open={openSubject} onClose={()=>setOpenSubject(false)} onPick={setSubject} />
    </div>
  );
}