### `Developed & Engineered by Stark (Chirag K S)`  
`Built with precision & passion. Driven by purpose.`
# MCA E-Consultation Sentiment Analysis Platform

A full-stack public consultation system for collecting topic-wise citizen/expert feedback and generating admin-facing sentiment analytics, summaries, and word-frequency insights.

## Executive Summary

Public consultation processes generate large volumes of free-text feedback that are difficult to analyze manually at scale.  
This project addresses that problem by combining role-based comment collection with automated NLP analysis and an operational admin dashboard.

Why it matters in public governance:
- Enables faster evidence review of citizen and expert responses.
- Improves transparency through measurable sentiment distributions.
- Supports administrative reporting with structured exports and generated summaries.

What the system achieves:
- Collects topic-bound comments from authenticated users.
- Classifies comment sentiment (Positive/Neutral/Negative).
- Produces aggregate analytics, summary text, and word frequency outputs.
- Supports export workflows for downstream reporting and archival.

## System Architecture

### Frontend Layer (`frontend/`)
- HTML + Bootstrap 5 UI pages (`login`, `register`, `user`, `admin-control`, `admin-create-topic`, `admin`).
- Vanilla JavaScript modularized into:
- `auth.js` for auth/session handling
- `router.js` for role-based page guards
- `api.js` for centralized API requests
- `ui.js` for shared navbar, alerts, loading states, and unauthorized redirect flow
- `admin.js` / `user.js` for dashboard-specific actions
- `charts.js`, `report.js`, `export.js` for visualization/report/export utilities

### Backend Layer (`backend/`)
- Flask app factory pattern with blueprints.
- JWT authentication (`Flask-JWT-Extended`).
- ORM models with SQLAlchemy.
- Admin-only protected routes for analytics and NLP operations.
- CORS configured for local frontend origins (`localhost:5500`, `127.0.0.1:5500`).

### ML/NLP Layer (`backend/app/ml`, `backend/app/nlp`)
- Startup model loading (once per process):
- Sentiment: `distilbert-base-uncased-finetuned-sst-2-english`
- Summarization: `t5-small`
- Shared preprocessing pipeline:
- lowercasing
- URL removal
- special-character filtering (`[^a-z0-9\s]`)
- whitespace normalization

### Database Layer (PostgreSQL)
- Stores users, topics, and comments.
- Persists sentiment labels/scores inside comments after analysis.
- Supports topic-comment-user relational flow for analytics.

### Text-Based Architecture Diagram

```text
[Citizen/Expert/Admin Browser]
           |
           v
[Frontend Pages + JS Modules]
           |
           |  HTTP (JWT Bearer)
           v
[Flask API Blueprints]
  auth / topics / comments / admin
           |
           +--> [NLP Preprocessing]
           |         |
           |         +--> [HF Sentiment Pipeline]
           |         +--> [HF Summarization Pipeline]
           |         +--> [Word Frequency Extraction]
           |
           v
      [PostgreSQL]
```

### Data Flow (High Level)
1. User authenticates via `/auth/login` and receives JWT.
2. Citizen/Expert loads topics and submits comments (`/comments`).
3. Admin selects topic/filter and runs analysis endpoints.
4. Backend preprocesses comment text, executes model pipeline, stores sentiment output.
5. Admin dashboard fetches analytics/comments/summary/word frequencies.
6. Frontend renders chart, summary panel, word cloud, and export files (CSV/JSON).

## Complete Feature Breakdown

### A) Authentication & Role Management
- JWT-based registration/login.
- Roles supported in backend: `admin`, `citizen`, `expert`.
- Frontend route guards:
- Admin pages restricted to admin sessions.
- User page restricted to non-admin authenticated sessions.
- Unauthorized responses (`401`) trigger session clear + redirect to login.

### B) Topic Management
- Admin can create topics via `POST /admin/topics`.
- Topic fields include title and description.
- Optional document upload supported at API level (PDF/DOC/DOCX, multipart).
- All authenticated users can list topics through `GET /topics`.
- Comments are associated to specific topic IDs.

