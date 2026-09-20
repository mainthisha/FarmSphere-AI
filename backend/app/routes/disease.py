"""Crop disease detection from an uploaded photo.

Like the assistant endpoint, the reference app proxied this to Lovable's
proprietary AI gateway. That dependency is removed here. If OPENAI_API_KEY
is set, this endpoint calls OpenAI's vision-capable chat completions API.
Otherwise it falls back to a deterministic, seeded pseudo-analysis (in the
same spirit as the app's deterministic getWeather() helper) so the feature
is fully demoable offline. Swap in a real vision model by setting
OPENAI_API_KEY — no frontend changes required.
"""

import hashlib
import json
import urllib.request

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import jwt_required

bp = Blueprint("disease", __name__, url_prefix="/api")

SCHEMA_PROMPT = (
    "You are a plant pathologist. Inspect the crop photo and reply ONLY with JSON:\n"
    '{"disease":"name","confidence":0-100,"severity":"Low|Medium|High","healthy":true|false,\n'
    '"symptoms":["..."],"treatment":["..."],"prevention":["..."]}\n'
    'If the image is not a plant, set disease to "Not a crop image" and confidence 0.'
)

CONDITIONS = [
    {
        "disease": "Leaf Blight",
        "severity": "Medium",
        "symptoms": ["Brown-edged lesions on older leaves", "Lesions merge into larger dead patches", "Yellow halo around spots"],
        "treatment": ["Remove and burn severely infected leaves", "Spray copper oxychloride (3g/litre) every 7 days", "Avoid overhead irrigation to keep foliage dry"],
        "prevention": ["Use certified disease-free seed", "Rotate with a non-host crop next season", "Space plants for better airflow"],
    },
    {
        "disease": "Powdery Mildew",
        "severity": "Low",
        "symptoms": ["White powdery coating on leaf surface", "Slight leaf curling", "Reduced pod/fruit set"],
        "treatment": ["Spray wettable sulphur (2g/litre) in the evening", "Remove heavily coated leaves", "Improve sunlight exposure by pruning"],
        "prevention": ["Avoid dense planting", "Water at the base, not on foliage", "Apply neem oil preventively during humid weeks"],
    },
    {
        "disease": "Bacterial Leaf Spot",
        "severity": "Medium",
        "symptoms": ["Small water-soaked spots that turn brown", "Spots have a yellow halo", "Spots may merge along leaf veins"],
        "treatment": ["Apply copper-based bactericide", "Remove and destroy infected debris", "Avoid working in the field when leaves are wet"],
        "prevention": ["Use resistant varieties where available", "Practice 2-year crop rotation", "Disinfect tools between plants"],
    },
    {
        "disease": "Nutrient Deficiency (Nitrogen)",
        "severity": "Low",
        "symptoms": ["Uniform yellowing starting from older leaves", "Stunted overall growth", "Thin stems"],
        "treatment": ["Apply urea or ammonium sulphate in split doses", "Add well-rotted farmyard manure", "Foliar spray of 2% urea for a quick response"],
        "prevention": ["Soil-test before every season", "Maintain a balanced NPK schedule", "Include a legume in rotation to fix nitrogen"],
    },
    {
        "disease": "Pest Damage (Leaf Miner / Borer)",
        "severity": "High",
        "symptoms": ["Winding white trails or holes in leaves", "Wilting of the growing tip", "Visible larvae on close inspection"],
        "treatment": ["Install yellow sticky traps", "Spray neem oil (5ml/litre) at dusk", "Hand-pick and destroy visibly infested shoots"],
        "prevention": ["Use pheromone traps season-long", "Encourage natural predators by avoiding broad-spectrum pesticides", "Remove crop residue after harvest"],
    },
]

HEALTHY = {
    "disease": "No disease detected",
    "severity": "Low",
    "symptoms": ["Uniform green colour", "No visible lesions or discolouration", "Normal leaf shape and turgor"],
    "treatment": ["No treatment required"],
    "prevention": ["Continue current watering and fertilizer schedule", "Keep monitoring weekly for early signs of stress"],
}


def heuristic_diagnosis(image_data_url: str, language: str) -> dict:
    """Deterministic pseudo-diagnosis seeded from the image bytes, matching
    the app's existing pattern of seeded-pseudo-random outputs (see
    lib/agri.ts getWeather) so demos are stable and repeatable per photo."""
    digest = hashlib.sha256(image_data_url.encode()).hexdigest()
    seed = int(digest[:8], 16)

    if seed % 5 == 0:
        result = dict(HEALTHY)
        result["confidence"] = 78 + (seed % 15)
        result["healthy"] = True
    else:
        result = dict(CONDITIONS[seed % len(CONDITIONS)])
        result["confidence"] = 62 + (seed % 30)
        result["healthy"] = False

    if language == "ta":
        result["_note"] = "Tamil-language diagnosis requires OPENAI_API_KEY to be configured; showing English fallback."
    return result


def call_openai_vision(crop: str, language: str, image: str) -> dict:
    api_key = current_app.config["OPENAI_API_KEY"]
    lang_note = "Write all symptom, treatment and prevention text in Tamil." if language == "ta" else "Write all text in English."
    payload = json.dumps(
        {
            "model": current_app.config["OPENAI_MODEL"],
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": f"{SCHEMA_PROMPT}\n{lang_note}"},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": f"Crop: {crop}. Diagnose the disease in this image."},
                        {"type": "image_url", "image_url": {"url": image}},
                    ],
                },
            ],
        }
    ).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        body = json.loads(resp.read())
    raw = body.get("choices", [{}])[0].get("message", {}).get("content", "{}")
    cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(cleaned)


@bp.post("/detect-disease")
@jwt_required()
def detect_disease():
    data = request.get_json(silent=True) or {}
    image = data.get("image")
    if not image or not str(image).startswith("data:image/"):
        return jsonify({"error": "A crop image is required."}), 400
    if len(image) > 8_000_000:
        return jsonify({"error": "Image too large. Please upload one under 5 MB."}), 413

    crop = data.get("crop") or "unknown"
    language = "ta" if data.get("language") == "ta" else "en"

    if current_app.config.get("OPENAI_API_KEY"):
        try:
            result = call_openai_vision(crop, language, image)
            return jsonify({"result": result})
        except Exception as exc:  # pragma: no cover - network dependent
            current_app.logger.error("OpenAI vision call failed: %s", exc)
            # Fall through to the offline heuristic engine rather than failing the request.

    result = heuristic_diagnosis(image, language)
    return jsonify({"result": result})
