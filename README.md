# cmsc128-IndivProject_Niedes_Almonia

# To-Do Web App

## Backend Chosen
This project uses **Flask** (Python) as the backend framework with **SQLite** as the database, managed through **SQLAlchemy**.

## How to Run the Web App
1. Install dependencies:
   ```bash
   pip install flask flask-cors sqlalchemy
   ```

2. Run the Flask backend:
   run app.py

3. Open the localhost:5000 in your browser.

## Example API Endpoints
Here are some example endpoints that the frontend can use to interact with the database:

- **Get all tasks**
  ```http
  GET /tasks
  ```

- **Add a new task**
  ```http
  POST /tasks
  ```

- **Delete a task**
  ```http
  DELETE /tasks/<id>
  ```

These endpoints allow the frontend to retrieve, insert, and remove data from the SQLite database through the Flask backend.
