from flask import Flask, jsonify, request, render_template
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///database.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# ---------- MODELS ----------

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(300), nullable=False)
    date = db.Column(db.String(40))  # e.g. "2025-09-22" or "2025-09-22T14:00"
    checked = db.Column(db.Boolean, default=False)
    priority = db.Column(db.String(10), default="Mid")  # High/Mid/Low
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # converts a task into a dictionary to be ready for json and js fetch function
    def to_dict(self):
        return {
            "id": self.id,
            "text": self.text,
            "date": self.date or "",
            "checked": self.checked,
            "priority": self.priority or "Mid",
            "createdAt": int(self.created_at.timestamp() * 1000),
        }

class User(db.Model):
    u_id = db.Column(db.Integer, primary_key=True)
    u_email = db.Column(db.String(200), nullable=True)
    u_username = db.Column(db.String(200), unique=True, nullable=False)
    u_password = db.Column(db.String(200), nullable=False)
    
    def to_dict(self):
        return {
            "u_id": self.u_id,
            "email": self.u_email,
            "username": self.u_username
        }

# ---------- DB INIT ----------
with app.app_context():
    db.create_all()

# ---------- PAGES ----------

@app.route("/")
def index():
    return render_template("login.html")

@app.route("/login")
def login_page():
    return render_template("login.html")

@app.route("/tasks")
def tasks_page():
    return render_template("main.html")

# ---------- TASK REST API ----------

@app.get("/api/tasks")
def list_tasks():
    tasks = Task.query.order_by(Task.created_at.asc()).all()
    return jsonify([t.to_dict() for t in tasks])

@app.post("/api/tasks")
def create_task():
    data = request.get_json(force=True)
    t = Task(
        text=data.get("text", "").strip(),
        date=data.get("date") or "",
        checked=bool(data.get("checked", False)),
        priority=data.get("priority") or "Mid",
    )
    
    if not t.text:
        return jsonify({"error": "text is required"}), 400
    
    db.session.add(t)
    db.session.commit()
    return jsonify(t.to_dict()), 201

@app.put("/api/tasks/<int:task_id>")
def update_task(task_id):
    t = Task.query.get_or_404(task_id)
    data = request.get_json(force=True)
    
    if "text" in data:
        t.text = data["text"].strip()
    if "date" in data:
        t.date = data["date"] or ""
    if "priority" in data:
        t.priority = data["priority"] or "Mid"
    if "checked" in data:
        t.checked = bool(data["checked"])
    
    db.session.commit()
    return jsonify(t.to_dict())

@app.patch("/api/tasks/<int:task_id>/toggle")
def toggle_task(task_id):
    t = Task.query.get_or_404(task_id)
    t.checked = not t.checked
    db.session.commit()
    return jsonify(t.to_dict())

@app.delete("/api/tasks/<int:task_id>")
def delete_task(task_id):
    t = Task.query.get_or_404(task_id)
    db.session.delete(t)
    db.session.commit()
    return "", 204

# ---------- USER REST API ----------

# Add this new endpoint to get current user
@app.get("/api/current-user")
def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    return jsonify(user.to_dict()), 200

# Update login endpoint to set session
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
    
    # Set session
    session['user_id'] = user.u_id
    
    return jsonify({"message": "Login successful", "user": user.to_dict()}), 200

# Update registration to set session
@app.post("/api/user")
def create_user():
    data = request.get_json(force=True)
    username = data.get("username", "").strip()
    email = (data.get("email") or "").strip() or None
    password = data.get("password", "").strip()
    
    # Validation
    if not username:
        return jsonify({"error": "Username is required"}), 400
    if not password:
        return jsonify({"error": "Password is required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    
    if User.query.filter_by(u_username=username).first():
        return jsonify({"error": "Username already exists"}), 400
    
    if email and User.query.filter_by(u_email=email).first():
        return jsonify({"error": "Email already exists"}), 400
    
    u = User(
        u_email=email,
        u_username=username,
        u_password=generate_password_hash(password)
    )
    
    db.session.add(u)
    db.session.commit()
    
    # Set session
    session['user_id'] = u.u_id
    
    return jsonify(u.to_dict()), 201

# Add logout endpoint
@app.post("/api/logout")
def logout():
    session.pop('user_id', None)
    return jsonify({"message": "Logged out"}), 200

# Protect the tasks page
@app.route("/tasks")
def tasks_page():
    if 'user_id' not in session:
        return redirect(url_for('login_page'))
    return render_template("main.html")

if __name__ == "__main__":
    app.run(debug=True)
