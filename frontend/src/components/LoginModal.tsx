// ===============================
// 설명: 로그인 모달 → /api/auth/jwt/login 호출 후 토큰 저장
// ===============================
import React, { useState } from "react";
import { useAuth } from "../auth";
import Modal from "./Modal";

export default function LoginModal({ open, onClose }:{ open: boolean; onClose: () => void }){
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string|undefined>();

  async function onSubmit(){
    setLoading(true); setError(undefined);
    try { await login(email, pw); onClose(); }
    catch(e:any){ setError(e?.response?.data?.detail || "로그인 실패"); }
    finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="로그인">
      <div className="sa-field">
        <label>이메일</label>
        <input value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="you@example.com" />
      </div>
      <div className="sa-field">
        <label>비밀번호</label>
        <input type="password" value={pw} onChange={(e)=>setPw(e.target.value)} placeholder="••••••••" />
      </div>
      {error && <div className="sa-error">{error}</div>}
      <div className="sa-actions">
        <button className="sa-btn ghost" onClick={onClose}>취소</button>
        <button className="sa-btn primary" onClick={onSubmit} disabled={loading}>{loading?"로그인 중…":"로그인"}</button>
      </div>
    </Modal>
  );
}