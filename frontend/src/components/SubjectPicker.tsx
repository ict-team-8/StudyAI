// 재사용가능한 과목 선택 버튼

import React, { useState } from "react";
import SubjectModal from "./SubjectModal";

export type Subject = { subject_id: number; name: string };

export default function SubjectPicker({
  subject,
  onPick,
  align = "right",
}:{
  subject: Subject | null;
  onPick: (s: Subject) => void;
  align?: "left" | "right";
}){
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="sa-card__actions" style={{ justifyContent: align==="right" ? "flex-end" : "flex-start" }}>
        <button className="sa-btn ghost" onClick={()=>setOpen(true)}>
          {subject ? `선택된 과목: ${subject.name}` : "과목 선택"}
        </button>
        {subject && (
          <button className="sa-btn" onClick={()=>onPick({ subject_id: 0, name: "" } as Subject)}>
            선택 해제
          </button>
        )}
      </div>

      <SubjectModal
        open={open}
        onClose={()=>setOpen(false)}
        onPick={(s)=>{ onPick(s); setOpen(false); }}
      />
    </>
  );
}
