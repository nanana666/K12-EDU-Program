"""API v1 路由聚合。"""

from fastapi import APIRouter

from app.api.v1 import auth, questions, quiz_sessions, system

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(questions.router)
api_router.include_router(quiz_sessions.router)
api_router.include_router(system.router)
