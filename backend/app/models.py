"""Database models."""
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from .extensions import db

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # admin | citizen | expert
    professional_id = db.Column(db.String(120), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    comments = db.relationship('Comment', backref='author', lazy=True)

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

class Topic(db.Model):
    __tablename__ = 'topics'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    document_path = db.Column(db.String(255), nullable=True)
    created_by_admin_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    comments = db.relationship('Comment', backref='topic', lazy=True)

class Comment(db.Model):
    __tablename__ = 'comments'

    id = db.Column(db.Integer, primary_key=True)
    topic_id = db.Column(db.Integer, db.ForeignKey('topics.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    user_role = db.Column(db.String(20), nullable=False)  # citizen | expert | admin (snapshot at submit time)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Placeholder columns for future ML outputs
    sentiment_label = db.Column(db.String(50), nullable=True)
    sentiment_score = db.Column(db.Float, nullable=True)
