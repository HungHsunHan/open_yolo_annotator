#!/usr/bin/env python3
"""
Startup script for YOLO Annotation API server
"""
import asyncio
import uvicorn
from database import init_database

def main():
    """Initialize database and start server"""
    print("🚀 Starting YOLO Annotation API...")
    
    # Initialize database with default users
    print("📦 Initializing database...")
    init_database()
    
    # Start FastAPI server
    print("🌐 Starting server on http://localhost:8000")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Enable auto-reload for development
        log_level="info"
    )

if __name__ == "__main__":
    main()