### C) Comment Submission
- Citizen and Expert users submit comments via `POST /comments`.
- Backend validates:
- topic existence
- non-empty content
- role restriction (`citizen` or `expert`)
- `user_role` is saved with the comment as a snapshot.

### D) Sentiment Analysis Engine
- Trigger: Admin action via `POST /admin/analyze-sentiment`.
- Pipeline:
- batch preprocess comments
- run HF sentiment classifier
- map output to `Positive/Neutral/Negative`
- persist label + confidence score
- Neutral is derived by confidence threshold (`score < 0.60`).

### E) Text Summarization
- Trigger: Admin action via `POST /admin/summarize`.
- Input: preprocessed concatenated comments for selected topic/filter.
- Input length capped to 8000 chars for stability.
- Model: `t5-small` summarization pipeline.
- Output returned in response (not persisted to DB).

### F) Word Cloud Generation
- Trigger: Admin action via `GET /admin/wordcloud`.
- Backend preprocesses text and extracts frequencies via `wordcloud` tokenizer logic.
- Top 100 terms returned as `{text, value}` pairs.
- Frontend renders via `wordcloud2.js` canvas.

### G) Analytics Dashboard
- Sentiment distribution visualization via Chart.js doughnut chart.
- Role filter support (`citizen` / `expert` / all).
- Paginated comment view (10 per page) from backend.
- KPI counters:
- total comments
- analyzed comments
- pending analysis
- positive/neutral/negative counts
- Summary panel and word cloud panel integrated.

### H) CSV Export
- Frontend supports exporting loaded comment data to CSV.
- CSV includes (minimum requested):
- Comment (`comment_text`)
- Role (`user_type`)
- Sentiment label (`sentiment_label`)
- Also includes `comment_id` and `timestamp`.
- Purpose:
- offline analysis
- submission/reporting workflows
- audit-friendly data sharing

## Machine Learning Pipeline (Detailed)

### 1) Text Preprocessing
Implemented in `backend/app/nlp/preprocessing.py`:
- Convert text to lowercase.
- Remove URLs (`http/https/www` patterns).
- Remove non-alphanumeric special symbols (except spaces).
- Collapse multiple spaces/newlines to single-space tokens.
- Apply same preprocessing for sentiment, summarization, and word-frequency endpoints.

### 2) Sentiment Classification Flow
1. Fetch topic-filtered comments from DB.
2. Preprocess batch text.
3. Replace empty processed text with placeholder (`"no content"`).
4. Run HF sentiment pipeline in batches (`batch_size=16`).
5. Map labels:
- `POSITIVE`/`LABEL_1` -> Positive
- `NEGATIVE`/`LABEL_0` -> Negative
- Low-confidence (`<0.60`) or unknown labels -> Neutral
6. Persist `sentiment_label` and `sentiment_score` to each comment row.

### 3) Summary Generation Flow
1. Fetch topic-filtered comments.
2. Preprocess and remove empty outputs.
3. Concatenate into one source string.
4. Truncate to 8000 chars.
5. Run summarization pipeline with fixed decoding params (`max_length=130`, `min_length=30`, `do_sample=False`).
6. Return summary text in API response.

### 4) Word Frequency Extraction Flow
1. Fetch topic-filtered comments.
2. Preprocess and combine text.
3. Use `WordCloud(stopwords=STOPWORDS, collocations=False).process_text(...)`.
4. Sort by frequency descending.
5. Return top 100 words for frontend rendering.

### 5) ML + DB Integration
- Sentiment endpoint writes labels/scores into `comments` table.
- Analytics endpoint reads persisted labels to compute counts.
- Summary and word cloud endpoints are computed on-demand and returned directly (no persistence).

