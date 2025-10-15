from flask import Flask, jsonify, request, render_template, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///database.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.secret_key = "13c4f3f7e6f6ff70a262eae263c51b8c"

db = SQLAlchemy(app)

# ---------- MODELS ----------

class User(db.Model):
    u_id = db.Column(db.Integer, primary_key=True)
    u_name = db.Column(db.String(200), nullable=False)
    u_email = db.Column(db.String(200), nullable=True)
    u_username = db.Column(db.String(200), unique=True, nullable=False)
    u_password = db.Column(db.String(200), nullable=False)

    security_answers = db.relationship("UserSecurityAnswer", back_populates="user")
    
    def to_dict(self):
        return {
            "u_id": self.u_id,
            "name": self.u_name,
            "email": self.u_email,
            "username": self.u_username
        }
    
class SecurityQuestions(db.Model):
    q_id = db.Column(db.Integer, primary_key=True)
    q_content = db.Column(db.String(200), nullable=False)

    answers = db.relationship("UserSecurityAnswer", back_populates="question")

class UserSecurityAnswer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.u_id"), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey("security_questions.q_id"), nullable=False)
    answer_hash = db.Column(db.String(200), nullable=False)  # store hashed answer for security
    
    user = db.relationship("User", back_populates="security_answers")
    question = db.relationship("SecurityQuestions", back_populates="answers")

# ---------- DB INIT ----------
with app.app_context():
    db.create_all()
    
    def populate_default_questions():
            if SecurityQuestions.query.count() == 0:  # only populate if empty
                default_questions = [
                    "What was the name of your first pet?",
                    "What is your mother's maiden name?",
                    "What was the name of your elementary school?",
                    "What is your favorite food?",
                    "What city were you born in?"
                ]
                for q in default_questions:
                    db.session.add(SecurityQuestions(q_content=q))
                db.session.commit()

    populate_default_questions() 

# ---------- PAGES ----------

@app.route("/")
def root():
    if 'user_id' in session:
        return redirect(url_for('index_page'))
    return render_template("login.html")

@app.route("/login")
def login_page():
    return render_template("login.html")

@app.route("/index")
def index_page():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template("index.html")

@app.route("/settings")
def settings_page():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template("account-settings.html")

# ---------- USER REST API ----------

@app.get("/api/current-user")
def get_current_user():
    """Get currently logged in user"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    return jsonify(user.to_dict()), 200

@app.post("/api/login")
def login_user():
    """Login a user"""
    data = request.get_json(force=True)
    credentials = data.get("credentials", "").strip()
    password = data.get("password", "").strip()
    
    if not credentials or not password:
        return jsonify({"error": "Missing credentials or password"}), 400
    
    user = User.query.filter(
        (User.u_username == credentials) | (User.u_email == credentials)
    ).first()
    
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    if not check_password_hash(user.u_password, password):
        return jsonify({"error": "Incorrect password"}), 401
    
    session['user_id'] = user.u_id
    
    return jsonify({"message": "Login successful", "user": user.to_dict()}), 200

@app.post("/api/user")
def create_user():
    """Create a new user account"""
    data = request.get_json(force=True)
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    name = data.get("name", "").strip()
    
    # Handle email safely
    email_value = data.get("email")
    email = email_value.strip() if email_value else None

    # Handle security question/answer
    sec = data.get("security_answer")
    question_id = sec.get("question_id") if sec else None
    answer_text = sec.get("answer").strip() if sec else None
    
    # Validation
    if not name:
        return jsonify({"error": "Name is required"}), 400
    if not username:
        return jsonify({"error": "Username is required"}), 400
    if not password:
        return jsonify({"error": "Password is required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    if not question_id or not answer_text:
        return jsonify({"error": "Security question and answer are required"}), 400
    
    # Check duplicates
    if User.query.filter_by(u_username=username).first():
        return jsonify({"error": "Username already exists"}), 400
    if email and User.query.filter_by(u_email=email).first():
        return jsonify({"error": "Email already exists"}), 400
    
    # Create user
    u = User(
        u_name=name,
        u_email=email,
        u_username=username,
        u_password=generate_password_hash(password)
    )
    
    db.session.add(u)
    db.session.commit()
    
    # Create security answer record
    sec_answer = UserSecurityAnswer(
        user_id=u.u_id,
        question_id=question_id,
        answer_hash=generate_password_hash(answer_text)
    )
    db.session.add(sec_answer)
    db.session.commit()
    
    session['user_id'] = u.u_id
    
    return jsonify(u.to_dict()), 201

@app.put("/api/user")
def update_user():
    """Update user profile (name and username)"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    data = request.get_json(force=True)
    new_name = data.get("name", "").strip()
    new_username = data.get("username", "").strip()
    
    if not new_name:
        return jsonify({"error": "Name is required"}), 400
    if not new_username:
        return jsonify({"error": "Username is required"}), 400
    
    # Check if username is taken by someone else
    if new_username != user.u_username:
        existing = User.query.filter_by(u_username=new_username).first()
        if existing:
            return jsonify({"error": "Username already taken"}), 400
    
    user.u_name = new_name
    user.u_username = new_username
    db.session.commit()
    
    return jsonify({"message": "Profile updated successfully", "user": user.to_dict()}), 200

