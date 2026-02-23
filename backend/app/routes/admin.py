"""Admin-only routes for managing topics and viewing comments."""
import uuid
from collections import Counter
from flask import Blueprint, current_app, jsonify, request, url_for
import os
from flask_jwt_extended import get_jwt_identity
from werkzeug.utils import secure_filename
from ..extensions import db
from ..nlp import preprocess_text_batch
from ..models import Comment, Topic
from .utils import admin_required

bp = Blueprint('admin', __name__, url_prefix='/admin')

ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx'}
COMMENTS_PER_PAGE = 10
VALID_COMMENT_ROLES = {'citizen', 'expert'}
SENTIMENT_BATCH_SIZE = 16
SENTIMENT_NEUTRAL_THRESHOLD = 0.60
SUMMARY_MAX_INPUT_CHARS = 8000
WORDCLOUD_MAX_WORDS = 100

def _allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def _parse_topic_id(topic_id_raw):
    """Validate and normalize topic_id from request payload/query."""
    if topic_id_raw is None:
        return None, 'topic_id is required'

    try:
        topic_id = int(topic_id_raw)
    except (TypeError, ValueError):
        return None, 'topic_id must be an integer'

    if topic_id <= 0:
        return None, 'topic_id must be a positive integer'

    return topic_id, None


def _validate_role(role: str | None):
    """Allow optional role filter limited to citizen/expert comment roles."""
    if role is None:
        return None
    if role not in VALID_COMMENT_ROLES:
        return 'role must be citizen or expert'
    return None


def _build_comment_query(topic_id: int, role: str | None = None):
    """Build base comment query with optional role filtering."""
    query = Comment.query.filter(Comment.topic_id == topic_id)
    if role:
        query = query.filter(Comment.user_role == role)
    return query


def _map_sentiment_output(model_output: dict) -> tuple[str, float]:
    """Normalize Hugging Face output into Positive/Neutral/Negative labels."""
    raw_label = str(model_output.get('label', '')).upper()
    confidence_score = float(model_output.get('score', 0.0))

    # DistilBERT is binary; we derive Neutral from low-confidence predictions.
    if confidence_score < SENTIMENT_NEUTRAL_THRESHOLD:
        return 'Neutral', confidence_score
    if raw_label in {'POSITIVE', 'LABEL_1'}:
        return 'Positive', confidence_score
    if raw_label in {'NEGATIVE', 'LABEL_0'}:
        return 'Negative', confidence_score
    return 'Neutral', confidence_score


def _get_ml_models():
    """Fetch loaded model pipelines that were initialized at app startup."""
    models = current_app.extensions.get('ml_models')
    if not models:
        raise RuntimeError('ML models are not loaded. Check backend startup logs.')
    return models


def _get_filtered_comments_or_error(topic_id: int, role: str | None):
    """Return topic + filtered comments or Flask error response tuple."""
    topic = Topic.query.get(topic_id)
    if not topic:
        return None, None, (jsonify({'error': 'Topic not found'}), 404)

    comments = _build_comment_query(topic_id, role).order_by(Comment.created_at.asc()).all()
    return topic, comments, None


def _save_document(uploaded_file):
    """Save uploaded file and return the stored filename."""
    if uploaded_file is None or uploaded_file.filename == '':
        return None, None

    if not _allowed_file(uploaded_file.filename):
        return None, 'Only PDF, DOC, and DOCX files are allowed'

    safe_name = secure_filename(uploaded_file.filename)
    unique_name = f"{uuid.uuid4().hex}_{safe_name}"

    upload_folder = current_app.config['UPLOAD_FOLDER']
    os.makedirs(upload_folder, exist_ok=True)

    file_path = os.path.join(upload_folder, unique_name)
    uploaded_file.save(file_path)
    return unique_name, None

