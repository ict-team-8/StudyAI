// "자료 업로드" 탭 페이지

// ===============================
// 설명: 본 화면(히어로 + 탭 + 업로드 카드)
// ===============================
import React, { useRef, useState, useMemo } from "react";
import { useAuth } from "../auth";
import api from "../api";
import SubjectModal from "../components/SubjectModal";
import Tabs from "../components/Tabs";

type Subject = { subject_id: number; name: string };

// onUploaded 콜백을 받도록 시그니처 변경
export default function UploadPage({ onUploaded }: { onUploaded: (subjectId: number) => void }){
  const { user } = useAuth();
  const [subject, setSubject] = useState<Subject|null>(null);
  const [openSubject, setOpenSubject] = useState(false);
  const [file, setFile] = useState<File|undefined>();
  const [text, setText] = useState("");
  // const [out, setOut] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // 보기 좋은 용량 포맷
    const formatBytes = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
    };

    // 이미지 파일 여부 (미리보기 표시용)
    const isImage = useMemo(() => file?.type?.startsWith("image/") ?? false, [file]);

    // 선택 파일 지우기
    function clearFile() { setFile(undefined); }

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

    // 업로드만 실행 (응답 바디는 화면에 출력하지 않음)
    await api.post("/documents/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    // 성공 → 상위(App) 콜백으로 탭 전환 + subject 전달
    onUploaded(subject.subject_id);
  }

return (
  <div className="sa-container" style={{ marginTop: 12 }}>
    {/* 업로드 카드 */}
    <section className="sa-card">
      <div className="sa-card__header">
        <div className="sa-card__title">
          <span className="sa-title-icon" />
          학습 자료 업로드
        </div>
        <div className="sa-card__actions">
          <button
            className="sa-btn ghost"
            onClick={() => requireLogin(() => setOpenSubject(true))}
          >
            {subject ? `선택된 과목: ${subject.name}` : "과목 선택"}
          </button>
        </div>
      </div>

      <p className="sa-card__desc">
        PDF, 이미지, 문서 파일을 업로드하여 AI가 자동으로 분석합니다
      </p>

      {/* 드롭존: 파일 선택 여부에 따라 UI 전환 */}
      <div
        ref={dropRef}
        className={`sa-dropzone ${file ? "filled" : ""}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
          onChange={(e) => setFile(e.target.files?.[0] || undefined)}
          style={{ display: "none" }}
        />

        {!file ? (
          // 파일 미선택 상태
          <div className="sa-dropzone__inner">
            <div className="sa-upload-badge">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M12 16V8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
                <path
                  d="M8.5 11.5L12 8l3.5 3.5"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="sa-dropzone__title">파일을 여기엔 드래그하거나</div>
            <div className="sa-dropzone__subtitle">
              아래 버튼을 클릭하여 파일을 선택하세요
            </div>
            <button className="sa-btn primary" onClick={() => inputRef.current?.click()}>
              파일 선택하기
            </button>
            <div className="sa-dropzone__meta">
              <span>• PDF, DOC, TXT</span>
              <span>• JPG, PNG</span>
              <span>• 최대 10MB</span>
            </div>
          </div>
        ) : (
          // 파일 선택됨 상태
          <div className="sa-selected">
            <div className="sa-filechip" role="status" aria-live="polite">
              <span className="sa-filechip__icon">📄</span>
              <span className="sa-filechip__name" title={file.name}>
                {file.name}
              </span>
              <span className="sa-filechip__size">{formatBytes(file.size)}</span>
              <span className="sa-badge ready">준비됨</span>
            </div>

            {isImage && (
              <img
                className="sa-preview"
                src={URL.createObjectURL(file)}
                alt="선택된 이미지 미리보기"
              />
            )}

            <div className="sa-selected__actions">
              <button className="sa-btn" onClick={() => inputRef.current?.click()}>
                다른 파일 선택
              </button>
              <button className="sa-btn ghost" onClick={clearFile}>
                지우기
              </button>
            </div>

            <div className="sa-dropzone__meta">
              <span>• PDF, DOC, TXT</span>
              <span>• JPG, PNG</span>
              <span>• 최대 10MB</span>
            </div>
          </div>
        )}
      </div>

      {/* 텍스트 입력 섹션 + 상태 배지 */}
      <div className="sa-or">
        또는 텍스트 붙여넣기
        {text.trim().length > 0 && (
          <span className="sa-badge ready" style={{ marginLeft: 8 }}>
            텍스트 입력됨 · {text.trim().length.toLocaleString()}자
          </span>
        )}
      </div>

      <textarea
        className="sa-textarea"
        rows={6}
        placeholder="긴 텍스트를 붙여넣을 수 있어요."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <div className="sa-card__footer">
        <button className="sa-btn primary" onClick={submit}>
          업로드
        </button>
      </div>

    </section>

    {/* 과목 선택/생성 모달 */}
    <SubjectModal
      open={openSubject}
      onClose={() => setOpenSubject(false)}
      onPick={setSubject}
    />
  </div>
);

}