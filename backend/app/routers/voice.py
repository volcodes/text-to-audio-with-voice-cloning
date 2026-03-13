from fastapi import APIRouter, HTTPException, UploadFile

from app.services.audio_utils import convert_to_wav, get_audio_duration
from app.services.tts_service import tts_service

router = APIRouter()

MIN_DURATION_SECONDS = 10


@router.post("/register")
async def register_voice(file: UploadFile):
    """Upload a voice recording, convert to WAV, validate duration, register."""
    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    try:
        wav_path = convert_to_wav(audio_bytes, file.filename or "recording.webm")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Audio conversion failed: {e}")

    duration = get_audio_duration(wav_path)
    if duration < MIN_DURATION_SECONDS:
        wav_path.unlink(missing_ok=True)
        raise HTTPException(
            status_code=400,
            detail=f"Recording too short ({duration:.1f}s). Need at least {MIN_DURATION_SECONDS}s.",
        )

    voice_id = tts_service.register_voice(wav_path)
    return {"voice_id": voice_id, "duration": round(duration, 1)}
