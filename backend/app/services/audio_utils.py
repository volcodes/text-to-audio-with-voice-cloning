import subprocess
import tempfile
from pathlib import Path


def convert_to_wav(input_bytes: bytes, input_filename: str) -> Path:
    """Convert uploaded audio to WAV 24kHz mono via ffmpeg."""
    suffix = Path(input_filename).suffix or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp_in:
        tmp_in.write(input_bytes)
        tmp_in_path = tmp_in.name

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_out:
        tmp_out_path = tmp_out.name

    subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", tmp_in_path,
            "-ar", "24000",
            "-ac", "1",
            "-sample_fmt", "s16",
            tmp_out_path,
        ],
        capture_output=True,
        check=True,
    )

    Path(tmp_in_path).unlink(missing_ok=True)
    return Path(tmp_out_path)


def get_audio_duration(wav_path: Path) -> float:
    """Get duration of a WAV file in seconds using ffprobe."""
    result = subprocess.run(
        [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(wav_path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return float(result.stdout.strip())
