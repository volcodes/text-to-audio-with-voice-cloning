import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)

from app.services.tts_service import tts_service
from app.routers import voice, tts


@asynccontextmanager
async def lifespan(app: FastAPI):
    tts_service.load_model()
    yield


app = FastAPI(title="Book-Import Voice Cloning", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(voice.router, prefix="/api/voice")
app.include_router(tts.router, prefix="/api/tts")


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": tts_service.model is not None,
    }
