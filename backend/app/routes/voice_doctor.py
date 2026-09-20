"""Tamil Voice Farm Doctor — structured spoken diagnosis endpoint.

Like the assistant and disease-detection endpoints, the reference app
proxied this to Lovable's proprietary AI gateway. Removed per the
Lovable-trace-removal requirement. Ships a deterministic, rule-based
diagnosis engine (English + Tamil) that returns the same structured shape
the frontend expects: cause, probability, disease, action[], prevention[],
spoken. If OPENAI_API_KEY is configured, the endpoint instead calls
OpenAI for a generated diagnosis in the same JSON shape.
"""

import json
import urllib.request

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import jwt_required

bp = Blueprint("voice_doctor", __name__, url_prefix="/api")

SCHEMA_PROMPT_EN = (
    "You are a Tamil Nadu farm doctor. A farmer asked a spoken question about their crop. "
    "Reply ONLY with JSON: "
    '{"disease":"likely issue name","cause":"1-2 sentence explanation","probability":0-100,'
    '"action":["step 1","step 2","step 3"],"prevention":["tip 1","tip 2"],'
    '"spoken":"a short 2-3 sentence natural-language reply suitable for text-to-speech"}'
)
SCHEMA_PROMPT_TA = (
    "நீங்கள் தமிழ்நாடு பண்ணை மருத்துவர். விவசாயி பயிர் பற்றி பேசி கேட்டார். "
    "JSON மட்டும் பதிலளிக்கவும் (எல்லா உரையும் தமிழில்): "
    '{"disease":"சாத்தியமான பிரச்சனை","cause":"1-2 வாக்கிய விளக்கம்","probability":0-100,'
    '"action":["படி 1","படி 2","படி 3"],"prevention":["குறிப்பு 1","குறிப்பு 2"],'
    '"spoken":"text-to-speech க்கு ஏற்ற 2-3 வாக்கிய இயல்பான பதில்"}'
)

# (keywords, disease, cause, probability, action[], prevention[]) — English base;
# Tamil versions follow the same structure with translated text.
KB_EN = [
    (["yellow", "yellowing"], "Nitrogen deficiency / early blight", "Yellowing leaves usually point to a nitrogen shortage, waterlogging, or the early stage of a fungal disease.", 72,
     ["Check soil moisture and reduce watering if waterlogged", "Apply a balanced NPK or urea top-dress in split doses", "Remove and destroy the worst-affected leaves"],
     ["Get a soil test done every season", "Avoid overhead irrigation in humid weather"]),
    (["white spot", "spots", "spot"], "Bacterial or fungal leaf spot", "Small white or brown spots usually indicate a bacterial or fungal leaf-spot infection spreading from wet foliage.", 68,
     ["Remove infected leaves immediately", "Apply a copper-based fungicide spray", "Avoid working in the field when leaves are wet"],
     ["Use certified disease-free seed", "Space plants for better airflow"]),
    (["pest", "insect", "worm", "பூச்சி"], "Pest infestation", "Leaf damage or holes typically point to caterpillar, aphid or stem borer activity.", 70,
     ["Install pheromone traps at 8-10 per acre", "Spray neem oil (5ml/litre) in the evening", "Inspect the underside of leaves for egg clusters"],
     ["Intercrop with marigold to repel pests", "Encourage natural predators by avoiding broad-spectrum pesticide"]),
    (["fertilizer", "urea", "npk", "உரம்"], "Nutrient management question", "Getting the fertilizer dose and timing right is the biggest lever on yield after water.", 60,
     ["Get a soil test before your next dose", "Split fertilizer into 2-3 doses across the season", "Add organic matter (compost/FYM) for long-term fertility"],
     ["Avoid applying urea right before heavy rain", "Follow the crop's ideal kg/acre rate rather than guessing"]),
    (["water", "irrigat", "dry", "wilt", "நீர்"], "Water stress", "Wilting or dry soil suggests the crop's water demand is not currently being met.", 66,
     ["Irrigate early morning or late evening to cut evaporation loss", "Mulch the base with straw to retain moisture", "Check soil moisture at 10cm depth before every irrigation"],
     ["Consider drip irrigation if water is limited", "Watch the weekly forecast before skipping a watering cycle"]),
]

