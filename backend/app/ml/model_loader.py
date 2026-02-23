"""Load and hold Hugging Face models once at backend startup."""
from dataclasses import dataclass
from threading import Lock
from typing import Any

SENTIMENT_MODEL_NAME = 'distilbert-base-uncased-finetuned-sst-2-english'
SUMMARIZATION_MODEL_NAME = 't5-small'


@dataclass(frozen=True)
class LoadedModels:
    """Container for model names and ready-to-use pipelines."""
    sentiment_model_name: str
    summarization_model_name: str
    sentiment_pipeline: Any
    summarization_pipeline: Any


_loaded_models: LoadedModels | None = None
_load_lock = Lock()


def load_models_once() -> LoadedModels:
    """Load sentiment and summarization models exactly once per process."""
    global _loaded_models

    if _loaded_models is not None:
        return _loaded_models

    with _load_lock:
        if _loaded_models is not None:
            return _loaded_models

        # Import here so startup errors are explicit if ML deps are missing.
        try:
            from transformers import (
                AutoModelForSequenceClassification,
                AutoModelForSeq2SeqLM,
                AutoTokenizer,
                pipeline,
            )
        except ImportError as exc:
            raise RuntimeError(
                'Missing ML dependencies. Install backend requirements (transformers and torch).'
            ) from exc

        # Sentiment model: smaller and faster, suitable for classification.
        sentiment_tokenizer = AutoTokenizer.from_pretrained(SENTIMENT_MODEL_NAME)
        sentiment_model = AutoModelForSequenceClassification.from_pretrained(SENTIMENT_MODEL_NAME)
        sentiment_pipeline = pipeline(
            task='sentiment-analysis',
            model=sentiment_model,
            tokenizer=sentiment_tokenizer,
        )

        # Summarization model: use T5-Small to reduce RAM usage and improve CPU latency.
        # Trade-off: summaries are usually faster to generate, but may be less fluent/accurate
        # than larger models like DistilBART or BART-large on complex long-form text.
        summarization_tokenizer = AutoTokenizer.from_pretrained(SUMMARIZATION_MODEL_NAME)
        summarization_model = AutoModelForSeq2SeqLM.from_pretrained(SUMMARIZATION_MODEL_NAME)
        summarization_pipeline = pipeline(
            task='summarization',
            model=summarization_model,
            tokenizer=summarization_tokenizer,
            framework='pt',
            device=-1,  # Force CPU execution to avoid accidental GPU selection issues.
        )

        _loaded_models = LoadedModels(
            sentiment_model_name=SENTIMENT_MODEL_NAME,
            summarization_model_name=SUMMARIZATION_MODEL_NAME,
            sentiment_pipeline=sentiment_pipeline,
            summarization_pipeline=summarization_pipeline,
        )

    return _loaded_models


def get_loaded_models() -> LoadedModels:
    """Return already-loaded models; raise if startup loading has not run yet."""
    if _loaded_models is None:
        raise RuntimeError('Models are not loaded. Call load_models_once() at app startup.')
    return _loaded_models
