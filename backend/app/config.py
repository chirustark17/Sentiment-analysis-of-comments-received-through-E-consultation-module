"""Application configuration."""
import os
from dotenv import load_dotenv

# Load .env from the backend folder (works regardless of current working directory)
_BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
load_dotenv(os.path.join(_BASE_DIR, ".env"))

class Config:
    """Base configuration shared across environments."""
    SECRET_KEY = os.getenv('SECRET_KEY')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', os.path.join(_BASE_DIR, 'uploads'))

    @classmethod
    def validate(cls) -> None:
        """Fail fast when required runtime configuration is missing."""
        missing = []
        if not cls.SECRET_KEY:
            missing.append('SECRET_KEY')
        if not cls.JWT_SECRET_KEY:
            missing.append('JWT_SECRET_KEY')
        if not cls.SQLALCHEMY_DATABASE_URI:
            missing.append('DATABASE_URL')

        if missing:
            joined = ', '.join(missing)
            raise RuntimeError(f'Missing required environment variables: {joined}')
