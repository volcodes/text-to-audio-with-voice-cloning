import gc
import io
import logging
import os
import re
import shutil
import threading
import time
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

import numpy as np
import soundfile as sf
import torch

VOICES_DIR = Path(os.getenv("VOICES_DIR", "/data/voices"))
VOICES_DIR.mkdir(parents=True, exist_ok=True)

SAMPLE_RATE = 24000
MAX_CHUNK_CHARS = 280
MIN_CHUNK_CHARS = 20
CROSSFADE_MS = 50


@dataclass
class ChunkLog:
    index: int            # 0-based
    text_preview: str     # first 80 chars + "…"
    char_count: int
    duration_ms: int      # wall-clock time for this chunk's model.generate()
    audio_duration_s: float  # seconds of audio produced


@dataclass
class GenerationRecord:
    id: str               # 8-char hex
    timestamp: str        # ISO 8601 UTC
    voice_id: str
    total_chars: int
    chunk_count: int
    total_duration_ms: int
    audio_duration_s: float
    device: str
    chunks: list[ChunkLog] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def _split_into_sentences(text: str) -> list[str]:
    """Split text into sentences on .!? boundaries, keeping the punctuation."""
    parts = re.split(r'(?<=[.!?])\s+', text.strip())
    return [p.strip() for p in parts if p.strip()]


def _chunk_text(text: str) -> list[str]:
    """Group sentences into chunks of up to MAX_CHUNK_CHARS characters."""
    sentences = _split_into_sentences(text)
    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        # If a single sentence exceeds the limit, split on commas/semicolons
        if len(sentence) > MAX_CHUNK_CHARS:
            if current:
                chunks.append(current.strip())
                current = ""
            sub_parts = re.split(r'(?<=[,;:])\s+', sentence)
            for part in sub_parts:
                if current and len(current) + len(part) + 1 > MAX_CHUNK_CHARS:
                    chunks.append(current.strip())
                    current = part
                else:
                    current = f"{current} {part}".strip() if current else part
            continue

        if current and len(current) + len(sentence) + 1 > MAX_CHUNK_CHARS:
            chunks.append(current.strip())
            current = sentence
        else:
            current = f"{current} {sentence}".strip() if current else sentence

    if current:
        chunks.append(current.strip())

    # Merge any very short trailing chunks with the previous one
    merged: list[str] = []
    for chunk in chunks:
        if merged and len(chunk) < MIN_CHUNK_CHARS:
            merged[-1] = f"{merged[-1]} {chunk}"
        else:
            merged.append(chunk)

    return merged


def _crossfade(a: np.ndarray, b: np.ndarray, samples: int) -> np.ndarray:
    """Concatenate two audio arrays with a crossfade of `samples` length."""
    if samples <= 0 or len(a) < samples or len(b) < samples:
        return np.concatenate([a, b])

    fade_out = np.linspace(1.0, 0.0, samples, dtype=np.float32)
    fade_in = np.linspace(0.0, 1.0, samples, dtype=np.float32)

    overlap = a[-samples:] * fade_out + b[:samples] * fade_in
    return np.concatenate([a[:-samples], overlap, b[samples:]])


