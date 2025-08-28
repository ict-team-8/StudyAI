// "자료 업로드" 탭 페이지

// ===============================
// 설명: 본 화면(히어로 + 탭 + 업로드 카드)
// ===============================
import React, { useRef, useState, useMemo } from "react";
import { useAuth } from "../auth";
import api from "../api";
import SubjectModal from "../components/SubjectModal";
import Tabs from "../components/Tabs";
import { IconDot, IconUploadBadge } from "../components/icons";
import { Upload } from "lucide-react";

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

  // 업로드할 모드는 백엔드 자동 감지 메서드가 대신 해줌
  const ACCEPT_ALL = '.pdf,.txt,.jpg,.jpeg,.png,image/*';


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
   // form.append("parse_mode", mode);
    form.append("debug_preview", "true"); // OCR일 때 미리보기 받기

    // 업로드만 실행 (응답 바디는 화면에 출력하지 않음)
    const { data } = await api.post("/documents/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    // OCR이면 미리보기 간단 표시(있을 때)
    // if (data?.ocr_preview) {
    //   const p = data.ocr_preview;
    //   const toPct = (x:number)=> (x*100).toFixed(1)+'%';
    //   alert([
    //     'OCR 미리보기(자동 감지됨)',
    //     `변경률: ${toPct(p.changed_ratio)}`,
    //     '',
    //     '[RAW]',
    //     p.raw_preview,
    //     '',
    //     '[FIXED]',
    //     p.fixed_preview,
    //   ].join('\n'));
    // }

    // 성공 → 상위(App) 콜백으로 탭 전환 + subject 전달
    onUploaded(subject.subject_id);
  }

return (
  <div className="sa-container" style={{ marginTop: 12 }}>
    {/* 업로드 카드 */}
    <section className="sa-card">
        <div className="sa-card__header">
            <div className="sa-card__title" style={{gap:10}}>
                <span className="sa-title-badge">
                    <Upload />
                </span>
                학습 자료 업로드
            </div>
        {/* 카드 헤더 우측에 자료 유형 토글 */}
        <div className="sa-card__actions" style={{gap:8}}>
          <button className="sa-btn ghost" onClick={() => requireLogin(() => setOpenSubject(true))}>
            {subject ? `선택된 과목: ${subject.name}` : "과목 선택"}
          </button>
        </div>
      </div>

      <p className="sa-card__desc">
        PDF, 이미지, 텍스트를 업로드하면 AI가 자동으로 형식을 감지해 분석합니다.
      </p>
      {/* ✅ 보충 설명: 3가지 자동 인식 형식 */}
      <div className="sa-hint">
        <div className="sa-hint__item"> <b>PDF</b> — 슬라이드/교안 PDF 올리면 끝!</div>
        <div className="sa-hint__item"> <b>텍스트</b> — 긴 글은 붙여넣기 또는 .txt 업로드</div>
        <div className="sa-hint__item"> <b>사진</b> — 노트 사진(JPG·PNG)도 자동 글자 변환</div>
      </div>

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
          accept={ACCEPT_ALL}
          onChange={(e) => setFile(e.target.files?.[0] || undefined)}
          style={{ display: "none" }}
        />

        {!file ? (
          // 파일 미선택 상태
          <div className="sa-dropzone__inner">
            <div className="sa-upload-badge--svg">
                <IconUploadBadge/>
            </div>
            
            <div className="sa-dropzone__title">파일을 여기엔 드래그하거나</div>
            <div className="sa-dropzone__subtitle">
              아래 버튼을 클릭하여 파일을 선택하세요
            </div>
            <button className="sa-btn primary" onClick={() => inputRef.current?.click()}>
              파일 선택하기
            </button>
            <div className="sa-dropzone__meta">
              <span>• PDF, TXT, 이미지</span>
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
              <span>• PDF, TXT</span>
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