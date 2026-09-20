"""AI farming assistant.

The reference application proxied every request to Lovable's proprietary
"ai.gateway.lovable.dev" service using a LOVABLE_API_KEY. That gateway is
part of Lovable's platform and has no public equivalent, so it is removed
here per the Lovable-trace-removal requirement.

To keep the feature fully working without any external dependency, this
endpoint ships a deterministic, rule-based farming-assistant engine that
mirrors the same system prompt/structure (Possible issue / Recommendation
/ Farming tip) in English and Tamil, covering a broad set of common farming
topics with a contextual fallback (using the farmer's crop/location) instead
of a generic "please clarify" reply. If an OPENAI_API_KEY is configured in
the environment, the endpoint instead proxies to OpenAI's chat completions
API for richer, generative answers — a drop-in upgrade path with no code
changes required on the frontend.
"""

import json
import re
import urllib.request

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import jwt_required

bp = Blueprint("assistant", __name__, url_prefix="/api")

SYSTEM = {
    "en": (
        "You are FarmSphere AI, an expert farming assistant for Indian farmers (especially Tamil Nadu).\n"
        "Answer in English. Always structure your reply with these markdown headings:\n"
        "**Possible issue** — what is likely happening.\n"
        "**Recommendation** — concrete, low-cost steps in order.\n"
        "**Farming tip** — one extra practical tip.\n"
        "Be concise (max 180 words), practical, and mention organic options where sensible."
    ),
    "ta": (
        "நீங்கள் FarmSphere AI, இந்திய (குறிப்பாக தமிழ்நாடு) விவசாயிகளுக்கான நிபுணத்துவ உதவியாளர்.\n"
        "தமிழில் மட்டுமே பதிலளிக்கவும். பதிலை இந்த தலைப்புகளுடன் அமைக்கவும்:\n"
        "**சாத்தியமான பிரச்சனை**\n**பரிந்துரை**\n**விவசாய குறிப்பு**\n"
        "180 சொற்களுக்குள், எளிய நடைமுறை ஆலோசனை வழங்கவும்."
    ),
}

