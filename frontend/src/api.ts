// 토큰 저장/부착 책임 -> 프론트 전역에서 인증 고민 없이
// Axois 인스턴스 + JWT 저장/첨부 공통 헬퍼

import axios from "axios";


// 로컬스토리지에 JWT를 저장할 때 사용할 key 이름(임의 문자열)
export const TOKEN_KEY = "auth_token";


// 현재 저장된 토큰 조회
export const getAuthToken = () => localStorage.getItem(TOKEN_KEY);


// 토큰 저장/삭제 (undefined 전달 시 삭제)
export const setAuthToken = (t?: string) => {
if (t) localStorage.setItem(TOKEN_KEY, t);
else localStorage.removeItem(TOKEN_KEY);
};


// 모든 API 호출은 이 인스턴스를 사용
const api = axios.create({ baseURL: "/api", withCredentials: true });


// 요청 직전에 Authorization 헤더에 Bearer 토큰 자동 첨부
api.interceptors.request.use((config) => {
const token = getAuthToken();
if (token) config.headers.Authorization = `Bearer ${token}`;
return config;
});


// 응답이 401(만료/무효)면 토큰 제거 → 사실상의 로그아웃 상태로 전환
api.interceptors.response.use(undefined, (err) => {
if (err?.response?.status === 401) setAuthToken(undefined);
return Promise.reject(err);
});


export default api;
