from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.models import Farm, FarmZone, Profile

bp = Blueprint("farm", __name__, url_prefix="/api")


@bp.get("/farm-data")
@jwt_required()
def farm_data():
    user_id = get_jwt_identity()
    profile = Profile.query.get(user_id)
    farm = Farm.query.filter_by(user_id=user_id).order_by(Farm.created_at.asc()).first()
    zones = FarmZone.query.filter_by(user_id=user_id).all()
    if farm:
        zones = [z for z in zones if z.farm_id == farm.id]

    return jsonify(
        {
            "profile": profile.to_dict() if profile else None,
            "farm": farm.to_dict() if farm else None,
            "zones": [z.to_dict() for z in zones],
        }
    )


@bp.put("/profile")
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    profile = Profile.query.get(user_id)
    if not profile:
        return jsonify({"error": "Profile not found."}), 404

    data = request.get_json(silent=True) or {}

    if "full_name" in data:
        name = (data["full_name"] or "").strip()
        if not name or len(name) > 80:
            return jsonify({"error": "Full name must be between 1 and 80 characters."}), 400
        profile.full_name = name
    if "location" in data:
        loc = (data["location"] or "").strip()
        if not loc or len(loc) > 80:
            return jsonify({"error": "Location must be between 1 and 80 characters."}), 400
        profile.location = loc
    if "farm_size" in data:
        try:
            size = float(data["farm_size"])
        except (TypeError, ValueError):
            return jsonify({"error": "Farm size must be a number."}), 400
        if size <= 0 or size > 10000:
            return jsonify({"error": "Farm size must be between 0.1 and 10000 acres."}), 400
        profile.farm_size = size
    if "phone" in data:
        profile.phone = (data["phone"] or "").strip()[:20] or None
    if "preferred_crops" in data:
        crops = data["preferred_crops"]
        if not isinstance(crops, list) or len(crops) > 10:
            return jsonify({"error": "Preferred crops must be a list of at most 10 items."}), 400
        profile.preferred_crops = [str(c)[:40] for c in crops]
    if "language" in data and data["language"] in ("en", "ta"):
        profile.language = data["language"]

    db.session.commit()
    return jsonify({"profile": profile.to_dict()})


@bp.put("/farm")
@jwt_required()
def save_farm():
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}

    farm = Farm.query.filter_by(user_id=user_id).order_by(Farm.created_at.asc()).first()
    if not farm:
        farm = Farm(user_id=user_id)
        db.session.add(farm)

    farm.name = (data.get("name") or farm.name or "My Farm").strip()[:255]
    farm.location = (data.get("location") or farm.location or "").strip()[:255]
    try:
        farm.total_area = max(0.1, float(data.get("total_area", farm.total_area or 1)))
    except (TypeError, ValueError):
        return jsonify({"error": "Total area must be a number."}), 400
    farm.soil_type = data.get("soil_type", farm.soil_type)
    farm.water_source = data.get("water_source", farm.water_source)
    farm.current_crop = data.get("current_crop", farm.current_crop)

    db.session.commit()
    return jsonify({"farm": farm.to_dict()})
