"""Comment submission routes."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from ..extensions import db
from ..models import Comment, Topic, User

bp = Blueprint('comments', __name__)

@bp.post('/comments')
@jwt_required()
def submit_comment():
    """Submit a new comment for a topic."""
    from flask_jwt_extended import get_jwt

    data = request.get_json() or {}
    topic_id = data.get('topic_id')
    comment_text = data.get('comment_text')

    if topic_id is None or comment_text is None:
        return jsonify({'error': 'topic_id and comment_text are required'}), 400

    try:
        topic_id = int(topic_id)
    except (TypeError, ValueError):
        return jsonify({'error': 'topic_id must be an integer'}), 400

    comment_text = comment_text.strip()
    if not comment_text:
        return jsonify({'error': 'comment_text cannot be empty'}), 400

    topic = Topic.query.get(topic_id)
    if not topic:
        return jsonify({'error': 'Topic not found'}), 404

    try:
        user_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid token identity'}), 401

    user_role = get_jwt().get('role')

    if not user_id or not user_role:
        return jsonify({'error': 'Invalid token identity'}), 401
    if user_role not in {'citizen', 'expert'}:
        return jsonify({'error': 'Only citizen or expert users can submit comments'}), 403
    if not User.query.get(user_id):
        return jsonify({'error': 'User not found'}), 404

    comment = Comment(
        topic_id=topic_id,
        user_id=user_id,
        user_role=user_role,
        content=comment_text
    )
    db.session.add(comment)
    db.session.commit()

    return jsonify({
        'message': 'Comment submitted successfully',
        'comment': {
            'id': comment.id,
            'topic_id': comment.topic_id,
            'user_id': comment.user_id,
            'user_role': comment.user_role,
            'comment_text': comment.content,
            'created_at': comment.created_at.isoformat() + 'Z'
        }
    }), 201