# Keyword → (issue, recommendation, tip) heuristic knowledge base, used when
# no external LLM is configured. Keys are matched case-insensitively against
# the farmer's latest message. Ordered roughly by how often farmers ask.
KB_EN = [
    (["yellow", "yellowing", "pale"], "Yellowing leaves usually signal nitrogen deficiency, overwatering, or early blight.",
     "1) Check soil moisture — reduce watering if waterlogged. 2) Apply a balanced NPK or urea top-dress in split doses. 3) Remove badly affected leaves to stop spread.",
     "A handful of neem cake worked into the topsoil improves nutrient uptake and deters early pests."),
    (["pest", "insect", "worm", "bug", "caterpillar", "aphid"], "Leaf damage, holes or sticky residue typically point to caterpillar, aphid or stem borer activity.",
     "1) Install pheromone traps at 8–10 per acre. 2) Spray neem oil (5ml/litre) in the evening. 3) Inspect the underside of leaves for egg clusters and remove by hand.",
     "Intercropping with marigold repels several common pests naturally."),
    (["water", "irrigat", "drought", "dry", "wilt"], "Wilting or dry soil suggests the crop's water demand is not being met.",
     "1) Irrigate early morning or late evening to cut evaporation loss. 2) Mulch the base with straw to retain moisture. 3) Switch to drip irrigation if water is limited.",
     "Check soil moisture at 10cm depth with a finger test before every irrigation cycle."),
    (["fertilizer", "nutrient", "npk", "urea", "manure"], "Poor growth or pale colour often indicates a nutrient imbalance.",
     "1) Get a soil test done before the next dose. 2) Apply fertilizer in 2–3 split doses rather than all at once. 3) Add organic matter (compost/FYM) to improve long-term fertility.",
     "Over-fertilizing wastes money and pollutes groundwater — follow the crop's ideal kg/acre rate."),
    (["disease", "fungus", "fungal", "blight", "rot", "spot", "mildew"], "Spots, rot or wilting patterns are commonly fungal or bacterial disease symptoms.",
     "1) Remove and destroy infected plant parts immediately. 2) Apply a copper-based or neem-based fungicide spray. 3) Improve airflow by spacing plants and avoiding overhead watering.",
     "Rotate crops each season to break the disease cycle in the soil."),
    (["price", "market", "sell", "mandi", "profit"], "Getting a fair price depends on timing, quality grading and market choice.",
     "1) Check nearby mandi prices before harvest. 2) Grade produce by size/quality to fetch a premium. 3) Consider FPO or direct-to-market routes to cut middleman margins.",
     "Selling in small staggered batches instead of all at once can help you catch better price days."),
    (["weed", "weeding"], "Weeds compete with the crop for nutrients, water and light, and can cut yield sharply if left unchecked.",
     "1) Hand-weed or hoe within the first 3–4 weeks — this is the most critical window. 2) Mulch between rows to suppress regrowth. 3) Use a pre-emergent herbicide only if the weed load is heavy, following label rates exactly.",
     "A stale seedbed (irrigate, let weeds sprout, then till before sowing) cuts season-long weed pressure."),
    (["soil", "ph", "acidic", "alkaline"], "Poor soil structure or an off pH range limits nutrient availability even when fertilizer is applied correctly.",
     "1) Test soil pH — most field crops prefer 6.0–7.5. 2) Add lime to raise pH or gypsum/organic matter to lower it. 3) Work in 2 t/acre farmyard manure to rebuild structure over a season.",
     "Healthy soil smells earthy and crumbles easily — hard, cracked soil is a sign to add organic matter."),
    (["seed", "sowing", "sow", "variety", "germinat"], "Sowing timing and seed quality strongly determine final stand and yield.",
     "1) Use certified, disease-free seed from a reliable source. 2) Treat seed with a fungicide or biofertilizer before sowing. 3) Sow at the recommended depth and spacing for your crop variety.",
     "A quick germination test (10 seeds on wet cloth) before sowing tells you if you need a higher seed rate."),
    (["harvest", "when to pick", "ripe", "maturity"], "Harvesting at the right maturity stage protects both yield and market price.",
     "1) Watch for the crop-specific maturity signs (grain hardness, colour change, moisture content). 2) Harvest in the cool part of the day to reduce spoilage. 3) Avoid delaying harvest past the optimal window — quality drops fast after.",
     "A simple moisture meter pays for itself quickly by preventing storage losses from harvesting too early or late."),
    (["storage", "store", "stored", "spoil", "spoilage"], "Post-harvest losses from poor storage can erase a season's profit even after a good harvest.",
     "1) Dry produce to the recommended moisture level before storing. 2) Use clean, pest-proof, well-ventilated storage bags or bins. 3) Check stored produce weekly for moisture, mould or pest damage.",
     "Neem leaves mixed into grain storage bags are a traditional, effective way to deter storage pests."),
    (["scheme", "subsidy", "loan", "insurance", "government"], "Several Indian government schemes can reduce costs and risk for smallholder farmers.",
     "1) Check PM-KISAN for direct income support if eligible. 2) Look into PMFBY (crop insurance) before the sowing-season deadline. 3) Visit your nearest Krishi Vigyan Kendra (KVK) or Common Service Centre for subsidy and soil-health-card guidance.",
     "Keep your land records and Aadhaar-linked bank account updated — most scheme delays come from mismatched paperwork."),
    (["rotation", "intercrop", "rotate"], "Repeating the same crop season after season depletes specific soil nutrients and builds up pest/disease pressure.",
     "1) Rotate with a legume (groundnut, pulses) every 2–3 seasons to rebuild nitrogen. 2) Avoid planting the same crop family back-to-back. 3) Consider intercropping to diversify income and reduce pest spread.",
     "Rotation is one of the few practices that improves yield, soil health and pest control all at once — for free."),
    (["organic", "chemical-free", "natural farming"], "Organic and natural farming trade some short-term yield for lower input cost and better long-term soil health.",
     "1) Build soil fertility with compost, vermicompost and green manure. 2) Use neem, panchagavya or jeevamrutham as biopesticide/biofertilizer. 3) Expect a 1–2 season transition period before yields stabilise.",
     "Organic certification can fetch a 15–30% price premium, but requires 2–3 years of documented chemical-free practice."),
    (["drip", "sprinkler"], "Drip and sprinkler systems can cut water use by 30–50% compared to flood irrigation, especially valuable in water-scarce areas.",
     "1) Get a system sized to your field by a local irrigation dealer or KVK. 2) Check for government drip-irrigation subsidy schemes (often 50–90% subsidised). 3) Flush the drip lines monthly to prevent clogging.",
     "Combine drip irrigation with mulching for the biggest water savings."),
    (["rain", "monsoon", "forecast"], "Rainfall timing directly affects sowing decisions, irrigation scheduling and disease risk.",
     "1) Check the Climate Risk page in this app for a 7-day rain and temperature outlook for your farm. 2) Delay sowing if heavy rain is forecast within the germination window. 3) Ensure field drains are clear before the monsoon peaks.",
     "Sowing 3–5 days after a confirmed rain event (not before) usually gives better, more even germination."),
    (["hi", "hello", "hey", "vanakkam"], "No specific issue mentioned yet — happy to help with your farm.",
     "Tell me your crop, the exact symptom or question, and (if relevant) when it started — for example leaf colour, pest sighting, soil condition, or a market/scheme question.",
     "You can also try the suggested questions above the chat box to get started quickly."),
]