@app.put("/api/user/password")
def change_password():
    """Change user password with old password verification"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    data = request.get_json(force=True)
    old_password = data.get("old_password", "").strip()
    new_password = data.get("new_password", "").strip()
    
    if not old_password:
        return jsonify({"error": "Current password is required"}), 400
    if not new_password:
        return jsonify({"error": "New password is required"}), 400
    
    # Verify old password
    if not check_password_hash(user.u_password, old_password):
        return jsonify({"error": "Current password is incorrect"}), 401
    
    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400
    
    user.u_password = generate_password_hash(new_password)
    db.session.commit()
    
    return jsonify({"message": "Password updated successfully"}), 200

@app.delete("/api/user")
def delete_user():
    """Delete user account"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    db.session.delete(user)
    db.session.commit()
    session.pop('user_id', None)
    
    return jsonify({"message": "Account deleted"}), 200

@app.post("/api/logout")
def logout():
    """Logout current user"""
    session.pop('user_id', None)
    return jsonify({"message": "Logged out"}), 200

# --------- FORGOT PASSWORD ----------------
@app.route('/forgotpassword')
def forgot_password():
    return render_template('forgotpassword.html')

@app.get("/api/security-questions")
def get_security_questions():
    """Return all available security questions"""
    questions = SecurityQuestions.query.all()
    return jsonify([{"q_id": q.q_id, "q_content": q.q_content} for q in questions]), 200

@app.post("/api/user/security-answers")
def set_security_answers():
    """Save or update a user's security answers"""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json(force=True)
    answers = data.get("answers")  # expects [{"question_id": 1, "answer": "xxx"}, ...]

    if not answers or not isinstance(answers, list):
        return jsonify({"error": "Invalid answers format"}), 400

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    for ans in answers:
        q_id = ans.get("question_id")
        answer_text = ans.get("answer", "").strip()
        if not q_id or not answer_text:
            continue  # skip invalid entries

        existing = UserSecurityAnswer.query.filter_by(user_id=user_id, question_id=q_id).first()
        hashed = generate_password_hash(answer_text)
        if existing:
            # Update existing answer
            existing.answer_hash = hashed
        else:
            # Add new answer
            new_ans = UserSecurityAnswer(user_id=user_id, question_id=q_id, answer_hash=hashed)
            db.session.add(new_ans)

    db.session.commit()
    return jsonify({"message": "Security answers saved successfully"}), 200

@app.post("/api/user/verify-security-answer")
def verify_security_answer():
    """Verify user's answer to a security question"""
    data = request.get_json(force=True)
    username = data.get("username", "").strip()
    question_id = data.get("question_id")
    answer_text = data.get("answer", "").strip()

    if not username or not question_id or not answer_text:
        return jsonify({"error": "Missing data"}), 400

    user = User.query.filter_by(u_username=username).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    user_answer = UserSecurityAnswer.query.filter_by(user_id=user.u_id, question_id=question_id).first()
    if not user_answer:
        return jsonify({"error": "Answer not found"}), 404

    if check_password_hash(user_answer.answer_hash, answer_text):
        return jsonify({"message": "Answer verified", "user_id": user.u_id}), 200
    else:
        return jsonify({"error": "Incorrect answer"}), 401
    
@app.post("/api/forgotpassword")
def forgotpassword_api():
    """
    Given a username or email, return the user's chosen security question.
    """
    data = request.get_json(force=True)
    username_or_email = data.get("username", "").strip()
    if not username_or_email:
        return jsonify({"success": False, "message": "Username or email is required"}), 400

    # Find the user by username or email
    user = User.query.filter(
        (User.u_username == username_or_email) | (User.u_email == username_or_email)
    ).first()

    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404

    # Get the user's first (or only) security answer
    user_sec = UserSecurityAnswer.query.filter_by(user_id=user.u_id).first()
    if not user_sec:
        return jsonify({"success": False, "message": "No security question set"}), 404

    question = SecurityQuestions.query.get(user_sec.question_id)
    return jsonify({
        "success": True,
        "security_question": question.q_content,
        "question_id": question.q_id
    }), 200

@app.post("/api/reset-password")
def reset_password():
    """Reset a user's password via forgot password flow"""
    data = request.get_json(force=True)
    username = data.get("username", "").strip()
    new_password = data.get("new_password", "").strip()

    if not username or not new_password:
        return jsonify({"error": "Username and new password are required"}), 400

    if len(new_password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    user = User.query.filter_by(u_username=username).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    # Update password
    user.u_password = generate_password_hash(new_password)
    db.session.commit()

    return jsonify({"message": "Password reset successful"}), 200

if __name__ == "__main__":
    app.run(debug=True)
