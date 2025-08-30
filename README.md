## ✨ AI 학습 특화 챗봇 서비스 ✨

> 긴 학습자료를 빠르게 요약하고, Q&A·문제 생성·피드백까지 제공하는 **AI 학습 플랫폼**  
> 시험 대비와 자기주도 학습의 부담을 줄이고 **시간을 절약**해 학습 효율을 높입니다.

<br>



## 🎥 시연 영상
[![시연 영상](https://img.shields.io/badge/YouTube-영상보기-red?logo=youtube)](https://github.com/user-attachments/assets/2b89e008-bf75-496b-967c-a0d972f91ce8)



<br>

<div align="center">

## ⚙️ Tech Stack

| 영역 | 기술 |
|------|------|
| Frontend | React, TypeScript, Vite |
| Backend | FastAPI, FastAPI-Users, Pydantic v2, Uvicorn |
| AI/ML | Gemini API, LangChain, SentenceTransformers, Chroma |
| Database | MySQL |
| Infra/Tools | Swagger, Notion, Discord |
 

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
  

<br> 

## 🗂 시스템 구조 다이어그램

<img width="549" height="282" alt="image" src="https://github.com/user-attachments/assets/ef224021-58f3-4c11-8d10-0fff14a8f076" />

<img width="549" height="282" alt="image" src="https://github.com/user-attachments/assets/4406c410-277d-4333-b3b8-611fb49437ba" />

<img width="538" height="288" alt="image" src="https://github.com/user-attachments/assets/24260553-9f04-42f3-979a-60ccc89c7386" />

<img width="540" height="299" alt="image" src="https://github.com/user-attachments/assets/32f94d5e-0c5b-4a63-a5f6-b67535b446e8" />

<img width="541" height="297" alt="image" src="https://github.com/user-attachments/assets/45018783-ff91-46b1-b99f-bd42e5e313b6" />

<img width="541" height="292" alt="image" src="https://github.com/user-attachments/assets/b8b8b18c-f86a-44d3-821c-c81212e13996" />




  
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
