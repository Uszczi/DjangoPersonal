from dataclasses import dataclass

from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

MODEL_MAX_TOKENS = 8192
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 150

headers_to_split_on = [
    ("#", "h1"),
    ("##", "h2"),
    ("###", "h3"),
    ("####", "h4"),
    ("#####", "h5"),
    ("######", "h6"),
]
KEYS = [key for _, key in headers_to_split_on]
MARKDOWN_SPLITER = MarkdownHeaderTextSplitter(headers_to_split_on)
LENGTH_SPLITTER = RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)


@dataclass(frozen=True)
class SplitResult:
    heading_path: str
    text: str


def split_note(text: str) -> list[SplitResult]:
    result = []
    sections = MARKDOWN_SPLITER.split_text(text)
    for split in LENGTH_SPLITTER.split_documents(sections):
        headings = [split.metadata[key] for key in KEYS if key in split.metadata]
        result.append(SplitResult(heading_path=" / ".join(headings), text=split.page_content))
    return result
