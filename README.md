## 🤖 AI 학습 보조 챗봇 서비스

<img width="1152" height="648" alt="프젝 주제" src="https://github.com/user-attachments/assets/028c3f80-2e64-418e-af89-2f14f51c4d10" />
<div align="center">

### ✨ AI 학습 특화 챗봇 서비스 ✨

학생·수험생·연구자를 위해 긴 문서, PDF, 이미지 자료를 빠르게 **요약 📄**하고,  
Q&A, 예상 문제, 개인 맞춤 **피드백 🎯**을 제공합니다.  

시험 대비와 자기주도 학습에서 가장 부담되는  
자료 정리·문제 출제·취약점 진단을 **자동화 ⚡**하여  
⏳ 시간을 절약하고 📈 학습 효율을 높여드립니다.  

</div>

<div align="center">

## ⚙️ Tech Stack

### 🖥️ Frontend  
<img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black"> 
<img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white"> 
<img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white">  

### ⚡ Backend  
<img src="https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white"> 
<img src="https://img.shields.io/badge/FastAPI Users-009688?style=for-the-badge&logo=fastapi&logoColor=white"> 
<img src="https://img.shields.io/badge/Pydantic v2-E92063?style=for-the-badge&logo=pydantic&logoColor=white"> 
<img src="https://img.shields.io/badge/Uvicorn-4B8BBE?style=for-the-badge&logo=python&logoColor=white">  

### 🗄️ Database  
<img src="https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white">  

### 🛠️ Infra & Tools  
<img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white"> 
<img src="https://img.shields.io/badge/GitHub-181717?style=for-the-badge&logo=github&logoColor=white"> 
<img src="https://img.shields.io/badge/Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black">  

</div>


## 🚀 핵심 기능 (Key Features)

1. **요약 (Summarization)**  
   - 과목 선택 후 자료(**PDF, Text, Image**) 업로드  
   - 이미지 → **Tesseract-OCR** 변환 (GrayScale, 샤프닝 등 전처리 적용)  
   - 임베딩 → **Vector DB** 저장 → **RAG 기반 Gemini LLM** 자동 요약  
   - **CRAG** 검증·보완을 거쳐 더 핵심적인 요약 제공  
   - 카테고리별 요약:  
     - 핵심 개념 / 함정·오개념 / 영역별 맞춤 요약 / 3줄 최종 요약  

2. **번역 (Translation)**  
   - 요약 텍스트를 **영어, 일본어, 터키어 등 다국어 번역** 지원  

3. **Q&A (Question & Answer)**  
   - 사용자의 질문에 대해 **신뢰성 있는 답변** 제공  
   - 관련 문서 청크 **Retrieval + Re-ranking**으로 정확도 향상  
   - **출처 기반 답변** 제공  

4. **AI 문제 생성 (AI Quiz Generation)**  
   - 업로드 자료 기반으로 **다양한 유형·난이도의 문제 자동 생성**  
   - Vector DB에서 관련 청크 검색 → Context 구성 → **LLM 문제·해설 생성**  
   - 문제 풀이 후 **정답률, 풀이 시간, 난이도 등급, 기록** 확인 가능  

5. **PDF 내보내기 (Export to PDF)**  
   - 요약 문서를 **fpdf2** 라이브러리로 PDF 저장 및 다운로드  

6. **학습 분석 (Learning Analytics)**  
   - 학습 통계 제공: **전체 정답률, 문제 수, 학습 시간, 학습 상태**  
   - **과목별 요약, Q&A 기록, 문제풀이 결과**를 시간순으로 정리  
   - 개인별 **맞춤 피드백** 제공
  
&nbsp;
## 👤 Backend & Frontend Developers

<table>
    <tr height="200px">
      <td align="center" width="200px">
            <a href="https://github.com/paul0755">
                <img height="150px" width="150px" src="https://avatars.githubusercontent.com/paul0755"/>
            </a>
            <br />
            <a href="https://github.com/paul0755">장예찬</a>
        </td>
        <td align="center" width="200px">
            <a href="https://github.com/minjikimkim2222">
                <img height="150px" width="150px" src="https://avatars.githubusercontent.com/minjikimkim2222"/>
            </a>
            <br />
            <a href="https://github.com/minjikimkim2222">김민지</a>
        </td>
    </tr>
</table>