KB_TA = [
    (["மஞ்சள"], "இலைகள் மஞ்சளாவது பொதுவாக நைட்ரஜன் குறைபாடு, அதிக நீர்ப்பாசனம் அல்லது ஆரம்பகட்ட நோயைக் குறிக்கிறது.",
     "1) மண் ஈரப்பதத்தை சரிபார்க்கவும் — அதிகமாக இருந்தால் நீர்ப்பாசனத்தை குறைக்கவும். 2) NPK அல்லது யூரியாவை பிரிவுகளாக இடவும். 3) பாதிக்கப்பட்ட இலைகளை அகற்றவும்.",
     "வேப்பம் பிண்ணாக்கு மண்ணில் சேர்ப்பது ஊட்டச்சத்து உறிஞ்சுதலை மேம்படுத்தும்."),
    (["பூச்சி", "புழு"], "இலை சேதம் பொதுவாக புழு அல்லது பூச்சி தாக்குதலைக் குறிக்கிறது.",
     "1) ஏக்கருக்கு 8-10 பெரோமோன் பொறிகளை வைக்கவும். 2) மாலையில் வேப்ப எண்ணெய் தெளிக்கவும். 3) இலைகளின் அடிப்பகுதியை பரிசோதிக்கவும்.",
     "சாமந்தி பயிரிடுவது இயற்கையாக பல பூச்சிகளை விரட்டும்."),
    (["நீர", "பாசன"], "வாடும் இலைகள் அல்லது வறண்ட மண் போதிய நீர் கிடைக்கவில்லை என்பதைக் காட்டுகிறது.",
     "1) அதிகாலை அல்லது மாலையில் நீர்ப்பாசனம் செய்யவும். 2) வைக்கோலால் மல்ச் செய்யவும். 3) துளி நீர்ப்பாசனத்திற்கு மாறவும்.",
     "ஒவ்வொரு பாசனத்திற்கு முன்னும் மண் ஈரப்பதத்தை விரலால் சோதிக்கவும்."),
    (["உரம"], "மோசமான வளர்ச்சி பொதுவாக ஊட்டச்சத்து சமநிலையின்மையைக் குறிக்கிறது.",
     "1) அடுத்த டோஸுக்கு முன் மண் பரிசோதனை செய்யவும். 2) உரத்தை 2-3 பிரிவுகளாக இடவும். 3) இயற்கை உரத்தை சேர்க்கவும்.",
     "தேவைக்கு அதிகமாக உரமிடுவது பணத்தையும் நிலத்தடி நீரையும் வீணாக்கும்."),
    (["நோய", "பூஞ்சை"], "புள்ளிகள், அழுகல் அல்லது வாடல் பொதுவாக பூஞ்சை அல்லது பாக்டீரியா நோயின் அறிகுறிகள்.",
     "1) பாதிக்கப்பட்ட பகுதிகளை உடனடியாக அகற்றவும். 2) தாமிரம் அல்லது வேப்ப அடிப்படையிலான மருந்தை தெளிக்கவும். 3) செடிகளுக்கு இடையே இடைவெளி வைத்து காற்றோட்டத்தை மேம்படுத்தவும்.",
     "ஒவ்வொரு பருவமும் பயிர் சுழற்சி செய்வது மண்ணில் நோய் சுழற்சியை உடைக்கும்."),
    (["விலை", "சந்தை", "மார்க்கெட்"], "நல்ல விலை பெற அறுவடை நேரம், தர வகைப்பாடு மற்றும் சந்தை தேர்வு முக்கியம்.",
     "1) அறுவடைக்கு முன் அருகிலுள்ள மண்டி விலைகளை சரிபார்க்கவும். 2) அளவு/தரத்தின் அடிப்படையில் வகைப்படுத்தவும். 3) இடைத்தரகர் இல்லாமல் நேரடி விற்பனையை பரிசீலிக்கவும்.",
     "ஒரே நேரத்தில் அல்லாமல் சிறு அளவுகளாக விற்பது சிறந்த விலை நாட்களைப் பிடிக்க உதவும்."),
    (["வணக்கம", "ஹலோ"], "இதுவரை குறிப்பிட்ட பிரச்சனை எதுவும் இல்லை — உங்கள் பண்ணைக்கு உதவ தயார்.",
     "உங்கள் பயிர், சரியான அறிகுறி அல்லது கேள்வியை, மற்றும் அது எப்போது தொடங்கியது என்பதைக் கூறவும்.",
     "விரைவாக தொடங்க மேலே உள்ள பரிந்துரைக்கப்பட்ட கேள்விகளையும் முயற்சிக்கலாம்."),
]


