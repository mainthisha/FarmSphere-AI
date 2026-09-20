"""Text-to-speech endpoint for the Voice Farm Doctor.

The reference app proxied this to Lovable's proprietary audio gateway.
Removed per the Lovable-trace-removal requirement.

If OPENAI_API_KEY is configured, this calls OpenAI's TTS API and streams
back real audio. Without a key, it deliberately returns a clean error —
the frontend already treats a failed /api/tts call as a signal to fall
back to the browser's built-in Web Speech API (speechSynthesis), which
supports Tamil and English in most modern browsers with zero server cost
or API key. That fallback is not a compromise bolted on for this port —
it was already built into the reference app's voice-doctor page.
"""

import json
import urllib.request

from flask import Blueprint, Response, current_app, jsonify, request
from flask_jwt_extended import jwt_required

bp = Blueprint("tts", __name__, url_prefix="/api")


@bp.post("/tts")
@jwt_required()
def tts():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "No text provided."}), 400
    if len(text) > 1000:
        text = text[:1000]

    if not current_app.config.get("OPENAI_API_KEY"):
        # No key configured — signal the frontend to use its browser-speech fallback.
        return jsonify({"error": "Server-side text-to-speech is not configured."}), 501

    try:
        payload = json.dumps(
            {
                "model": "tts-1",
                "voice": "alloy",
                "input": text,
                "response_format": "mp3",
            }
        ).encode()
        req = urllib.request.Request(
            "https://api.openai.com/v1/audio/speech",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {current_app.config['OPENAI_API_KEY']}",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            audio = resp.read()
        return Response(audio, mimetype="audio/mpeg")
    except Exception as exc:  # pragma: no cover - network dependent
        current_app.logger.error("OpenAI TTS call failed: %s", exc)
        return jsonify({"error": "Text-to-speech is temporarily unavailable."}), 502