@bp.post('/topics')
@admin_required
def create_topic():
    """Create a new consultation topic (optional document upload)."""
    if request.content_type and 'multipart/form-data' in request.content_type:
        title = request.form.get('title')
        description = request.form.get('description')
        uploaded_file = request.files.get('document')
    else:
        data = request.get_json() or {}
        title = data.get('title')
        description = data.get('description')
        uploaded_file = None

    if not title:
        return jsonify({'error': 'title is required'}), 400
    title = title.strip()
    if not title:
        return jsonify({'error': 'title cannot be empty'}), 400
    description = description.strip() if isinstance(description, str) else description

    filename, file_error = _save_document(uploaded_file)
    if file_error:
        return jsonify({'error': file_error}), 400

    admin_id = get_jwt_identity()

    try:
        admin_id = int(admin_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid token identity'}), 401

    topic = Topic(
        title=title,
        description=description,
        document_path=filename,
        created_by_admin_id=admin_id
    )
    db.session.add(topic)
    db.session.commit()

    document_url = None
    if topic.document_path:
        document_url = url_for('topics.download_topic_document', filename=topic.document_path, _external=True)

    return jsonify({
        'message': 'Topic created successfully',
        'topic': {
            'id': topic.id,
            'title': topic.title,
            'description': topic.description,
            'document_url': document_url,
            'created_at': topic.created_at.isoformat() + 'Z'
        }
    }), 201

@bp.get('/comments')
@admin_required
def get_topic_comments():
    """View comments for a topic with optional role filter and pagination."""
    topic_id = request.args.get('topic_id', type=int)
    role = request.args.get('role', type=str)
    page = request.args.get('page', default=1, type=int)

    if not topic_id:
        return jsonify({'error': 'topic_id is required'}), 400

    if page < 1:
        return jsonify({'error': 'page must be >= 1'}), 400

    role_error = _validate_role(role)
    if role_error:
        return jsonify({'error': role_error}), 400

    topic = Topic.query.get(topic_id)
    if not topic:
        return jsonify({'error': 'Topic not found'}), 404

    query = _build_comment_query(topic_id, role)

    paginated = query.with_entities(
        Comment.id,
        Comment.topic_id,
        Comment.user_id,
        Comment.user_role,
        Comment.content,
        Comment.created_at,
        Comment.sentiment_label
    ).order_by(Comment.created_at.desc()).paginate(
        page=page,
        per_page=COMMENTS_PER_PAGE,
        error_out=False
    )

    comments = [{
        'id': c.id,
        'topic_id': c.topic_id,
        'user_id': c.user_id,
        'user_role': c.user_role,
        'comment_text': c.content,
        'created_at': c.created_at.isoformat() + 'Z',
        'sentiment_label': c.sentiment_label
    } for c in paginated.items]

    return jsonify({
        'topic': {
            'id': topic.id,
            'title': topic.title
        },
        'filters': {
            'role': role,
            'page': page,
            'per_page': COMMENTS_PER_PAGE
        },
        'pagination': {
            'total_comments': paginated.total,
            'total_pages': paginated.pages,
            'has_next': paginated.has_next,
            'has_prev': paginated.has_prev
        },
        'comments': comments
    }), 200


@bp.post('/analyze-sentiment')
@admin_required
def analyze_sentiment():
    """Run batch sentiment analysis for a topic and persist results to database."""
    data = request.get_json() or {}
    topic_id, topic_error = _parse_topic_id(data.get('topic_id'))
    role = data.get('role')

    if topic_error:
        return jsonify({'error': topic_error}), 400
    role_error = _validate_role(role)
    if role_error:
        return jsonify({'error': role_error}), 400

    topic, comments, error_response = _get_filtered_comments_or_error(topic_id, role)
    if error_response:
        return error_response
    if not comments:
        return jsonify({
            'message': 'No comments found for analysis',
            'topic': {'id': topic.id, 'title': topic.title},
            'filters': {'role': role},
            'analyzed_comments': 0,
            'sentiment_counts': {'positive': 0, 'negative': 0, 'neutral': 0}
        }), 200

    # Preprocess in batch before inference to keep model input consistent.
    cleaned_texts = preprocess_text_batch([comment.content for comment in comments])
    model_inputs = [text if text else 'no content' for text in cleaned_texts]

    models = _get_ml_models()
    sentiment_outputs = models.sentiment_pipeline(
        model_inputs,
        batch_size=SENTIMENT_BATCH_SIZE,
        truncation=True,
    )

    sentiment_counts = Counter({'Positive': 0, 'Negative': 0, 'Neutral': 0})
    for comment, model_output in zip(comments, sentiment_outputs):
        sentiment_label, confidence_score = _map_sentiment_output(model_output)
        comment.sentiment_label = sentiment_label
        comment.sentiment_score = confidence_score
        sentiment_counts[sentiment_label] += 1

    db.session.commit()

    return jsonify({
        'message': 'Sentiment analysis completed',
        'topic': {'id': topic.id, 'title': topic.title},
        'filters': {'role': role},
        'analyzed_comments': len(comments),
        'sentiment_counts': {
            'positive': sentiment_counts['Positive'],
            'negative': sentiment_counts['Negative'],
            'neutral': sentiment_counts['Neutral'],
        }
    }), 200


@bp.get('/analytics')
@admin_required
def get_analytics():
    """Return analytics counts for comments and stored sentiment labels."""
    topic_id_raw = request.args.get('topic_id')
    role = request.args.get('role', type=str)
    topic_id, topic_error = _parse_topic_id(topic_id_raw)

    if topic_error:
        return jsonify({'error': topic_error}), 400
    role_error = _validate_role(role)
    if role_error:
        return jsonify({'error': role_error}), 400

    topic = Topic.query.get(topic_id)
    if not topic:
        return jsonify({'error': 'Topic not found'}), 404

    query = _build_comment_query(topic_id, role)
    total_comments = query.count()
    positive_count = query.filter(Comment.sentiment_label == 'Positive').count()
    negative_count = query.filter(Comment.sentiment_label == 'Negative').count()
    neutral_count = query.filter(Comment.sentiment_label == 'Neutral').count()
    analyzed_count = positive_count + negative_count + neutral_count
    pending_count = max(total_comments - analyzed_count, 0)

    return jsonify({
        'topic': {'id': topic.id, 'title': topic.title},
        'filters': {'role': role},
        'analytics': {
            'total_comments': total_comments,
            'positive_count': positive_count,
            'negative_count': negative_count,
            'neutral_count': neutral_count,
            'analyzed_count': analyzed_count,
            'pending_analysis_count': pending_count,
        }
    }), 200


@bp.post('/summarize')
@admin_required
def summarize_comments():
    """Generate a temporary summary for a topic's comments (not persisted)."""
    data = request.get_json() or {}
    topic_id, topic_error = _parse_topic_id(data.get('topic_id'))
    role = data.get('role')

    if topic_error:
        return jsonify({'error': topic_error}), 400
    role_error = _validate_role(role)
    if role_error:
        return jsonify({'error': role_error}), 400

    topic, comments, error_response = _get_filtered_comments_or_error(topic_id, role)
    if error_response:
        return error_response
    if not comments:
        return jsonify({'error': 'No comments found for summarization'}), 400

    cleaned_texts = [text for text in preprocess_text_batch([comment.content for comment in comments]) if text]
    if not cleaned_texts:
        return jsonify({'error': 'All comments became empty after preprocessing'}), 400

    # Large topic discussions can exceed model input limits; cap input length for CPU stability.
    summary_source_text = ' '.join(cleaned_texts)
    was_truncated = len(summary_source_text) > SUMMARY_MAX_INPUT_CHARS
    if was_truncated:
        summary_source_text = summary_source_text[:SUMMARY_MAX_INPUT_CHARS]

    models = _get_ml_models()
    summary_output = models.summarization_pipeline(
        f'summarize: {summary_source_text}',
        max_length=130,
        min_length=30,
        do_sample=False,
        truncation=True,
    )
    summary_text = summary_output[0].get('summary_text', '').strip()

    return jsonify({
        'topic': {'id': topic.id, 'title': topic.title},
        'filters': {'role': role},
        'total_comments': len(comments),
        'input_truncated': was_truncated,
        'processed_input_chars': len(summary_source_text),
        'summary': summary_text,
    }), 200


@bp.get('/wordcloud')
@admin_required
def get_wordcloud():
    """Return frontend-friendly word frequency JSON for word-cloud visualization."""
    topic_id_raw = request.args.get('topic_id')
    role = request.args.get('role', type=str)
    topic_id, topic_error = _parse_topic_id(topic_id_raw)

    if topic_error:
        return jsonify({'error': topic_error}), 400
    role_error = _validate_role(role)
    if role_error:
        return jsonify({'error': role_error}), 400

    topic, comments, error_response = _get_filtered_comments_or_error(topic_id, role)
    if error_response:
        return error_response
    if not comments:
        return jsonify({
            'topic': {'id': topic.id, 'title': topic.title},
            'filters': {'role': role},
            'total_comments': 0,
            'word_frequencies': []
        }), 200

    cleaned_texts = [text for text in preprocess_text_batch([comment.content for comment in comments]) if text]
    combined_text = ' '.join(cleaned_texts)

    # Use wordcloud's built-in token handling to keep behavior aligned with future image generation.
    try:
        from wordcloud import STOPWORDS, WordCloud
    except ImportError as exc:
        raise RuntimeError('Missing dependency: install wordcloud to use /admin/wordcloud.') from exc

    processor = WordCloud(stopwords=STOPWORDS, collocations=False)
    frequencies = processor.process_text(combined_text)
    sorted_frequencies = sorted(frequencies.items(), key=lambda item: item[1], reverse=True)[:WORDCLOUD_MAX_WORDS]

    # Frontend-friendly shape: [{text, value}, ...]
    word_frequencies = [{'text': word, 'value': count} for word, count in sorted_frequencies]

    return jsonify({
        'topic': {'id': topic.id, 'title': topic.title},
        'filters': {'role': role},
        'total_comments': len(comments),
        'unique_words': len(frequencies),
        'word_frequencies': word_frequencies
    }), 200
