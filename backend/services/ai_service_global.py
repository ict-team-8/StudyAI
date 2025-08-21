# 코랩 코드 중, 정제/분할/임베딩 공용 코드 부분

import os, re, uuid
from bs4 import BeautifulSoup
from typing import List
import warnings, logging
warnings.filterwarnings("ignore", category=RuntimeWarning, module="pecab._tokenizer")
logging.getLogger("Kss").setLevel(logging.ERROR)

from langchain.schema import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings

# ---- 임베딩 (전역 1회만 로드) ----
_EMBEDDINGS = HuggingFaceEmbeddings(
    model_name="sentence-transformers/all-mpnet-base-v2",
    model_kwargs={'device': 'cpu'}
)

# ---- 텍스트 정리 ----
def clean_text(t: str) -> str:
    t = BeautifulSoup(t, "html.parser").get_text(" ")
    t = re.sub(r"\s+", " ", t).strip()
    return t

# ---- 청크 분할 ----
def split_to_chunks(plain: List[str], chunk_size: int = 512, chunk_overlap: int = 50) -> List[Document]:
    docs = [Document(page_content=clean_text(x)) for x in plain if x and x.strip()]
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", " ", ""],
    )
    return splitter.split_documents(docs)
