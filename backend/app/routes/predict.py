from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app import agri

bp = Blueprint("predict", __name__, url_prefix="/api")

REQUIRED_FIELDS = ["crop", "farmSize", "rainfall", "temperature", "irrigation", "fertilizer", "soilQuality", "pestControl"]


def _parse_input(data: dict):
    if data.get("crop") not in agri.CROPS:
        return None, "crop must be one of: " + ", ".join(agri.CROP_LIST)
    try:
        parsed = {
            "crop": data["crop"],
            "farmSize": float(data.get("farmSize", 1)),
            "rainfall": float(data.get("rainfall", 0)),
            "temperature": float(data.get("temperature", 25)),
            "irrigation": float(data.get("irrigation", 0)),
            "fertilizer": float(data.get("fertilizer", 0)),
            "soilQuality": float(data.get("soilQuality", 50)),
            "pestControl": float(data.get("pestControl", 50)),
        }
        if data.get("marketPrice") is not None:
            parsed["marketPrice"] = float(data["marketPrice"])
    except (TypeError, ValueError):
        return None, "All numeric fields must be valid numbers."
    return parsed, None


@bp.post("/simulate")
@jwt_required()
def simulate_route():
    """Server-side equivalent of the client-side what-if simulation slider
    calculation — same agri.py engine, useful for headless/API consumers."""
    data = request.get_json(silent=True) or {}
    parsed, error = _parse_input(data)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(agri.simulate(parsed))


@bp.post("/predict")
@jwt_required()
def predict_route():
    """Alias of /simulate, matching the naming used elsewhere in the product
    spec (yield/profit/risk prediction)."""
    data = request.get_json(silent=True) or {}
    parsed, error = _parse_input(data)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(agri.simulate(parsed))


@bp.get("/weather")
@jwt_required()
def weather_route():
    location = request.args.get("location", "Tamil Nadu")
    return jsonify(agri.get_weather(location))


@bp.get("/climate-risk")
@jwt_required()
def climate_risk_route():
    location = request.args.get("location", "Tamil Nadu")
    crop = request.args.get("crop", "Rice")
    if crop not in agri.CROPS:
        return jsonify({"error": "crop must be one of: " + ", ".join(agri.CROP_LIST)}), 400
    weather = agri.get_weather(location)
    return jsonify(agri.climate_risk(weather, crop))
