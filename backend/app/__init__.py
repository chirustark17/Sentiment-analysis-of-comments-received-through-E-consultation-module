"""Flask application factory."""
import os
from flask import Flask
from .config import Config
from .extensions import db, jwt, cors
from .ml import load_models_once
from .routes import health_bp, auth_bp, admin_bp, topics_bp, comments_bp


def create_app() -> Flask:
    Config.validate()

    app = Flask(__name__)
    app.config.from_object(Config)
    # Allow browser requests only from the frontend dev origin.
    # This enables cross-origin calls from http://localhost:5500 to this API.
    cors.init_app(app, resources={r"/*": {"origins": [
    "http://localhost:5500",
    "http://127.0.0.1:5500"
]}})

    # Ensure upload directory exists at startup.
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Initialize extensions
    db.init_app(app)
    jwt.init_app(app)

    # Load ML models once at startup and keep them in Flask extensions for reuse.
    app.extensions['ml_models'] = load_models_once()
    app.logger.info(
        'ML models loaded: sentiment=%s, summarization=%s',
        app.extensions['ml_models'].sentiment_model_name,
        app.extensions['ml_models'].summarization_model_name,
    )

    # Register routes
    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(topics_bp)
    app.register_blueprint(comments_bp)

    return app