def heuristic_reply(question: str, lang: str, context: str) -> str:
    q = question.lower()
    kb = KB_TA if lang == "ta" else KB_EN
    for keywords, issue, rec, tip in kb:
        if any(k in q for k in keywords):
            if lang == "ta":
                return f"**சாத்தியமான பிரச்சனை**\n{issue}\n\n**பரிந்துரை**\n{rec}\n\n**விவசாய குறிப்பு**\n{tip}"
            return f"**Possible issue**\n{issue}\n\n**Recommendation**\n{rec}\n\n**Farming tip**\n{tip}"

    # No keyword matched — instead of a generic "please clarify" reply, give a
    # genuinely useful, contextual general-farming answer using the farmer's
    # own crop/location so the assistant always feels responsive.
    crop_match = re.search(r"crop ([A-Za-z]+)", context)
    crop = crop_match.group(1) if crop_match else None

    if lang == "ta":
        crop_line = f"{crop} பயிருக்கு " if crop else ""
        return (
            f"**சாத்தியமான பிரச்சனை**\nஉங்கள் கேள்வி {crop_line}பொதுவான பராமரிப்பு தொடர்பானதாக தெரிகிறது.\n\n"
            "**பரிந்துரை**\n1) மண் ஈரப்பதத்தையும் இலை நிறத்தையும் வாரம் ஒருமுறை சரிபார்க்கவும். "
            "2) பரிந்துரைக்கப்பட்ட உர அட்டவணையை பின்பற்றவும். 3) பூச்சி/நோய் அறிகுறிகளுக்காக வாரந்தோறும் வயலை நடக்கவும்.\n\n"
            "**விவசாய குறிப்பு**\nகுறிப்பிட்ட அறிகுறி (இலை நிறம், பூச்சி, விலை, சேமிப்பு) கூறினால் இன்னும் துல்லியமான பதில் தர முடியும்."
        )

    crop_line = f"for {crop} " if crop else ""
    return (
        f"**Possible issue**\nYour question looks like a general farm-management query {crop_line}rather than "
        "a specific symptom.\n\n**Recommendation**\n1) Check soil moisture and leaf colour weekly. "
        "2) Follow the crop's recommended fertilizer schedule (see the Profit and Sustainability pages for your crop's ideal kg/acre). "
        "3) Walk the field weekly to catch pest, disease or water-stress signs early.\n\n"
        "**Farming tip**\nAsk me about a specific symptom (leaf colour, pests, disease, water, market price, storage, "
        "government schemes, or crop rotation) for a more precise answer."
    )


def call_openai(system: str, history: list) -> str:
    api_key = current_app.config["OPENAI_API_KEY"]
    payload = json.dumps(
        {
            "model": current_app.config["OPENAI_MODEL"],
            "messages": [{"role": "system", "content": system}]
            + [{"role": m["role"], "content": str(m.get("content", ""))[:4000]} for m in history],
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
    return body.get("choices", [{}])[0].get("message", {}).get("content", "")


@bp.post("/assistant")
@jwt_required()
def assistant():
    data = request.get_json(silent=True) or {}
    history = data.get("messages")
    if not isinstance(history, list) or len(history) == 0:
        return jsonify({"error": "No message provided."}), 400
    history = history[-12:]

    lang = "ta" if data.get("language") == "ta" else "en"
    context = data.get("context") or "unknown"
    system = f"{SYSTEM[lang]}\n\nFarm context: {context}"

    if current_app.config.get("OPENAI_API_KEY"):
        try:
            reply = call_openai(system, history)
            if reply:
                return jsonify({"reply": reply})
        except Exception as exc:  # pragma: no cover - network dependent
            current_app.logger.error("OpenAI assistant call failed: %s", exc)
            # Fall through to the offline heuristic engine rather than failing the request.

    last_user = next((m.get("content", "") for m in reversed(history) if m.get("role") == "user"), "")
    reply = heuristic_reply(str(last_user), lang, str(context))
    return jsonify({"reply": reply})
