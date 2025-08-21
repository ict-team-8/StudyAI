# services/document_service.py

# ------------------------------------------------------------
# 업로드된 PDF/텍스트를 파싱 → 청크 → 임베딩(Chroma) → 메타를 RDB에 기록하는 서비스
# 컨트롤러(라우터)에서 이 모듈의 handle_upload()를 호출해 사용한다.
# ------------------------------------------------------------


import os, uuid, hashlib
from datetime import datetime
from typing import List, Optional, Tuple

from fastapi import HTTPException, UploadFile
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

# LangChain 문서/로더/벡터DB
from langchain.schema import Document
from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import Chroma


# 공용 AI 유틸: 임베딩 인스턴스/텍스트 정제/청크 분할 함수
from services.ai_service_global import _EMBEDDINGS, clean_text, split_to_chunks

# RDB 테이블 모델 (SQLAlchemy)
from models.document_domain import DocumentTable
from models.vector_domain import VectorIndexTable, VectorDocTable

# ============================================================
# 저장 경로 설정
# ============================================================
# 아래 두 개는 “어디에 저장할지”를 .env 로 오버라이드 가능하게 해둔 것.
# 지정 안 하면 프로젝트 폴더 밑에 기본 경로로 저장된다.
# - CHROMA_ROOT : 임베딩(벡터) 파일들이 저장될 루트 폴더
# - UPLOAD_ROOT : 사용자가 올린 원본 파일 보관 폴더
CHROMA_ROOT = os.getenv("CHROMA_ROOT", "./.chroma") 
UPLOAD_ROOT = os.getenv("UPLOAD_ROOT", "./uploads") 

os.makedirs(CHROMA_ROOT, exist_ok=True) # 폴더가 없으면 생성
os.makedirs(UPLOAD_ROOT, exist_ok=True)

# ============================================================
# (user_id, subject_id) → Chroma 컬렉션 이름/경로 결정
# ============================================================
def _collection_for(user_id: uuid.UUID, subject_id: int) -> Tuple[str, str]:
    """
    동일 유저/과목에 대해 늘 같은 컬렉션 이름이 나오도록 안정적으로 생성한다.
    - 컬렉션명 예: "chroma_u1a2b3c4_s17"
    - 디스크 경로 예: "<CHROMA_ROOT>/chroma_u1a2b3c4_s17"
    """
    seed = f"{user_id.hex}_{subject_id}"
    short = hashlib.sha1(seed.encode()).hexdigest()[:8]  # 너무 길지 않게 8자리만 사용
    collection_name = f"chroma_u{short}_s{subject_id}"
    persist_dir = os.path.join(CHROMA_ROOT, collection_name)
    return collection_name, persist_dir

async def get_or_create_vector_index(
        session: AsyncSession, user_id: uuid.UUID, subject_id: int) -> VectorIndexTable:
    """
    vector_indexes 테이블에서 (user_id, subject_id) 행을 가져오거나, 없으면 새로 만든다.
    - RDB에는 '벡터가 실제로 어디(persist_dir)에, 어떤 컬렉션명으로 저장됐는지'를 기록한다.
    - 실제 벡터 값은 Chroma(디스크)에 저장된다.
    """
    # 1) 먼저 존재 여부 확인
    q = await session.execute(
        select(VectorIndexTable).where(
            VectorIndexTable.user_id == user_id,
            VectorIndexTable.subject_id == subject_id
        )
    )
    row = q.scalar_one_or_none()
    if row:
        return row

    # 2) 없으면 컬렉션 이름/경로 만들어서 신규 생성
    collection_name, persist_dir = _collection_for(user_id, subject_id)
    row = VectorIndexTable(
        user_id=user_id,
        subject_id=subject_id,
        provider="chroma",
        embedding_model="sentence-transformers/all-mpnet-base-v2",
        collection_name=collection_name,
        persist_dir=persist_dir,
    )
    session.add(row)
    await session.flush()  # vector_index_id 확보
    return row

# ============================================================
# 파일을 텍스트 리스트로 변환
# ============================================================
async def _load_plain_from_file(file_path: str) -> List[str]:
    """
    PDF 파일을 페이지 단위로 읽어 텍스트를 뽑아낸 뒤, clean_text()로 정제한다.
    - 반환: ["문서1페이지 정제 텍스트", "문서2페이지 정제 텍스트", ...]
    """
    loader = PyPDFLoader(file_path)
    docs = loader.load()
    plain = [clean_text(d.page_content) for d in docs]
    return plain

# ============================================================
# Chroma 컬렉션 핸들(연결) 확보
# ============================================================
def _ensure_chroma(index_row: VectorIndexTable) -> Chroma:
    try:
        return Chroma(
            collection_name=index_row.collection_name,
            persist_directory=index_row.persist_dir,
            embedding_function=_EMBEDDINGS,
        )
    except Exception:
        os.makedirs(index_row.persist_dir, exist_ok=True)
        return Chroma(
            collection_name=index_row.collection_name,
            persist_directory=index_row.persist_dir,
            embedding_function=_EMBEDDINGS,
        )


