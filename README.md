# MCA E-Consultation Sentiment Analysis Platform

## Project Overview
This project is a full-stack public consultation platform where users submit topic-based comments and admins review analytics produced by sentiment/summary pipelines.

Core flow:
- Users register/login (JWT auth with role-based access)
- Citizens/Experts submit comments on active topics
- Admins run sentiment analysis, summarization, and word cloud generation
- Admin dashboard shows filtered analytics, charting, and paginated comments

This consolidation phase focuses on frontend integration quality:
- Shared authenticated navbar
- Centralized alert/error handling
- Consistent loading and button-lock behavior
- Token-expiration redirect handling

## Architecture (Textual Diagram)
1. Frontend (`frontend/`)
- Static HTML + vanilla JS + Bootstrap UI
- `auth.js` manages authentication state in browser storage
- `api.js` handles all HTTP calls to Flask backend
- `router.js` enforces page access by role
- `admin.js` and `user.js` implement dashboard-specific logic
- `ui.js` provides shared navbar, alerts, and loading helpers

2. Backend (`backend/`) [unchanged]
- Flask API server
- JWT authentication/authorization
- Topic/comment/admin analytics endpoints
- PostgreSQL persistence

3. ML Layer (`ml/`) [unchanged]
- Sentiment analysis logic
- Summarization logic
- Word-cloud frequency generation

4. Data Store
- PostgreSQL for users, topics, comments, and analysis-related records

## Tech Stack
- Frontend: HTML, CSS, JavaScript (Vanilla), Bootstrap 5, Chart.js, wordcloud2.js
- Backend: Python, Flask, Flask-JWT-Extended, Flask-CORS, SQLAlchemy
- Database: PostgreSQL
- ML/NLP: Existing project sentiment + summarization pipeline (unchanged)

## Final Folder Structure
```text
project-root/
|
|- backend/
|  |- (existing Flask app untouched)
|
|- frontend/
|  |- login.html
|  |- register.html
|  |- admin.html
|  |- user.html
|  |
|  |- css/
|  |  |- styles.css
|  |
|  |- js/
|  |  |- auth.js
|  |  |- api.js
|  |  |- router.js
|  |  |- user.js
|  |  |- admin.js
|  |  |- ui.js
|  |  |- utils.js
|  |
|  |- assets/
|     |- .gitkeep
|
|- ml/
|- dashboard/
|- README.md
```

Notes:
- `backend/`, `ml/`, and API contracts are unchanged.
- `utils.js` remains as a shared constants/JWT decode helper module.

## How to Run (Backend)
1. Create and activate virtual environment.
2. Install dependencies from backend requirements.
3. Configure environment variables (see Environment section below).
4. Start Flask server (commonly on `http://127.0.0.1:5000`).

Typical local sequence:
```bash
cd backend
python -m venv .venv
# activate venv
pip install -r requirements.txt
python app.py
```

## How to Run (Frontend)
Option A: Open frontend pages directly in browser (quick local test).
- Open `frontend/login.html`

Option B: Serve frontend via a static file server (recommended for consistent behavior).
```bash
cd frontend
python -m http.server 5500
```
Then open `http://127.0.0.1:5500/login.html`.

## Role Descriptions
- `admin`
  - Access to `admin.html`
  - Can load topics, filter by role, run sentiment analysis, summarization, and word cloud
  - Can view analytics and paginated comments

- `citizen`
  - Access to `user.html`
  - Can view topics and submit comments

- `expert`
  - Access to `user.html`
  - Same frontend workflow as citizen, with expert role identity

## API Summary (Frontend-Used Endpoints)
- Auth:
  - `POST /auth/login`
  - `POST /auth/register`

- Shared:
  - `GET /topics`
  - `POST /comments`

- Admin:
  - `GET /admin/analytics?topic_id=...&role=...`
  - `GET /admin/comments?topic_id=...&page=...&role=...`
  - `POST /admin/analyze-sentiment`
  - `POST /admin/summarize`
  - `GET /admin/wordcloud?topic_id=...&role=...`

## ML Models / Analysis Components Used
- Sentiment analysis pipeline: existing backend/ML implementation (unchanged)
- Summarization pipeline: existing backend/ML implementation (unchanged)
- Word cloud generation: existing backend frequency output rendered in frontend canvas

No model logic was modified during consolidation.

## Security Considerations
- JWT is stored in browser local storage for authenticated API calls.
- Frontend route guards enforce role-based page access (UI-level protection).
- Backend must remain source of truth for authorization checks.
- `401 Unauthorized` responses now trigger:
  - Token/session clear
  - Redirect to `login.html`
  - One-time session-expired message display
- Keep CORS restricted to approved origins in production.

## Known Limitations
- Browser `localStorage` token storage is vulnerable to XSS if frontend becomes unsafe.
- Frontend route guards improve UX but do not replace backend auth validation.
- Error messaging depends on backend JSON error shape (`error`/`message` fields).
- Large word clouds can still be visually dense on smaller screens.

## Deployment Preparation Notes
1. Frontend served by Flask (single deploy) - optional
- Move/copy frontend assets into Flask static/template structure.
- Serve HTML through Flask routes or static files.

2. Backend + Frontend separated (recommended for scale)
- Deploy Flask API independently.
- Deploy frontend via Nginx/static hosting.
- Set `AppUtils.API_BASE_URL` to deployed API URL.

3. Environment Variables
- Keep secrets out of source code.
- Typical variables:
  - `DATABASE_URL`
  - `JWT_SECRET_KEY`
  - `FLASK_ENV` / `APP_ENV`
  - CORS allow-list values

4. JWT Secret Warning
- Never use weak/default JWT secrets in production.
- Rotate secrets securely and keep them in secret managers or protected env config.

5. WSGI Runtime Suggestion
- For production, run Flask with Gunicorn (and optionally Nginx reverse proxy).
- Example:
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## Consolidation Result
Frontend is now more integration-ready with:
- Unified navbar for authenticated dashboards
- Reusable Bootstrap alert system
- Button-lock + spinner loading states
- Centralized 401/session-expiration handling
- Cleaner structure and deployment/run documentation