### 6) API-to-ML Data Flow
```text
/admin/analyze-sentiment -> DB read -> preprocess -> sentiment model -> DB write -> analytics ready
/admin/summarize         -> DB read -> preprocess -> summarization model -> response summary
/admin/wordcloud         -> DB read -> preprocess -> frequency extraction -> response frequencies
```

## Algorithms & Techniques Used

### Sentiment Classification Technique
- Transformer-based sequence classification using pretrained DistilBERT SST-2 model.
- Post-processing rule introduces Neutral class using confidence threshold logic.

### Text Preprocessing Technique
- Rule-based normalization via regex cleaning:
- URL stripping
- special character removal
- lowercase conversion
- whitespace normalization

### Word Cloud Technique
- Frequency-based token counting using `wordcloud` library text processor.
- Stopword filtering and non-collocated term extraction.
- Top-N truncation for frontend rendering efficiency.

### Summarization Technique
- Transformer seq2seq summarization (`t5-small`) with deterministic decoding settings (`do_sample=False`).

## API Endpoint Documentation

| Method | Endpoint | Purpose | Role Required |
|---|---|---|---|
| GET | `/health` | Health check | Public |
| POST | `/auth/register` | Register user account | Public |
| POST | `/auth/login` | Authenticate and issue JWT | Public |
| GET | `/topics` | List consultation topics | Authenticated |
| GET | `/uploads/<filename>` | Download/view uploaded topic file | Authenticated |
| POST | `/comments` | Submit comment for a topic | Citizen or Expert |
| POST | `/admin/topics` | Create topic (+ optional document) | Admin |
| GET | `/admin/comments` | Get paginated topic comments | Admin |
| POST | `/admin/analyze-sentiment` | Analyze and persist sentiment labels | Admin |
| GET | `/admin/analytics` | Get sentiment analytics counts | Admin |
| POST | `/admin/summarize` | Generate text summary | Admin |
| GET | `/admin/wordcloud` | Get word frequencies for cloud | Admin |

## Database Design Overview

### `users`
- `id` (PK)
- `full_name`
- `email` (unique)
- `password_hash`
- `role` (`admin`, `citizen`, `expert`)
- `professional_id` (optional)
- `created_at`

### `topics`
- `id` (PK)
- `title`
- `description`
- `document_path` (optional)
- `created_by_admin_id` (FK -> `users.id`)
- `created_at`

### `comments`
- `id` (PK)
- `topic_id` (FK -> `topics.id`)
- `user_id` (FK -> `users.id`)
- `user_role` (role snapshot at submission)
- `content`
- `created_at`
- `sentiment_label` (nullable, set after analysis)
- `sentiment_score` (nullable)

### Relationships
- One user -> many comments.
- One topic -> many comments.
- One admin user -> many created topics (via `created_by_admin_id`).

## Folder Structure (Updated)

```text
Project/
|- backend/
|  |- run.py
|  |- requirements.txt
|  |- .env.example
|  \- app/
|     |- __init__.py
|     |- config.py
|     |- extensions.py
|     |- models.py
|     |- ml/
|     |  \- model_loader.py
|     |- nlp/
|     |  \- preprocessing.py
|     \- routes/
|        |- auth.py
|        |- comments.py
|        |- topics.py
|        |- admin.py
|        \- health.py
|- frontend/
|  |- login.html
|  |- register.html
|  |- user.html
|  |- admin-control.html
|  |- admin-create-topic.html
|  |- admin.html
|  |- css/
|  |  \- styles.css
|  \- js/
|     |- utils.js
|     |- ui.js
|     |- auth.js
|     |- api.js
|     |- router.js
|     |- user.js
|     |- admin.js
|     |- adminTopic.js
|     |- charts.js
|     |- report.js
|     \- export.js
|- dashboard/            # legacy/alternate dashboard prototype
|- ml/                   # placeholder directory in current repo
\- README.md
```

## Installation & Setup

### A) Backend Setup
```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
```

### B) Environment Variables
Create `backend/.env` from `backend/.env.example`:

