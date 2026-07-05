import os
import json
import logging
from datetime import datetime
from flask import Flask, render_template, request, jsonify, make_response, session, redirect, url_for
from functools import wraps
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
import google.generativeai as genai

# Load environment variables from .env
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

# Flask App
app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['JSON_SORT_KEYS'] = False
app.secret_key = os.getenv("SECRET_KEY", "eduassist-secret-98765-xyz")

# ─── SQLite Database Setup ─────────────────────────────────────────────────────
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
if os.getenv('TESTING') == 'true':
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
else:
    db_url = os.getenv('DATABASE_URL')
    if db_url:
        # SQLAlchemy 1.4+ requires 'postgresql://' instead of 'postgres://'
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        app.config['SQLALCHEMY_DATABASE_URI'] = db_url
    else:
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(BASE_DIR, 'eduassist.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)

# ─── Database Models ───────────────────────────────────────────────────────────

class User(db.Model):
    __tablename__ = 'users'
    id            = db.Column(db.Integer, primary_key=True)
    username      = db.Column(db.String(80), unique=True, nullable=False)
    email         = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    created_at    = db.Column(db.DateTime, default=datetime.utcnow)

    assignments   = db.relationship('Assignment', backref='user', lazy=True, cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = bcrypt.generate_password_hash(password).decode('utf-8')

    def check_password(self, password):
        return bcrypt.check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.username}>'


class Assignment(db.Model):
    __tablename__ = 'assignments'
    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    subject    = db.Column(db.String(120), nullable=False)
    topic      = db.Column(db.String(200), nullable=False)
    question   = db.Column(db.Text, nullable=False)
    guide_json = db.Column(db.Text, nullable=False)   # JSON-serialised AI response
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Assignment {self.id} – {self.topic}>'


# ─── Initialize Database Tables & Developer Seed ───────────────────────────────
with app.app_context():
    try:
        db.create_all()
        logger.info("✅ Database tables created / verified.")
        
        # Seed default developer credentials if not present
        default_user = User.query.filter_by(username="Kumar").first()
        if not default_user:
            user = User(username="Kumar", email="kumar@eduassist.com")
            user.set_password("Kumar1234")
            db.session.add(user)
            db.session.commit()
            logger.info("👤 Default developer user 'Kumar' created successfully.")
    except Exception as e:
        logger.error(f"❌ Failed to initialize database: {e}")


# ─── Gemini API Setup ──────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    logger.info("✅ Gemini API configured successfully.")
else:
    logger.warning("⚠️  GEMINI_API_KEY is not set. Add it to your .env file.")

# ─── Structured JSON Schema ────────────────────────────────────────────────────
ASSIGNMENT_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "concept_explanation": {
            "type": "STRING",
            "description": (
                "Explain the topic in clear, simple language for an engineering student. "
                "Use markdown: headings, bold, bullet points where helpful. "
                "Cover: what it is, why it matters, and real-world relevance."
            )
        },
        "learning_objectives": {
            "type": "ARRAY",
            "items": {"type": "STRING"},
            "description": (
                "5-7 specific, measurable learning objectives the student will achieve. "
                "Start each with an action verb: Understand, Apply, Analyze, Implement, Compare, etc."
            )
        },
        "step_by_step_explanation": {
            "type": "STRING",
            "description": (
                "Break the solution into clear numbered steps using markdown. "
                "Explain the WHY behind each step. Use subheadings, examples inline, "
                "and diagrams described in text if needed."
            )
        },
        "simple_example": {
            "type": "STRING",
            "description": (
                "A beginner-friendly real-world analogy or worked example "
                "that makes the concept click. Use markdown for clarity."
            )
        },
        "assignment_solution": {
            "type": "STRING",
            "description": (
                "A complete, well-structured academic answer for submission. "
                "Should be comprehensive, properly formatted in markdown, and reference "
                "the concepts explained above. Suitable for university-level marks."
            )
        },
        "code_example": {
            "type": "OBJECT",
            "properties": {
                "language": {
                    "type": "STRING",
                    "description": "Programming language name (e.g., Python, Java, C++) or 'N/A' if not applicable."
                },
                "explanation": {
                    "type": "STRING",
                    "description": "Explain what the code does and the logic behind it before showing it. Use markdown."
                },
                "code": {
                    "type": "STRING",
                    "description": (
                        "Clean, well-commented code snippet. Raw code only — no markdown fences/backticks. "
                        "Include meaningful comments explaining each section."
                    )
                }
            },
            "required": ["language", "explanation", "code"],
            "description": "Code example for programming-related topics. Set language='N/A' and empty strings for theoretical questions."
        },
        "complexity_analysis": {
            "type": "OBJECT",
            "properties": {
                "time_complexity":  {"type": "STRING", "description": "Big-O time complexity (e.g., O(log n)) or 'N/A'."},
                "space_complexity": {"type": "STRING", "description": "Big-O space complexity (e.g., O(1)) or 'N/A'."},
                "explanation":      {"type": "STRING", "description": "Explain why these complexities hold. Use markdown. Write 'N/A' if not applicable."}
            },
            "required": ["time_complexity", "space_complexity", "explanation"],
            "description": "Complexity analysis for algorithm/code questions. Use N/A for theoretical topics."
        },
        "important_key_points": {
            "type": "ARRAY",
            "items": {"type": "STRING"},
            "description": "6-8 essential concepts, facts, or rules the student must remember for exams."
        },
        "viva_questions": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "question": {"type": "STRING"},
                    "answer":   {"type": "STRING"}
                },
                "required": ["question", "answer"]
            },
            "description": "5 likely viva/oral exam questions with concise, accurate answers."
        },
        "practice_questions": {
            "type": "ARRAY",
            "items": {"type": "STRING"},
            "description": "4 similar practice questions at varying difficulty. Do NOT provide answers."
        },
        "interview_questions": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "question": {"type": "STRING"},
                    "answer":   {"type": "STRING"}
                },
                "required": ["question", "answer"]
            },
            "description": "3 beginner-to-intermediate interview questions on this topic with clear answers."
        },
        "short_summary": {
            "type": "STRING",
            "description": (
                "A concise 150-200 word revision summary of the entire topic. "
                "Capture all key concepts in markdown bullet points. "
                "End with a one-line takeaway the student can memorize."
            )
        }
    },
    "required": [
        "concept_explanation", "learning_objectives", "step_by_step_explanation",
        "simple_example", "assignment_solution", "code_example",
        "complexity_analysis", "important_key_points", "viva_questions",
        "practice_questions", "interview_questions", "short_summary"
    ]
}

