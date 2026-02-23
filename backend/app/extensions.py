"""Shared Flask extensions."""
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_sqlalchemy import SQLAlchemy

# Initialize extensions without app (app factory pattern)

# Database ORM
_db = SQLAlchemy()

# JWT manager
_jwt = JWTManager()

# CORS handler
_cors = CORS()

# Expose as named singletons

db = _db
jwt = _jwt
cors = _cors