```env
FLASK_ENV=development
FLASK_DEBUG=1
FLASK_APP=run.py
SECRET_KEY=your_secret_key
JWT_SECRET_KEY=your_jwt_secret
DATABASE_URL=postgresql+psycopg2://username:password@localhost:5432/mca_consultation
```

### C) Database Setup
- Ensure PostgreSQL is running.
- Create the target database referenced in `DATABASE_URL`.
- This repository does not include Alembic migrations; schema creation must be done from current SQLAlchemy models in app context.

Example one-time initialization:
```bash
cd backend
python -c "from app import create_app; from app.extensions import db; app=create_app(); app.app_context().push(); db.create_all(); print('tables created')"
```

### D) Run Backend Server
```bash
cd backend
python run.py
```
Default local API: `http://127.0.0.1:5000`

### E) Frontend Setup
Option 1 (recommended):
```bash
cd frontend
python -m http.server 5500
```
Open:
- `http://127.0.0.1:5500/login.html`

Option 2:
- Open frontend HTML files directly in browser (less consistent than static server mode).

## Security Design

- JWT tokens are required for protected API calls.
- Backend authorization is enforced at route level (`@jwt_required` and `@admin_required`).
- Admin protection validates admin role against DB user record.
- Frontend route guards improve UX but are not a backend security substitute.
- Centralized `401` handling:
- clear local session
- redirect to login
- show one-time "session expired" message
- Backend validation includes required-field checks, type checks, role checks, and topic/user existence checks.

## Deployment Strategy

### Local Development
- Run Flask API on port `5000`.
- Serve frontend on static host (e.g., `5500`).
- Keep CORS aligned to active frontend origin.

### Production Recommendation
- Run Flask app with Gunicorn:
```bash
gunicorn -w 4 -b 0.0.0.0:5000 run:app
```
- Place reverse proxy (e.g., Nginx) in front for TLS, routing, and static handling.

### Reverse Proxy Concept
- Route `/api/*` to Flask service.
- Serve frontend static assets from web server/CDN.
- Restrict allowed origins and secure secrets via environment management.

### Frontend Serving Models
- Separated deployment:
- frontend static host + backend API service
- Integrated deployment:
- serve frontend from Flask static/template pipeline (optional refactor path)

## Recent Improvements & Consolidation Phase

The current codebase consolidation added:
- Shared authenticated navbar across admin/user pages.
- Centralized alert and error handling utilities.
- Reusable loading/button-lock states with spinner UX.
- Unified token-expiration (`401`) redirect mechanism.
- Admin Control Panel + dedicated Admin Topic Creation page.
- Client-side CSV/JSON export from dashboard comment data.
- Official PDF report generation utility from loaded analytics.

## Known Limitations

- `localStorage` token storage has XSS exposure risk if frontend is compromised.
- CORS origins are currently hardcoded for local development.
- Sentiment Neutral label is heuristic (confidence-threshold derived).
- Summaries are generated on-demand and not persisted.
- CSV/JSON export is based on currently loaded dashboard comments (paginated view context).
- No migration framework included in repository at this stage.
- Model loading occurs at backend startup and can increase cold-start latency.

## Future Enhancements

- Add migration/versioning workflow (Alembic) for reliable schema evolution.
- Move JWT storage to more secure cookie/session strategy with CSRF controls.
- Add audit logging for admin analysis actions and exports.
- Support full-dataset export endpoint (not only current page state).
- Add automated tests for route authorization, NLP endpoints, and frontend integration.
- Introduce asynchronous processing queue for heavy NLP tasks at scale.

## Conclusion

This project demonstrates an end-to-end consultation analytics workflow: secure role-based participation, structured topic/comment management, transformer-backed sentiment and summarization, and actionable admin visualization/export tooling.  
It is suitable as a portfolio-grade full-stack NLP application and as a foundation for research-oriented e-governance analytics extensions.
