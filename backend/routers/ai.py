from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from services.ai_service import summarize_text, load_text_from_url, load_text_from_pdf_bytes, clean_text, generate_quiz
from pydantic import BaseModel

router = APIRouter()

def _norm(s: str | None) -> str | None:
    return s.strip() if s and s.strip() else None

@router.post("/summary")
async def ai_summary(
    mode: str = Form("summary"),
    text: str | None = Form(None),
    url: str | None = Form(None),
    question: str | None = Form(None),
    file: UploadFile | None = File(None),
):
    try:
        text = _norm(text)
        url  = _norm(url)
        question = _norm(question)

        # 1) 입력 유효성
        sources = [bool(text), bool(url), bool(file)]
        if sum(sources) == 0:
            raise HTTPException(400, "text, url, file 중 하나는 필요합니다.")
        if sum(sources) > 1:
            raise HTTPException(400, "text, url, file 중 하나만 보내세요. (중복 입력 금지)")
        if mode not in ("summary", "qa"):
            raise HTTPException(400, "mode 는 'summary' 또는 'qa' 만 허용됩니다.")
        if mode == "qa" and not question:
            raise HTTPException(400, "QA 모드에는 question이 필요합니다.")
        if url and not (url.lower().startswith("http://") or url.lower().startswith("https://")):
            raise HTTPException(400, f"유효하지 않은 URL: {url}")

        # 2) 소스 선택
        if url:
            src = load_text_from_url(url)
        elif file:
            src = load_text_from_pdf_bytes(await file.read())
        else:
            src = clean_text(text or "")

        # 3) 실행
        out = summarize_text(src, question if mode == "qa" else None)
        return {"mode": mode, "result": out}

    except HTTPException:
        raise
    except Exception as e:
        # 내부 에러는 500
        raise HTTPException(500, f"AI 처리 실패: {e}")
    

# 요청 바디 스키마
class QuizRequest(BaseModel):
    material_name: str
    qtype: str
    difficulty: str
    num_questions: int

# 응답 스키마는 QuizSet을 그대로 써도 되거나, dict로 변환
@router.post("/generate")
def generate_quiz_api(req: QuizRequest):
    try:
        quiz = generate_quiz(
            material_name=req.material_name,
            qtype=req.qtype,
            difficulty=req.difficulty,
            num_questions=req.num_questions,
        )
        return quiz.model_dump()
    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"잘못된 요청: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"서버 오류: {e}")
