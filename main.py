from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import motor.motor_asyncio
import os
from datetime import datetime
from bson import ObjectId

# ===== Create FastAPI App =====
app = FastAPI()

# ===== CORS Middleware =====
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== MongoDB Connection =====
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://softtech:soft123@cluster1.ybelvwk.mongodb.net/todo_app")

try:
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
    db = client.todo_app
    todos_collection = db.todos
    print("✅ MongoDB connected successfully!")
except Exception as e:
    print(f"❌ MongoDB connection error: {e}")

# ===== Pydantic Models =====
class TodoCreate(BaseModel):
    task: str
    category: str
    dueDate: Optional[str] = ""
    time: Optional[str] = ""
    reminder: Optional[str] = ""
    completed: Optional[bool] = False

class TodoUpdate(BaseModel):
    task: Optional[str] = None
    toggleComplete: Optional[bool] = None
    restore: Optional[bool] = None

# ===== Helper Functions =====
def todo_helper(todo) -> dict:
    return {
        "id": str(todo["_id"]),
        "task": todo["task"],
        "category": todo["category"],
        "completed": todo.get("completed", False),
        "dueDate": todo.get("dueDate", ""),
        "time": todo.get("time", ""),
        "reminder": todo.get("reminder", ""),
        "createdAt": todo.get("createdAt"),
    }

# ===== API Routes (MUST come BEFORE static files) =====

# GET all todos
@app.get("/api/todos")
async def get_todos():
    try:
        todos = []
        cursor = todos_collection.find().sort("createdAt", -1)
        async for todo in cursor:
            todos.append(todo_helper(todo))
        return todos
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# POST new todo
@app.post("/api/todos")
async def create_todo(todo: TodoCreate):
    try:
        count = await todos_collection.count_documents({})
        if count >= 10:
            raise HTTPException(status_code=400, detail="Maximum 10 tasks allowed")
        
        new_todo = {
            "task": todo.task,
            "category": todo.category,
            "completed": todo.completed,
            "dueDate": todo.dueDate,
            "time": todo.time,
            "reminder": todo.reminder,
            "createdAt": datetime.now()
        }
        
        result = await todos_collection.insert_one(new_todo)
        created_todo = await todos_collection.find_one({"_id": result.inserted_id})
        return todo_helper(created_todo)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# DELETE todo
@app.delete("/api/todos/{todo_id}")
async def delete_todo(todo_id: str):
    try:
        result = await todos_collection.delete_one({"_id": ObjectId(todo_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Todo not found")
        return {"message": "Deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# PUT update todo
@app.put("/api/todos/{todo_id}")
async def update_todo(todo_id: str, update_data: TodoUpdate):
    try:
        todo = await todos_collection.find_one({"_id": ObjectId(todo_id)})
        if not todo:
            raise HTTPException(status_code=404, detail="Todo not found")
        
        update_fields = {}
        
        if update_data.toggleComplete is not None:
            update_fields["completed"] = not todo.get("completed", False)
        elif update_data.restore is not None:
            update_fields["completed"] = False
        elif update_data.task is not None:
            update_fields["task"] = update_data.task
        
        if update_fields:
            await todos_collection.update_one(
                {"_id": ObjectId(todo_id)},
                {"$set": update_fields}
            )
        
        updated_todo = await todos_collection.find_one({"_id": ObjectId(todo_id)})
        return todo_helper(updated_todo)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ===== Test API Route =====
@app.get("/api/test")
async def test():
    return {"status": "API is working!", "message": "FastAPI + MongoDB"}

# ===== SERVE STATIC FILES (MUST come LAST) =====
# This will serve your public folder files
app.mount("/", StaticFiles(directory="public", html=True), name="public")