# ============================================================
# 메인: 업로드 처리 → 인덱싱 → 상태/통계 업데이트
# ============================================================
async def handle_upload(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,         # 현재 로그인 사용자 ID
    subject_id: int,            # 사용자가 선택/생성한 과목 ID
    file: UploadFile | None,    # PDF 파일(멀티파트) - file 또는 text 중 하나는 필수
    text: str | None,           # 긴 텍스트(문서 없이 직접 입력)
) -> dict:
    """
    업로드 요청 1건을 처리한다.
    1) documents INSERT(status='uploaded')
    2) PDF 파싱 or text 정제 → 청크 분할
    3) (user,subject) vector_indexes GET or CREATE
    4) 해당 Chroma 컬렉션에 add_documents() → 이때 임베딩 계산 & 디스크 저장
    5) vector_docs INSERT (문서별 청크 수/상태 기록)
    6) 카운터/documents.status 업데이트, 커밋
    7) 응답 JSON 반환
    """
    # -------- 입력 검증 --------
    if not subject_id:
        raise HTTPException(422, "subject_id is required")
    if not file and not text:
        raise HTTPException(422, "file or text is required")

    # -------- 1) documents INSERT --------
    # 업로드 타입/제목 결정
    if file:
        # 파일 이름은 경로 제거(보안/OS 차이 방지). 예) "React.pdf"
        title = (file.filename or "PDF").rsplit("/", 1)[-1]
        source_type = "PDF"
    else:
        title = "긴 텍스트"
        source_type = "TEXT"

    # DB에 문서 메타 먼저 기록 (status='uploaded')
    doc = DocumentTable(
        user_id=user_id,
        subject_id=subject_id,
        title=title,
        source_type=source_type,
        status="uploaded",
    )
    session.add(doc)
    await session.flush()     # document_id 확보(아래 파일명/메타에 사용)

    # -------- 2) 파싱 → 정제 → 분할 --------
    plain: List[str]
    saved_path: Optional[str] = None

    if file:
        # (a) 업로드 파일을 서버 디스크에 보관
        #     나중에 재처리/감사/디버깅을 위해 원본을 남겨둔다.
        saved_path = os.path.join(UPLOAD_ROOT, f"{doc.document_id}_{title}")
        with open(saved_path, "wb") as f:
            f.write(await file.read())
        
        # (b) PDF → 텍스트 리스트
        plain = await _load_plain_from_file(saved_path)
    else:
        # (c) 직접 입력된 긴 텍스트 1건
        plain = [clean_text(text or "")]

    if not plain:
        # 텍스트 아무 것도 못 뽑았으면 실패
        raise HTTPException(400, "No text extracted.")

    # 텍스트 해시 기록(옵션)
    # (d) 전체 텍스트 해시 기록(중복/변조 탐지용 – 선택)
    import hashlib
    doc.text_hash = hashlib.sha1("".join(plain).encode()).hexdigest()
    doc.file_url = saved_path  # 파일 보관 경로(텍스트 입력이면 None)
    await session.flush()

    # (e) 청크 분할 (512/50)
    chunks: List[Document] = split_to_chunks(plain, chunk_size=512, chunk_overlap=50)
    chunk_count = len(chunks)

    # -------- 3) vector_indexes GET or CREATE --------
    vindex = await get_or_create_vector_index(session, user_id, subject_id)

    # -------- 4) Chroma add_documents (이때 임베딩 생성&저장) --------
    #    각 청크에 메타데이터를 붙여 나중에 필터링/출처표시에 사용
    enriched_chunks: List[Document] = []
    for i, d in enumerate(chunks):
        enriched_chunks.append(
            Document(
                page_content=d.page_content,
                metadata={
                    "user_id": str(user_id), # string으로 저장 권장
                    "subject_id": subject_id,
                    "document_id": doc.document_id,
                    "ord": i, # 문서 내 청크 순서
                    "source": source_type.lower(), # 'pdf' or 'text'
                },
            )
        )

    # 컬렉션 “열기”(핸들 얻기). 없으면 생성됨
    vectordb = _ensure_chroma(vindex)

    # 실제 임베딩 계산과 저장은 add_documents()/from_documents() 호출 시점에 일어난다.
    try:
        vectordb.add_documents(enriched_chunks)
    except Exception:
        # 아주 초기 상태 등에서 add_documents가 실패하면 from_documents가 더 안전한 경우가 있다.
        Chroma.from_documents(
            documents=enriched_chunks,
            embedding=_EMBEDDINGS,
            collection_name=vindex.collection_name,
            persist_directory=vindex.persist_dir,
        )

    # -------- 5) vector_docs INSERT (문서별 매핑/상태) --------
    vdoc = VectorDocTable(
        vector_index_id=vindex.vector_index_id,
        document_id=doc.document_id,
        chunk_count=chunk_count,
        status="done",
    )
    session.add(vdoc)

    # -------- 6) 카운터/상태 업데이트 --------
    # documents.status, vector_indexes 카운트 업데이트
    doc.status = "indexed"
    vindex.doc_count = (vindex.doc_count or 0) + 1
    vindex.chunk_count = (vindex.chunk_count or 0) + chunk_count
    vindex.updated_at = datetime.utcnow()

    await session.commit()

    return {
        "document_id": doc.document_id,
        "subject_id": subject_id,
        "vector_index_id": vindex.vector_index_id,
        "chunks": chunk_count,
        "indexed": True,
    }
