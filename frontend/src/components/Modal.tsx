// ===============================
// 설명: 화면 공통 모달(뒷배경 + 카드)
// ===============================
import React from "react";

export default function Modal({ open, onClose, width = 520, title, children, footer }:{
  open: boolean; onClose: () => void; width?: number; title?: string; children?: React.ReactNode; footer?: React.ReactNode;
}){
  if (!open) return null;
  return (
    <div className="sa-modal__backdrop" onClick={onClose}>
      <div className="sa-modal" style={{ width }} onClick={(e)=>e.stopPropagation()}>
        {title && <div className="sa-modal__title">{title}</div>}
        <div className="sa-modal__body">{children}</div>
        {footer && <div className="sa-modal__footer">{footer}</div>}
      </div>
    </div>
  );
}