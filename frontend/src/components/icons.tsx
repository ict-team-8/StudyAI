import React from "react";

/** 좌상단 StudyAI 보라 아이콘 */
export function IconStudyAI(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" width="40" height="40" {...props}>
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8B7BFF"/>
          <stop offset="1" stopColor="#6F5BFF"/>
        </linearGradient>
        <radialGradient id="g2" cx="50%" cy="35%" r="60%">
          <stop offset="0" stopColor="#A99DFF"/>
          <stop offset="1" stopColor="#6F5BFF"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="64" height="64" rx="16" fill="url(#g1)"/>
      {/* 살짝 광택 */}
      <ellipse cx="32" cy="20" rx="22" ry="12" fill="url(#g2)" opacity=".55"/>
      {/* 체크 모양(학습완료 느낌) */}
      <path d="M20 33l9 9 17-17" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
      {/* 반짝이 */}
      <g fill="#fff">
        <circle cx="48" cy="16" r="2.2"/><circle cx="50" cy="26" r="1.4"/>
        <circle cx="16" cy="18" r="1.6"/><circle cx="14" cy="26" r="1.2"/>
      </g>
    </svg>
  );
}

/** 섹션 점 아이콘 (학습 자료 업로드 왼쪽 보라 동그라미) */
export function IconDot(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" {...props}>
      <defs>
        <linearGradient id="d1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8B7BFF"/>
          <stop offset="1" stopColor="#6F5BFF"/>
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#d1)"/>
    </svg>
  );
}

/** 드롭존 중앙 원형 업로드 아이콘 */
export function IconUploadBadge(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 72 72" width="72" height="72" {...props}>
      <defs>
        <radialGradient id="u1" cx="50%" cy="35%" r="60%">
          <stop offset="0" stopColor="#A99DFF"/>
          <stop offset="1" stopColor="#6F5BFF"/>
        </radialGradient>
      </defs>
      <circle cx="36" cy="36" r="30" fill="url(#u1)"/>
      <path d="M36 46V26m0 0l-9 9m9-9l9 9" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  );
}

/** 탭 앞 아이콘들 – 필요 시 더 추가 가능 */
export function IconTabUpload(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...props}>
      <path d="M12 16V8m0 0l-4 4m4-4l4 4M6 20h12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
export function IconTabQA(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...props}>
      <path d="M4 5h16v10H7l-3 3V5z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
export function IconTabGen(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...props}>
      <path d="M12 3v18M3 12h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
export function IconTabSolve(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...props}>
      <path d="M4 7h16M4 12h10M4 17h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
export function IconTabAnalytics(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" {...props}>
      <path d="M4 20V10m5 10V6m5 14V12m5 8V4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
