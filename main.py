from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import motor.motor_asyncio
import os
from datetime import datetime
from bson import ObjectId
import logging

# ===== Setup Logging =====
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
# ⚠️ IMPORTANT: Use environment variable for password!
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://softtech:soft123@cluster1.ybelvwk.mongodb.net/todo_app")

todos_collection = None

try:
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URI)
    db = client.todo_app
    todos_collection = db.todos
    logger.info("✅ MongoDB connected successfully!")
except Exception as e:
    logger.error(f"❌ MongoDB connection error: {e}")

# ===== Models =====
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

# ===== Root Route =====
@app.get("/")
async def root():
    return FileResponse("public/index.html")

# ===== Health Check =====
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "mongodb": todos_collection is not None,
        "env": os.environ.get("VERCEL_ENV", "development"),
        "message": "API is running!"
    }

# ===== API Routes =====

# GET all todos
@app.get("/api/todos")
async def get_todos():
    if todos_collection is None:
        logger.warning("⚠️ MongoDB not connected, returning empty list")
        return []
    
    try:
        todos = []
        cursor = todos_collection.find().sort("createdAt", -1)
        async for todo in cursor:
            todos.append(todo_helper(todo))
        logger.info(f"✅ Retrieved {len(todos)} todos")
        return todos
    except Exception as e:
        logger.error(f"❌ Error in get_todos: {e}")
        return []

# POST new todo
@app.post("/api/todos")
async def create_todo(todo: TodoCreate):
    if todos_collection is None:
        logger.error("❌ Database not connected")
        raise HTTPException(status_code=500, detail="Database not connected")
    
    try:
        count = await todos_collection.count_documents({})
        if count >= 10:
            raise HTTPException(status_code=400, detail="Maximum 10 tasks allowed")
        
        new_todo = {
            "task": todo.task,
            "category": todo.category,
            "completed": todo.completed or False,
            "dueDate": todo.dueDate or "",
            "time": todo.time or "",
            "reminder": todo.reminder or "",
            "createdAt": datetime.now()
        }
        
        result = await todos_collection.insert_one(new_todo)
        created_todo = await todos_collection.find_one({"_id": result.inserted_id})
        logger.info(f"✅ Created new todo: {todo.task}")
        return todo_helper(created_todo)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in create_todo: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# DELETE todo
@app.delete("/api/todos/{todo_id}")
async def delete_todo(todo_id: str):
    if todos_collection is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    try:
        result = await todos_collection.delete_one({"_id": ObjectId(todo_id)})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Todo not found")
        logger.info(f"✅ Deleted todo: {todo_id}")
        return {"message": "Deleted successfully"}
    except Exception as e:
        logger.error(f"❌ Error in delete_todo: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# PUT update todo
@app.put("/api/todos/{todo_id}")
async def update_todo(todo_id: str, update_data: TodoUpdate):
    if todos_collection is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
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
        logger.info(f"✅ Updated todo: {todo_id}")
        return todo_helper(updated_todo)
    except Exception as e:
        logger.error(f"❌ Error in update_todo: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ===== Test Route =====
@app.get("/api/test")
async def test():
    return {
        "status": "API is working!",
        "message": "FastAPI + MongoDB",
        "mongodb": todos_collection is not None
    }

# ===== Serve Static Files (LAST - FALLBACK) =====
# This serves any other static files (CSS, JS, etc.)
app.mount("/static", StaticFiles(directory="public", html=True), name="static")

# Catch-all for static files
@app.get("/{path:path}")
async def serve_static(path: str):
    # If path starts with api, return 404 (should be handled by routes above)
    if path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    
    file_path = os.path.join("public", path)
    if os.path.exists(file_path):
        return FileResponse(file_path)
    
    # If file not found, serve index.html (for SPA routing)
    return FileResponse("public/index.html")