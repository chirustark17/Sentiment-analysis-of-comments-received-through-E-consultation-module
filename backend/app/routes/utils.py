"""Route helper utilities."""
from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from ..models import User

ROLE_VALUES = {'admin', 'citizen', 'expert'}

def validate_role(role: str) -> bool:
    return role in ROLE_VALUES

def admin_required(view_func):
    """Allow access only to JWT-authenticated admin users."""
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        verify_jwt_in_request()

        user_id = get_jwt_identity()

        # Identity must be string (stored as str(user.id))
        if not isinstance(user_id, str):
            return jsonify({'error': 'Invalid token identity'}), 401

        try:
            user_id = int(user_id)
        except ValueError:
            return jsonify({'error': 'Invalid token identity'}), 401

        user = User.query.get(user_id)

        if not user or user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        return view_func(*args, **kwargs)

    return wrapped
