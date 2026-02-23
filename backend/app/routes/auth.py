"""Authentication routes (register/login)."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from .utils import validate_role
from ..extensions import db
from ..models import User

bp = Blueprint('auth', __name__, url_prefix='/auth')

@bp.post('/register')
def register():
    data = request.get_json() or {}

    full_name = data.get('full_name')
    email = data.get('email')
    password = data.get('password')
    role = data.get('role')
    professional_id = data.get('professional_id')

    if not full_name or not email or not password or not role:
        return jsonify({'error': 'full_name, email, password, and role are required'}), 400

    if not validate_role(role):
        return jsonify({'error': 'Invalid role. Use admin, citizen, or expert.'}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    user = User(
        full_name=full_name,
        email=email,
        role=role,
        professional_id=professional_id if role == 'expert' else None
    )
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

    return jsonify({'message': 'User registered successfully'}), 201

@bp.post('/login')
def login():
    data = request.get_json() or {}

    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({'error': 'email and password are required'}), 400

    user = User.query.filter_by(email=email).first()

    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid credentials'}), 401

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={'role': user.role}
    )
    return jsonify({
        'access_token': access_token,
        'role': user.role
    }), 200
