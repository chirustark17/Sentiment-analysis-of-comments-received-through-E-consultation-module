"""Reusable text preprocessing utilities for NLP tasks."""
import re
from typing import Iterable

# Match URLs starting with http/https or www.
URL_PATTERN = re.compile(r'https?://\S+|www\.\S+')

# Keep only lowercase letters, digits, and whitespace.
SPECIAL_CHAR_PATTERN = re.compile(r'[^a-z0-9\s]')

# Replace repeated whitespace (spaces, tabs, newlines) with a single space.
WHITESPACE_PATTERN = re.compile(r'\s+')


def preprocess_text(text: str) -> str:
    """Apply the standard cleaning pipeline for sentiment/summary/word-cloud input."""
    if text is None:
        return ''

    if not isinstance(text, str):
        text = str(text)

    # 1) Convert to lowercase to reduce vocabulary size.
    cleaned = text.lower()

    # 2) Remove URLs because they usually do not carry sentiment meaning.
    cleaned = URL_PATTERN.sub(' ', cleaned)

    # 3) Remove special characters so models see cleaner tokens.
    cleaned = SPECIAL_CHAR_PATTERN.sub(' ', cleaned)

    # 4) Normalize whitespace and trim edges.
    cleaned = WHITESPACE_PATTERN.sub(' ', cleaned).strip()

    return cleaned


def preprocess_text_batch(texts: Iterable[str]) -> list[str]:
    """Preprocess many texts using the same standard pipeline."""
    return [preprocess_text(text) for text in texts]
