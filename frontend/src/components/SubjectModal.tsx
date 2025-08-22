

// ===============================
// 설명: 과목 검색/선택/즉시 생성 모달 (/subjects)
// ===============================
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import Modal from "./Modal";

type Subject = { subject_id: number; name: string };

function useDebounce<T>(v: T, ms=300){
  const [d,setD]=useState(v);
  useEffect(()=>{ const t=setTimeout(()=>setD(v),ms); return ()=>clearTimeout(t); },[v,ms]);
  return d;
}

export default function SubjectModal({ open, onClose, onPick }:{ open: boolean; onClose: () => void; onPick: (s:Subject)=>void; }){
  const [q, setQ] = useState("");
  const dq = useDebounce(q);
  const [items, setItems] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);

  // 목록 로드/검색
  async function load(query?: string){
    setLoading(true);
    const { data } = await api.get<Subject[]>("/subjects", { params: query?{ q: query }:{} });
    setItems(data); setLoading(false);
  }
  useEffect(()=>{ if(open){ load(); setQ(""); } }, [open]);
  useEffect(()=>{ if(open && dq) load(dq); }, [open, dq]);

  // 검색어가 목록에 없으면 "+ 새 과목 생성" 노출
  const showCreate = useMemo(()=>{
    const t=q.trim(); if(!t) return false; return !items.some(i=>i.name===t);
  },[q,items]);

  async function createNew(){
    const name=q.trim(); if(!name) return;
    const { data } = await api.post<Subject>("/subjects", { name });
    onPick(data); onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="과목 선택" width={560}>
      <div className="sa-field">
        <input autoFocus placeholder="과목명 검색 (예: 정처기)" value={q} onChange={(e)=>setQ(e.target.value)} />
      </div>
      <div className="sa-list">
        {loading && <div className="sa-list__item">불러오는 중…</div>}
        {!loading && items.map(s=> (
          <div key={s.subject_id} className="sa-list__item selectable" onClick={()=>{ onPick(s); onClose(); }}>{s.name}</div>
        ))}
        {!loading && showCreate && (
          <div className="sa-list__item create" onClick={createNew}>+ "{q.trim()}" 새 과목 생성</div>
        )}
        {!loading && items.length===0 && !showCreate && (
          <div className="sa-list__item">검색 결과 없음</div>
        )}
      </div>
      <div className="sa-actions">
        <button className="sa-btn ghost" onClick={onClose}>닫기</button>
      </div>
    </Modal>
  );
}