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
   run app.py for the to-do list
   run account.py for the user account manager

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

- **Create a user**
  ```
  PUT /api/user
  ```
  
- **Verify user answer to security question**
  ```
  POST /api/user/verify-security-answer
  ```

- **Request password reset via forgot password**
  ```
  POST /api/reset-password
  ```

- **Create new collaborative list**
  ```
  POST /api/collaborative-lists
  ```

- **Delete a collaborative list**
  ```
  DELETE /api/collaborative-lists/<list_id>
  ```
  
  

These endpoints allow the frontend to retrieve, insert, and remove data from the SQLite database through the Flask backend.
