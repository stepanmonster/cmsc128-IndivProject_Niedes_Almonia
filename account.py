from flask import Flask, jsonify, request, render_template, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///database.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db = SQLAlchemy(app)

# ---------- MODELS ----------

class User(db.Model):
    u_id = db.Column(db.Integer, primary_key=True)
    u_name = db.Column(db.String(200), nullable=False)
    u_email = db.Column(db.String(200), nullable=True)
    u_username = db.Column(db.String(200), unique=True, nullable=False)
    u_password = db.Column(db.String(200), nullable=False)
    
    def to_dict(self):
        return {
            "u_id": self.u_id,
            "name": self.u_name,
            "email": self.u_email,
            "username": self.u_username
        }

# ---------- DB INIT ----------
with app.app_context():
    db.create_all()

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
    
    # Validation
    if not name:
        return jsonify({"error": "Name is required"}), 400
    if not username:
        return jsonify({"error": "Username is required"}), 400
    if not password:
        return jsonify({"error": "Password is required"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400
    
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

if __name__ == "__main__":
    app.run(debug=True)
