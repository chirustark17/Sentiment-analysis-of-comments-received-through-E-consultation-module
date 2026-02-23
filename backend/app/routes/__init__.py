"""Route registration helper."""
from .health import bp as health_bp
from .auth import bp as auth_bp
from .admin import bp as admin_bp
from .topics import bp as topics_bp
from .comments import bp as comments_bp

__all__ = ['health_bp', 'auth_bp', 'admin_bp', 'topics_bp', 'comments_bp']