KB_TA = [
    (["மஞ்சள", "yellow"], "நைட்ரஜன் குறைபாடு / ஆரம்பகட்ட நோய்", "இலைகள் மஞ்சளாவது பொதுவாக நைட்ரஜன் குறைபாடு, அதிக நீர் அல்லது ஆரம்பகட்ட பூஞ்சை நோயைக் குறிக்கிறது.", 72,
     ["மண் ஈரப்பதத்தை சரிபார்த்து, அதிகமாக இருந்தால் நீர்ப்பாசனத்தை குறைக்கவும்", "NPK அல்லது யூரியாவை பிரிவுகளாக இடவும்", "மோசமாக பாதிக்கப்பட்ட இலைகளை அகற்றவும்"],
     ["ஒவ்வொரு பருவமும் மண் பரிசோதனை செய்யவும்", "ஈரப்பதமான காலநிலையில் மேலிருந்து நீர்ப்பாசனம் தவிர்க்கவும்"]),
    (["வெள்ளை புள்ளி", "புள்ளி"], "பாக்டீரியா அல்லது பூஞ்சை இலை புள்ளி", "சிறிய வெள்ளை அல்லது பழுப்பு புள்ளிகள் பொதுவாக பாக்டீரியா அல்லது பூஞ்சை நோய்த்தொற்றைக் குறிக்கும்.", 68,
     ["பாதிக்கப்பட்ட இலைகளை உடனடியாக அகற்றவும்", "தாமிர அடிப்படையிலான பூஞ்சைக்கொல்லியை தெளிக்கவும்", "இலைகள் ஈரமாக இருக்கும்போது வயலில் வேலை செய்வதை தவிர்க்கவும்"],
     ["சான்றளிக்கப்பட்ட நோய் இல்லாத விதையை பயன்படுத்தவும்", "காற்றோட்டத்திற்காக செடிகளுக்கு இடையே இடைவெளி வைக்கவும்"]),
    (["பூச்சி", "புழு"], "பூச்சி தாக்குதல்", "இலை சேதம் அல்லது துளைகள் பொதுவாக புழு அல்லது பூச்சி தாக்குதலைக் குறிக்கின்றன.", 70,
     ["ஏக்கருக்கு 8-10 பெரோமோன் பொறிகளை வைக்கவும்", "மாலையில் வேப்ப எண்ணெய் (5ml/லிட்டர்) தெளிக்கவும்", "இலைகளின் அடிப்பகுதியில் முட்டை கொத்துகளை பரிசோதிக்கவும்"],
     ["பூச்சிகளை விரட்ட சாமந்தி இடைப்பயிராக பயிரிடவும்", "இயற்கை எதிரிகளை ஊக்குவிக்க பரந்த-அளவிலான பூச்சிக்கொல்லியை தவிர்க்கவும்"]),
    (["உரம"], "ஊட்டச்சத்து மேலாண்மை கேள்வி", "உரத்தின் அளவும் நேரமும் சரியாக இருப்பது நீர் தவிர மகசூலை அதிகரிக்கும் முக்கிய காரணி.", 60,
     ["அடுத்த டோஸுக்கு முன் மண் பரிசோதனை செய்யவும்", "பருவம் முழுவதும் உரத்தை 2-3 பிரிவுகளாக இடவும்", "நீண்டகால வளத்திற்கு இயற்கை உரத்தை சேர்க்கவும்"],
     ["கனமழைக்கு முன் யூரியா இடுவதை தவிர்க்கவும்", "யூகிக்காமல் பயிரின் சிறந்த கிலோ/ஏக்கர் விகிதத்தை பின்பற்றவும்"]),
    (["நீர", "பாசன"], "நீர் அழுத்தம்", "வாடும் இலைகள் அல்லது வறண்ட மண் பயிரின் தற்போதைய நீர் தேவை பூர்த்தி செய்யப்படவில்லை என்பதைக் காட்டுகிறது.", 66,
     ["ஆவியாதலை குறைக்க அதிகாலை அல்லது மாலையில் நீர்ப்பாசனம் செய்யவும்", "ஈரப்பதத்தை தக்கவைக்க வைக்கோலால் மல்ச் செய்யவும்", "ஒவ்வொரு நீர்ப்பாசனத்திற்கு முன்பும் 10செ.மீ ஆழத்தில் மண் ஈரப்பதத்தை சரிபார்க்கவும்"],
     ["நீர் குறைவாக இருந்தால் துளி நீர்ப்பாசனத்தை பரிசீலிக்கவும்", "நீர்ப்பாசன சுழற்சியை தவிர்க்கும் முன் வார முன்னறிவிப்பை பார்க்கவும்"]),
]


