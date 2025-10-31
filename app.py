from flask import jsonify, request, session
from datetime import datetime

# Import the Flask app instance and db from account
from account import app, db

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(300), nullable=False)
    date = db.Column(db.String(40))
    checked = db.Column(db.Boolean, default=False)
    priority = db.Column(db.String(10), default="Mid")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    user_id = db.Column(db.Integer, db.ForeignKey("user.u_id"), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "text": self.text,
            "date": self.date or "",
            "checked": self.checked,
            "priority": self.priority or "Mid",
            "createdAt": int(self.created_at.timestamp() * 1000),
        }

# Create tables - CHANGED from flask_app to app
with app.app_context():
    db.create_all()

# ---------- API ENDPOINTS ----------
@app.get("/api/tasks")
def list_tasks():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    tasks = Task.query.filter_by(user_id=user_id).order_by(Task.created_at.asc()).all()
    return jsonify([t.to_dict() for t in tasks])

@app.post("/api/tasks")
def create_task():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    data = request.get_json(force=True)
    t = Task(
        text=data.get("text", "").strip(),
        date=data.get("date") or "",
        checked=bool(data.get("checked", False)),
        priority=data.get("priority") or "Mid",
        user_id=user_id
    )
    
    if not t.text:
        return jsonify({"error": "text is required"}), 400
    
    db.session.add(t)
    db.session.commit()
    return jsonify(t.to_dict()), 201

@app.put("/api/tasks/<int:task_id>")
def update_task(task_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    t = Task.query.filter_by(id=task_id, user_id=user_id).first()
    if not t:
        return jsonify({"error": "Task not found"}), 404
    
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
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    t = Task.query.filter_by(id=task_id, user_id=user_id).first()
    if not t:
        return jsonify({"error": "Task not found"}), 404
    
    t.checked = not t.checked
    db.session.commit()
    return jsonify(t.to_dict())

@app.delete("/api/tasks/<int:task_id>")
def delete_task(task_id):
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"error": "Not logged in"}), 401
    
    t = Task.query.filter_by(id=task_id, user_id=user_id).first()
    if not t:
        return jsonify({"error": "Task not found"}), 404
    
    db.session.delete(t)
    db.session.commit()
    return "", 204
