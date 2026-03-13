from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from app.services.tts_service import tts_service

router = APIRouter()


class GenerateRequest(BaseModel):
    voice_id: str
    text: str


@router.get("/status")
async def generation_status():
    return tts_service.get_status()


@router.post("/generate", status_code=202)
async def generate_speech(req: GenerateRequest):
    """Start speech generation in the background. Returns 202 immediately."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Text must not be empty")

    try:
        tts_service.get_voice_path(req.voice_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Voice not found")

    if not tts_service.start_generation(req.voice_id, req.text):
        raise HTTPException(status_code=503, detail="A generation is already in progress. Please wait.")

    return {"status": "started"}


@router.get("/logs")
async def get_logs():
    return tts_service.get_logs()


@router.get("/logs/latest")
async def get_latest_log():
    record = tts_service.get_latest_record()
    if record is None:
        raise HTTPException(status_code=404, detail="No completed generation yet")
    return record.to_dict()


@router.get("/result")
async def get_result():
    """Return generated audio once ready. Returns 202 while still generating."""
    if tts_service.get_status()["busy"]:
        return JSONResponse(status_code=202, content={"status": "generating"})

    audio_bytes, error = tts_service.get_result()
    if error:
        raise HTTPException(status_code=500, detail=f"Generation failed: {error}")
    if audio_bytes is None:
        raise HTTPException(status_code=404, detail="No audio result available")

    return Response(content=audio_bytes, media_type="audio/wav")