class TTSService:
    def __init__(self):
        self.model = None
        self.device = os.getenv("DEVICE", "cpu")
        self._lock = threading.Lock()
        self._status: dict = {"busy": False, "chunk": 0, "total_chunks": 0}
        self._result_bytes: bytes | None = None
        self._result_error: str | None = None
        self._history: list[GenerationRecord] = []
        self._latest_record: GenerationRecord | None = None

    def get_status(self) -> dict:
        s = dict(self._status)
        now = time.monotonic()
        if s.get("busy") and "_started_at" in s:
            s["total_elapsed_ms"] = int((now - s.pop("_started_at")) * 1000)
        else:
            s.pop("_started_at", None)
        if s.get("busy") and "_chunk_started_at" in s:
            s["chunk_elapsed_ms"] = int((now - s.pop("_chunk_started_at")) * 1000)
        else:
            s.pop("_chunk_started_at", None)
        return s

    def get_result(self) -> tuple[bytes | None, str | None]:
        """Return (audio_bytes, error). Both None if no completed generation."""
        return self._result_bytes, self._result_error

    def get_logs(self) -> list[dict]:
        return [r.to_dict() for r in self._history]

    def get_latest_record(self) -> GenerationRecord | None:
        return self._latest_record

    def start_generation(self, voice_id: str, text: str) -> bool:
        """Start generation in a background thread. Returns False if already busy."""
        if not self._lock.acquire(blocking=False):
            return False
        self._result_bytes = None
        self._result_error = None
        now = time.monotonic()
        self._status = {
            "busy": True,
            "chunk": 0,
            "total_chunks": 0,
            "_started_at": now,
            "_chunk_started_at": now,
        }
        threading.Thread(
            target=self._run_generation, args=(voice_id, text), daemon=True
        ).start()
        return True

    def _run_generation(self, voice_id: str, text: str) -> None:
        try:
            self._result_bytes = self._do_generate(voice_id, text)
        except Exception as e:
            self._result_error = str(e)
        finally:
            self._status = {
                "busy": False,
                "chunk": self._status["chunk"],
                "total_chunks": self._status["total_chunks"],
            }
            self._lock.release()

    def load_model(self):
        from chatterbox.tts import ChatterboxTTS
        self.model = ChatterboxTTS.from_pretrained(device=self.device)

    def register_voice(self, wav_path: Path) -> str:
        """Save a voice reference WAV and return a voice_id."""
        voice_id = uuid.uuid4().hex[:12]
        dest = VOICES_DIR / f"{voice_id}.wav"
        shutil.move(str(wav_path), dest)
        return voice_id

    def get_voice_path(self, voice_id: str) -> Path:
        path = VOICES_DIR / f"{voice_id}.wav"
        if not path.exists():
            raise FileNotFoundError(f"Voice {voice_id} not found")
        return path

    def _do_generate(self, voice_id: str, text: str) -> bytes:
        voice_path = str(self.get_voice_path(voice_id))
        chunks = _chunk_text(text)
        total = len(chunks)
        self._status["total_chunks"] = total

        logger.info("Generation started: %d chunk(s), %d chars total", total, len(text))
        t0 = time.monotonic()

        crossfade_samples = int(SAMPLE_RATE * CROSSFADE_MS / 1000)
        combined: np.ndarray | None = None
        chunk_logs: list[ChunkLog] = []

        for i, chunk in enumerate(chunks):
            self._status["chunk"] = i + 1
            t_chunk = time.monotonic()
            self._status["_chunk_started_at"] = t_chunk
            logger.info("Chunk %d/%d (%d chars): %.60s", i + 1, total, len(chunk), chunk)

            with torch.no_grad():
                wav_tensor = self.model.generate(
                    chunk,
                    audio_prompt_path=voice_path,
                    exaggeration=0.3,
                    cfg_weight=0.5,
                    temperature=0.6,
                )
            audio = wav_tensor.squeeze().cpu().numpy()
            del wav_tensor
            gc.collect()

            chunk_duration_ms = int((time.monotonic() - t_chunk) * 1000)
            chunk_audio_s = round(len(audio) / SAMPLE_RATE, 3)
            chunk_logs.append(ChunkLog(
                index=i,
                text_preview=chunk[:80] + "…" if len(chunk) > 80 else chunk,
                char_count=len(chunk),
                duration_ms=chunk_duration_ms,
                audio_duration_s=chunk_audio_s,
            ))

            logger.info("Chunk %d/%d done (%.1fs elapsed)", i + 1, total, time.monotonic() - t0)

            if combined is None:
                combined = audio
            else:
                combined = _crossfade(combined, audio, crossfade_samples)

        total_duration_ms = int((time.monotonic() - t0) * 1000)
        total_audio_s = round(len(combined) / SAMPLE_RATE, 3) if combined is not None else 0.0

        record = GenerationRecord(
            id=uuid.uuid4().hex[:8],
            timestamp=datetime.now(timezone.utc).isoformat(),
            voice_id=voice_id,
            total_chars=len(text),
            chunk_count=total,
            total_duration_ms=total_duration_ms,
            audio_duration_s=total_audio_s,
            device=self.device,
            chunks=chunk_logs,
        )
        self._history.append(record)
        if len(self._history) > 20:
            self._history = self._history[-20:]
        self._latest_record = record

        logger.info("Generation complete: %d chunk(s) in %.1fs", total, time.monotonic() - t0)

        buf = io.BytesIO()
        sf.write(buf, combined if combined is not None else np.zeros(1, dtype=np.float32), SAMPLE_RATE, format="WAV")
        buf.seek(0)
        return buf.read()


tts_service = TTSService()