def heuristic_diagnosis(query: str, lang: str) -> dict:
    q = query.lower()
    kb = KB_TA if lang == "ta" else KB_EN
    for keywords, disease, cause, prob, action, prevention in kb:
        if any(k in q for k in keywords):
            spoken = (
                f"{cause} {action[0]}." if lang != "ta" else f"{cause} {action[0]}."
            )
            return {
                "disease": disease,
                "cause": cause,
                "probability": prob,
                "action": action,
                "prevention": prevention,
                "spoken": spoken,
            }

    if lang == "ta":
        return {
            "disease": "பொதுவான பயிர் அழுத்தம்",
            "cause": "உங்கள் கேள்வி ஒரு குறிப்பிட்ட பிரச்சனையை விட பொதுவான அறிகுறியை விவரிக்கிறது — Crop Health பக்கத்தில் புகைப்படம் பதிவேற்றினால் இன்னும் துல்லியமாக அறியலாம்.",
            "probability": 45,
            "action": ["மண் ஈரப்பதத்தையும் இலை நிறத்தையும் வாரம் ஒருமுறை சரிபார்க்கவும்", "பரிந்துரைக்கப்பட்ட உர அட்டவணையை பின்பற்றவும்", "வாரந்தோறும் வயலை நடந்து பார்வையிடவும்"],
            "prevention": ["வாராந்திர குறிப்புகளை எழுதி வைக்கவும்", "புதிய அறிகுறி தென்பட்டால் Crop Health பக்கத்தில் புகைப்படம் எடுக்கவும்"],
            "spoken": "இது ஒரு பொதுவான பராமரிப்பு கேள்வியாக தெரிகிறது. மண் ஈரப்பதத்தையும் இலை நிறத்தையும் வாரந்தோறும் கண்காணித்து, பரிந்துரைக்கப்பட்ட உர அட்டவணையை பின்பற்றுங்கள். ஒரு புகைப்படம் பதிவேற்றினால் இன்னும் துல்லியமான ஆய்வு தர முடியும்.",
        }
    return {
        "disease": "General crop stress",
        "cause": "Your question describes a general symptom rather than one specific issue — a photo on the Crop Health page would help narrow it down.",
        "probability": 45,
        "action": ["Check soil moisture and leaf colour weekly", "Follow the crop's recommended fertilizer schedule", "Walk the field weekly to catch pest, disease or water-stress signs early"],
        "prevention": ["Keep a simple weekly log of what you observe", "Use the Crop Health page to photograph any new symptom"],
        "spoken": "This sounds like a general farm-management question. Keep an eye on soil moisture and leaf colour weekly, and follow the crop's recommended fertilizer schedule. Uploading a photo on the Crop Health page can give a more precise diagnosis.",
    }


def call_openai(system: str, query: str) -> dict:
    api_key = current_app.config["OPENAI_API_KEY"]
    payload = json.dumps(
        {
            "model": current_app.config["OPENAI_MODEL"],
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": query[:2000]},
            ],
        }
    ).encode()
    req = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=payload,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read())
    raw = body.get("choices", [{}])[0].get("message", {}).get("content", "{}")
    return json.loads(raw)


@bp.post("/voice-doctor")
@jwt_required()
def voice_doctor():
    data = request.get_json(silent=True) or {}
    query = (data.get("query") or "").strip()
    if not query:
        return jsonify({"error": "No question provided."}), 400
    if len(query) > 2000:
        return jsonify({"error": "Question is too long."}), 400

    lang = "ta" if data.get("language") == "ta" else "en"
    context = data.get("context") or "unknown"
    schema = SCHEMA_PROMPT_TA if lang == "ta" else SCHEMA_PROMPT_EN
    system = f"{schema}\n\nFarm context: {context}"

    if current_app.config.get("OPENAI_API_KEY"):
        try:
            result = call_openai(system, query)
            return jsonify({"result": result})
        except Exception as exc:  # pragma: no cover - network dependent
            current_app.logger.error("OpenAI voice-doctor call failed: %s", exc)
            # Fall through to the offline heuristic engine.

    result = heuristic_diagnosis(query, lang)
    return jsonify({"result": result})
