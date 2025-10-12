from flask import Flask, jsonify, request, render_template, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///database.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

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
    
# ---- DB INIT ----
with app.app_context():
    db.create_all()

# ---------- PAGES ------------
@app.route("/")
def index():
    return render_template("login.html")

@app.route("/login")
def login_page():
    return render_template("login.html")

@app.route("/tasks")
def tasks_page():
    return render_template("main.html")

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
