"""Topic routes for authenticated users."""
import os
from flask import Blueprint, current_app, jsonify, send_from_directory, url_for
from flask_jwt_extended import jwt_required
from ..models import Topic

bp = Blueprint('topics', __name__)

@bp.get('/topics')
@jwt_required()
def list_topics():
    """Return all consultation topics for logged-in users."""
    topics = Topic.query.order_by(Topic.created_at.desc()).all()

    topic_list = []
    for topic in topics:
        document_url = None
        if topic.document_path:
            document_url = url_for('topics.download_topic_document', filename=topic.document_path, _external=True)

        topic_list.append({
            'id': topic.id,
            'title': topic.title,
            'description': topic.description,
            'document_url': document_url,
            'created_at': topic.created_at.isoformat() + 'Z'
        })

    return jsonify({'topics': topic_list}), 200

@bp.get('/uploads/<path:filename>')
@jwt_required()
def download_topic_document(filename: str):
    """Serve uploaded topic documents to authenticated users."""
    upload_folder = current_app.config['UPLOAD_FOLDER']
    safe_path = os.path.abspath(upload_folder)
    return send_from_directory(safe_path, filename, as_attachment=False)