# ─── System Instruction ────────────────────────────────────────────────────────
SYSTEM_INSTRUCTION = """You are Prof. Gemini — an experienced, enthusiastic college professor and teaching assistant specializing in Computer Science and Engineering.

Your Core Mission:
- Help students LEARN and UNDERSTAND, not just get answers
- Always explain the WHY behind concepts before showing solutions
- Use clear, student-friendly language appropriate for engineering undergraduates
- Encourage critical thinking and deep understanding

Your Teaching Style:
- Start with the big picture, then zoom into details
- Use analogies and real-world examples to simplify complex topics
- Structure explanations logically: concept → example → solution
- Be encouraging and supportive in tone

Output Requirements:
- Generate all responses strictly matching the structured JSON schema provided
- Use proper markdown formatting (headers, bold, lists, code blocks) in all string fields
- Make code examples complete, well-commented, and runnable
- Ensure all answers are academically appropriate and thorough
- For purely theoretical questions, set code_example.language to 'N/A'
"""

# ─── Helper: add CORS headers ──────────────────────────────────────────────────
def add_cors(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response

# ─── Auth Gating Decorator ─────────────────────────────────────────────────────
def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('logged_in'):
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# ─── Routes ───────────────────────────────────────────────────────────────────
@app.route('/')
def home():
    """Redirect based on session status."""
    if session.get('logged_in'):
        return redirect(url_for('form_page'))
    return redirect(url_for('login'))


@app.route('/register', methods=['GET', 'POST'])
def register():
    """Handle user registration."""
    if session.get('logged_in'):
        return redirect(url_for('form_page'))

    if request.method == 'POST':
        try:
            data = request.get_json(force=True, silent=True) or {}
        except Exception:
            data = {}

        username = str(data.get('username', '')).strip()
        email    = str(data.get('email', '')).strip().lower()
        password = str(data.get('password', '')).strip()
        confirm  = str(data.get('confirm_password', '')).strip()

        # Validation
        if not username or not email or not password or not confirm:
            return jsonify({"error": "All fields are required."}), 400
        if len(username) < 3:
            return jsonify({"error": "Username must be at least 3 characters."}), 400
        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters."}), 400
        if password != confirm:
            return jsonify({"error": "Passwords do not match."}), 400
        if User.query.filter_by(username=username).first():
            return jsonify({"error": "Username already taken. Please choose another."}), 409
        if User.query.filter_by(email=email).first():
            return jsonify({"error": "An account with this email already exists."}), 409

        # Create user
        user = User(username=username, email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
        logger.info(f"✅ New user registered: {username}")

        return jsonify({"status": "success", "redirect": url_for('login')}), 201

    return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    """Handle user login."""
    if session.get('logged_in'):
        return redirect(url_for('form_page'))

    if request.method == 'POST':
        try:
            data = request.get_json(force=True, silent=True) or {}
        except Exception:
            data = {}

        username = str(data.get('username', '')).strip()
        password = str(data.get('password', '')).strip()

        if not username or not password:
            return jsonify({"error": "Please enter both username and password."}), 400

        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            session['logged_in'] = True
            session['username']  = user.username
            session['user_id']   = user.id
            logger.info(f"✅ User logged in: {username}")
            return jsonify({"status": "success", "redirect": url_for('form_page')})
        else:
            return jsonify({"error": "Incorrect username or password. Please try again."}), 401

    return render_template('login.html')


@app.route('/form')
@require_auth
def form_page():
    """Render the Assignment Input Details page."""
    return render_template('form.html', username=session.get('username', ''))


@app.route('/guide')
@require_auth
def guide_page():
    """Render the full-width Assignment Answer Guide page."""
    return render_template('guide.html', username=session.get('username', ''))


@app.route('/history')
@require_auth
def history_page():
    """Render the Assignment History page."""
    user_id = session.get('user_id')
    assignments = Assignment.query.filter_by(user_id=user_id).order_by(Assignment.created_at.desc()).all()
    return render_template('history.html', assignments=assignments, username=session.get('username', ''))


@app.route('/history/<int:assignment_id>', methods=['GET'])
@require_auth
def get_assignment(assignment_id):
    """Return a stored assignment guide as JSON."""
    user_id = session.get('user_id')
    record = Assignment.query.filter_by(id=assignment_id, user_id=user_id).first()
    if not record:
        return jsonify({"error": "Assignment not found."}), 404
    return jsonify({
        "guide":    json.loads(record.guide_json),
        "subject":  record.subject,
        "topic":    record.topic,
        "question": record.question
    })


@app.route('/history/<int:assignment_id>', methods=['DELETE'])
@require_auth
def delete_assignment(assignment_id):
    """Delete a stored assignment."""
    user_id = session.get('user_id')
    record = Assignment.query.filter_by(id=assignment_id, user_id=user_id).first()
    if not record:
        return jsonify({"error": "Assignment not found."}), 404
    db.session.delete(record)
    db.session.commit()
    logger.info(f"🗑️  Assignment {assignment_id} deleted by user {user_id}")
    return jsonify({"status": "deleted"})


@app.route('/logout')
def logout():
    """Log out the user."""
    session.clear()
    return redirect(url_for('login'))


@app.route('/health')
def health():
    """Health check endpoint."""
    api_configured = bool(os.getenv("GEMINI_API_KEY", "").strip())
    return jsonify({
        "status": "ok",
        "api_configured": api_configured,
        "model": "gemini-2.5-flash",
        "database": "sqlite"
    })


@app.route('/generate', methods=['POST', 'OPTIONS'])
@require_auth
def generate():
    """Main generation endpoint — accepts assignment details and returns structured guide."""

    # Handle CORS preflight
    if request.method == 'OPTIONS':
        resp = make_response('', 204)
        return add_cors(resp)

    # ── 1. Validate API Key ──
    current_api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not current_api_key:
        logger.error("API key not configured.")
        return jsonify({
            "error": "⚠️ Gemini API key is not configured. Please add GEMINI_API_KEY to your .env file and restart the server."
        }), 500

    # Re-configure if key was added after startup
    global GEMINI_API_KEY
    if current_api_key != GEMINI_API_KEY:
        GEMINI_API_KEY = current_api_key
        genai.configure(api_key=GEMINI_API_KEY)
        logger.info("Gemini API key updated and reconfigured.")

    # ── 2. Parse & Validate Input ──
    try:
        data = request.get_json(force=True, silent=True) or {}
    except Exception:
        data = {}

    subject  = str(data.get('subject',  '')).strip()
    topic    = str(data.get('topic',    '')).strip()
    question = str(data.get('question', '')).strip()

    if not subject:
        return jsonify({"error": "Subject is required. Please select or enter a subject."}), 400
    if not topic:
        return jsonify({"error": "Topic is required. Please enter the assignment topic."}), 400
    if not question:
        return jsonify({"error": "Assignment question is required. Please enter your question."}), 400
    if len(question) < 10:
        return jsonify({"error": "Assignment question is too short. Please provide more detail."}), 400
    if len(question) > 5000:
        return jsonify({"error": "Assignment question is too long (max 5000 characters)."}), 400

    # ── 3. Build Prompt ──
    prompt = (
        f"Subject: {subject}\n"
        f"Topic: {topic}\n\n"
        f"Assignment Question:\n{question}\n\n"
        "Please generate a complete, high-quality learning guide for this assignment. "
        "Follow the structured schema exactly and ensure every field is detailed and helpful."
    )

    # ── 4. Call Gemini API ──
    try:
        logger.info(f"Generating guide — Subject: {subject} | Topic: {topic}")

        model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            system_instruction=SYSTEM_INSTRUCTION,
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": ASSIGNMENT_SCHEMA,
                "temperature": 0.7,
                "top_p": 0.95,
                "max_output_tokens": 8192
            }
        )

        response = model.generate_content(prompt)

        if not response or not response.text:
            logger.error("Empty response received from Gemini.")
            return jsonify({"error": "The AI returned an empty response. Please try again."}), 500

        # Parse JSON
        guide_data = json.loads(response.text)
        logger.info(f"✅ Guide generated successfully for topic: {topic}")

        # ── 5. Save to Database ──
        try:
            user_id = session.get('user_id')
            if user_id:
                record = Assignment(
                    user_id    = user_id,
                    subject    = subject,
                    topic      = topic,
                    question   = question,
                    guide_json = json.dumps(guide_data)
                )
                db.session.add(record)
                db.session.commit()
                logger.info(f"💾 Assignment saved to DB (id={record.id})")
        except Exception as db_err:
            logger.warning(f"⚠️ Failed to save assignment to DB: {db_err}")
            # Don't fail the request if DB save fails — still return the guide

        return add_cors(make_response(jsonify(guide_data), 200))

    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}")
        return jsonify({"error": "Failed to parse AI response. Please try again."}), 500
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Gemini API error: {error_msg}")

        if "API_KEY_INVALID" in error_msg or "invalid" in error_msg.lower():
            return jsonify({"error": "❌ Invalid API key. Please check your GEMINI_API_KEY in the .env file."}), 500
        elif "quota" in error_msg.lower() or "429" in error_msg:
            return jsonify({"error": "⚠️ API quota exceeded. Please wait a moment and try again."}), 429
        elif "timeout" in error_msg.lower():
            return jsonify({"error": "⏱️ Request timed out. Please try again."}), 504
        else:
            return jsonify({"error": f"AI service error: {error_msg[:200]}. Please try again."}), 500


# ─── Run ───────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    port  = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_ENV", "development") == "development"
    logger.info(f"🚀 EduAssist AI starting on http://0.0.0.0:{port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
