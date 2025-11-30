from flask import Flask, jsonify, request, render_template, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime


app = Flask(__name__)
@app.after_request
def add_header(response):
    response.cache_control.no_store = True
    response.cache_control.no_cache = True
    response.cache_control.must_revalidate = True
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

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
    answer_hash = db.Column(db.String(200), nullable=False)
    
    user = db.relationship("User", back_populates="security_answers")
    question = db.relationship("SecurityQuestions", back_populates="answers")

class CollaborativeList(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("user.u_id"), nullable=False)
    member_ids = db.Column(db.JSON, default=list)  # Store member user IDs as JSON array
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    owner = db.relationship("User", backref="owned_lists")
    tasks = db.relationship("CollaborativeTask", back_populates="list", cascade="all, delete-orphan")

class CollaborativeTask(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    list_id = db.Column(db.Integer, db.ForeignKey("collaborative_list.id"), nullable=False)
    text = db.Column(db.String(300), nullable=False)
    date = db.Column(db.String(40))
    checked = db.Column(db.Boolean, default=False)
    priority = db.Column(db.String(10), default="Mid")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    list = db.relationship("CollaborativeList", back_populates="tasks")
    
    def to_dict(self):
        return {
            "id": self.id,
            "text": self.text,
            "date": self.date or "",
            "checked": self.checked,
            "priority": self.priority or "Mid",
            "list_id": self.list_id,
            "createdAt": int(self.created_at.timestamp() * 1000),
        }

# ---------- DB INIT ----------
with app.app_context():
    db.create_all()
    
    if SecurityQuestions.query.count() == 0:
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

# ---------- PAGE ROUTES ----------
@app.route("/")
def root():
    if 'user_id' in      session:
        return redirect(url_for('index_page'))
    return render_template("login.html")

@app.route("/login")
def login_page():
    if 'user_id' in session:
        return redirect(url_for('index_page'))
    return render_template("login.html")

@app.route("/index")
def index_page():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template("main.html")

@app.route("/settings")
def settings_page():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template("account-settings.html")

@app.route('/forgotpassword')
def forgot_password():
    if 'user_id' in session:
        return redirect(url_for('index_page'))
    return render_template('forgotpassword.html')

# ---------- API ENDPOINTS ----------
@app.get("/api/current-user")
def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    return jsonify(user.to_dict()), 200

@app.post("/api/login")
def login_user():
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
    data = request.get_json(force=True)
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    name = data.get("name", "").strip()
    
    email_value = data.get("email")
    email = email_value.strip() if email_value else None
    
    sec = data.get("security_answer")
    question_id = sec.get("question_id") if sec else None
    answer_text = sec.get("answer").strip() if sec else None
    
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
    
    if User.query.filter_by(u_username=username).first():
        return jsonify({"error": "Username already exists"}), 400
    if email and User.query.filter_by(u_email=email).first():
        return jsonify({"error": "Email already exists"}), 400
    
    u = User(
        u_name=name,
        u_email=email,
        u_username=username,
        u_password=generate_password_hash(password)
    )
    db.session.add(u)
    db.session.commit()
    
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
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    data = request.get_json(force=True)
    new_name = data.get("name", "").strip()
    new_username = data.get("username", "").strip()
    new_email_value = data.get("email")
    new_email = new_email_value.strip() if new_email_value else None
    
    if not new_name:
        return jsonify({"error": "Name is required"}), 400
    if not new_username:
        return jsonify({"error": "Username is required"}), 400
    
    if new_username != user.u_username:
        if User.query.filter_by(u_username=new_username).first():
            return jsonify({"error": "Username already taken"}), 400
    
    if new_email and new_email != user.u_email:
        if User.query.filter_by(u_email=new_email).first():
            return jsonify({"error": "Email already taken"}), 400
    
    user.u_name = new_name
    user.u_username = new_username
    user.u_email = new_email
    db.session.commit()
    
    return jsonify({"message": "Profile updated successfully", "user": user.to_dict()}), 200

@app.put("/api/user/password")
def change_password():
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
    
    if not check_password_hash(user.u_password, old_password):
        return jsonify({"error": "Current password is incorrect"}), 401
    
    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400
    
    user.u_password = generate_password_hash(new_password)
    db.session.commit()
    
    return jsonify({"message": "Password updated successfully"}), 200

@app.delete("/api/user")
def delete_user():
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
    session.pop('user_id', None)
    return jsonify({"message": "Logged out"}), 200

@app.get("/api/security-questions")
def get_security_questions():
    questions = SecurityQuestions.query.all()
    return jsonify([{"q_id": q.q_id, "q_content": q.q_content} for q in questions]), 200

@app.post("/api/user/security-answers")
def set_security_answers():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    data = request.get_json(force=True)
    answers = data.get("answers")
    
    if not answers or not isinstance(answers, list):
        return jsonify({"error": "Invalid answers format"}), 400
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    for ans in answers:
        q_id = ans.get("question_id")
        answer_text = ans.get("answer", "").strip()
        
        if not q_id or not answer_text:
            continue
        
        existing = UserSecurityAnswer.query.filter_by(user_id=user_id, question_id=q_id).first()
        hashed = generate_password_hash(answer_text)
        
        if existing:
            existing.answer_hash = hashed
        else:
            new_ans = UserSecurityAnswer(user_id=user_id, question_id=q_id, answer_hash=hashed)
            db.session.add(new_ans)
    
    db.session.commit()
    return jsonify({"message": "Security answers saved successfully"}), 200

@app.post("/api/user/verify-security-answer")
def verify_security_answer():
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
    data = request.get_json(force=True)
    username_or_email = data.get("username", "").strip()
    
    if not username_or_email:
        return jsonify({"success": False, "message": "Username or email is required"}), 400
    
    user = User.query.filter(
        (User.u_username == username_or_email) | (User.u_email == username_or_email)
    ).first()
    
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
    
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
    
    user.u_password = generate_password_hash(new_password)
    db.session.commit()
    
    return jsonify({"message": "Password reset successful"}), 200

# ---------- COLLABORATIVE LIST ROUTES ----------

# Get all collaborative lists (owned + member of)
@app.get("/api/collaborative-lists")
def get_collaborative_lists():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    # Lists owned by user
    owned_lists = CollaborativeList.query.filter_by(owner_id=user_id).all()
    
    # Lists user is a member of - check if user_id is in member_ids array
    all_lists = CollaborativeList.query.all()
    member_lists = [lst for lst in all_lists 
                    if lst.member_ids and user_id in lst.member_ids]
    
    result = []
    
    # Add owned lists
    for lst in owned_lists:
        result.append({
            "id": lst.id,
            "name": lst.name,
            "owner": lst.owner.u_name,
            "is_owner": True,
            "member_count": len(lst.member_ids) if lst.member_ids else 0
        })
    
    # Add member lists
    for lst in member_lists:
        result.append({
            "id": lst.id,
            "name": lst.name,
            "owner": lst.owner.u_name,
            "is_owner": False,
            "member_count": len(lst.member_ids) if lst.member_ids else 0
        })
    
    return jsonify(result), 200

# Create collaborative list
@app.post("/api/collaborative-lists")
def create_collaborative_list():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    data = request.get_json(force=True)
    name = data.get("name", "").strip()
    
    if not name:
        return jsonify({"error": "List name is required"}), 400
    
    new_list = CollaborativeList(
        name=name, 
        owner_id=user_id,
        member_ids=[]
    )
    db.session.add(new_list)
    db.session.commit()
    
    return jsonify({
        "id": new_list.id,
        "name": new_list.name,
        "owner": new_list.owner.u_name,
        "is_owner": True,
        "member_count": 0
    }), 201

# Rename collaborative list
@app.put("/api/collaborative-lists/<int:list_id>")
def rename_collaborative_list(list_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    collab_list = CollaborativeList.query.get(list_id)
    if not collab_list:
        return jsonify({"error": "List not found"}), 404
    
    # Only owner can rename
    if collab_list.owner_id != user_id:
        return jsonify({"error": "Only the owner can rename this list"}), 403
    
    data = request.get_json(force=True)
    new_name = data.get("name", "").strip()
    
    if not new_name:
        return jsonify({"error": "List name is required"}), 400
    
    collab_list.name = new_name
    db.session.commit()
    
    return jsonify({"message": "List renamed successfully"}), 200

# Delete collaborative list
@app.delete("/api/collaborative-lists/<int:list_id>")
def delete_collaborative_list(list_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    collab_list = CollaborativeList.query.get(list_id)
    if not collab_list:
        return jsonify({"error": "List not found"}), 404
    
    # Only owner can delete
    if collab_list.owner_id != user_id:
        return jsonify({"error": "Only the owner can delete this list"}), 403
    
    db.session.delete(collab_list)
    db.session.commit()
    
    return jsonify({"message": "List deleted successfully"}), 200

# Add member to collaborative list
@app.post("/api/collaborative-lists/<int:list_id>/members")
def add_list_member(list_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    collab_list = CollaborativeList.query.get(list_id)
    if not collab_list:
        return jsonify({"error": "List not found"}), 404
    
    # Check if user is owner
    if collab_list.owner_id != user_id:
        return jsonify({"error": "Only the owner can add members"}), 403
    
    data = request.get_json(force=True)
    username = data.get("username", "").strip()
    
    if not username:
        return jsonify({"error": "Username is required"}), 400
    
    # Find user to add
    member_user = User.query.filter_by(u_username=username).first()
    if not member_user:
        return jsonify({"error": "User not found"}), 404
    
    # Prevent adding owner as member
    if member_user.u_id == collab_list.owner_id:
        return jsonify({"error": "Cannot add the list owner as a member"}), 400
    
    # Initialize member_ids if None
    if collab_list.member_ids is None:
        collab_list.member_ids = []
    
    # Check if already a member
    if member_user.u_id in collab_list.member_ids:
        return jsonify({"error": "User is already a member"}), 400
    
    # Add member - create new list to trigger SQLAlchemy update
    collab_list.member_ids = collab_list.member_ids + [member_user.u_id]
    db.session.commit()
    
    return jsonify({
        "id": member_user.u_id,
        "username": member_user.u_username,
        "name": member_user.u_name
    }), 201

# Get members of a collaborative list
@app.get("/api/collaborative-lists/<int:list_id>/members")
def get_list_members(list_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    collab_list = CollaborativeList.query.get(list_id)
    if not collab_list:
        return jsonify({"error": "List not found"}), 404
    
    # Check if user has access
    is_owner = collab_list.owner_id == user_id
    is_member = collab_list.member_ids and user_id in collab_list.member_ids
    
    if not (is_owner or is_member):
        return jsonify({"error": "Access denied"}), 403
    
    member_ids = collab_list.member_ids or []
    if not member_ids:
        return jsonify([]), 200
    
    members = User.query.filter(User.u_id.in_(member_ids)).all()
    
    return jsonify([{
        "id": m.u_id,
        "username": m.u_username,
        "name": m.u_name
    } for m in members]), 200

# Remove member from collaborative list
@app.delete("/api/collaborative-lists/<int:list_id>/members/<int:member_id>")
def remove_list_member(list_id, member_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    collab_list = CollaborativeList.query.get(list_id)
    if not collab_list:
        return jsonify({"error": "List not found"}), 404
    
    # Only owner can remove members
    if collab_list.owner_id != user_id:
        return jsonify({"error": "Unauthorized"}), 403
    
    if collab_list.member_ids and member_id in collab_list.member_ids:
        # Create new list without the member_id
        collab_list.member_ids = [mid for mid in collab_list.member_ids if mid != member_id]
        db.session.commit()
        return jsonify({"message": "Member removed"}), 200
    
    return jsonify({"error": "Member not found"}), 404

# Get tasks for a collaborative list
@app.get("/api/collaborative-lists/<int:list_id>/tasks")
def get_collaborative_tasks(list_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    # Check if user has access to this list
    collab_list = CollaborativeList.query.get(list_id)
    if not collab_list:
        return jsonify({"error": "List not found"}), 404
    
    is_owner = collab_list.owner_id == user_id
    is_member = collab_list.member_ids and user_id in collab_list.member_ids
    
    if not (is_owner or is_member):
        return jsonify({"error": "Access denied"}), 403
    
    tasks = CollaborativeTask.query.filter_by(list_id=list_id).all()
    return jsonify([t.to_dict() for t in tasks]), 200

# Create task in collaborative list
@app.post("/api/collaborative-lists/<int:list_id>/tasks")
def create_collaborative_task(list_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    # Check access
    collab_list = CollaborativeList.query.get(list_id)
    if not collab_list:
        return jsonify({"error": "List not found"}), 404
    
    is_owner = collab_list.owner_id == user_id
    is_member = collab_list.member_ids and user_id in collab_list.member_ids
    
    if not (is_owner or is_member):
        return jsonify({"error": "Access denied"}), 403
    
    data = request.get_json(force=True)
    new_task = CollaborativeTask(
        list_id=list_id,
        text=data.get("text", "").strip(),
        date=data.get("date") or "",
        checked=bool(data.get("checked", False)),
        priority=data.get("priority") or "Mid"
    )
    
    if not new_task.text:
        return jsonify({"error": "Task text is required"}), 400
    
    db.session.add(new_task)
    db.session.commit()
    
    return jsonify(new_task.to_dict()), 201

# Update collaborative task
@app.put("/api/collaborative-lists/<int:list_id>/tasks/<int:task_id>")
def update_collaborative_task(list_id, task_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    # Check access
    collab_list = CollaborativeList.query.get(list_id)
    if not collab_list:
        return jsonify({"error": "List not found"}), 404
    
    is_owner = collab_list.owner_id == user_id
    is_member = collab_list.member_ids and user_id in collab_list.member_ids
    
    if not (is_owner or is_member):
        return jsonify({"error": "Access denied"}), 403
    
    task = CollaborativeTask.query.filter_by(id=task_id, list_id=list_id).first()
    if not task:
        return jsonify({"error": "Task not found"}), 404
    
    data = request.get_json(force=True)
    if "text" in data:
        task.text = data["text"].strip()
    if "date" in data:
        task.date = data["date"] or ""
    if "priority" in data:
        task.priority = data["priority"] or "Mid"
    if "checked" in data:
        task.checked = bool(data["checked"])
    
    db.session.commit()
    return jsonify(task.to_dict()), 200

# Delete collaborative task
@app.delete("/api/collaborative-lists/<int:list_id>/tasks/<int:task_id>")
def delete_collaborative_task(list_id, task_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    # Check access
    collab_list = CollaborativeList.query.get(list_id)
    if not collab_list:
        return jsonify({"error": "List not found"}), 404
    
    is_owner = collab_list.owner_id == user_id
    is_member = collab_list.member_ids and user_id in collab_list.member_ids
    
    if not (is_owner or is_member):
        return jsonify({"error": "Access denied"}), 403
    
    task = CollaborativeTask.query.filter_by(id=task_id, list_id=list_id).first()
    if not task:
        return jsonify({"error": "Task not found"}), 404
    
    db.session.delete(task)
    db.session.commit()
    
    return "", 204

from app import *

if __name__ == "__main__":
    app.run(debug=True)
