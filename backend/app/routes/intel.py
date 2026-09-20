from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.models import DiseaseScan, VoiceConsultation

bp = Blueprint("intel", __name__, url_prefix="/api")


@bp.get("/disease-scans")
@jwt_required()
def list_scans():
    user_id = get_jwt_identity()
    scans = (
        DiseaseScan.query.filter_by(user_id=user_id)
        .order_by(DiseaseScan.created_at.desc())
        .limit(200)
        .all()
    )
    return jsonify({"scans": [s.to_dict() for s in scans]})


@bp.post("/disease-scans")
@jwt_required()
def save_scan():
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}

    disease = (data.get("disease") or "").strip()
    if not disease:
        return jsonify({"error": "disease is required."}), 400

    try:
        scan = DiseaseScan(
            user_id=user_id,
            crop=(data.get("crop") or "Unknown")[:64],
            disease=disease[:255],
            confidence=float(data.get("confidence", 0)),
            severity=float(data.get("severity", 0)),
            affected_area=float(data.get("affected_area", 0)),
            risk_level=(data.get("risk_level") or "Low")[:16],
            healthy=bool(data.get("healthy", False)),
        )
    except (TypeError, ValueError):
        return jsonify({"error": "confidence, severity and affected_area must be numbers."}), 400

    db.session.add(scan)
    db.session.commit()
    return jsonify({"scan": scan.to_dict()}), 201


@bp.get("/voice-consultations")
@jwt_required()
def list_consultations():
    user_id = get_jwt_identity()
    rows = (
        VoiceConsultation.query.filter_by(user_id=user_id)
        .order_by(VoiceConsultation.created_at.desc())
        .limit(100)
        .all()
    )
    return jsonify({"consultations": [r.to_dict() for r in rows]})


@bp.post("/voice-consultations")
@jwt_required()
def save_consultation():
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}

    query_text = (data.get("query") or "").strip()
    response_text = (data.get("response") or "").strip()
    if not query_text or not response_text:
        return jsonify({"error": "query and response are required."}), 400

    row = VoiceConsultation(
        user_id=user_id,
        language=(data.get("language") or "ta")[:8],
        query_text=query_text[:2000],
        response=response_text[:2000],
        status=(data.get("status") or "Answered")[:32],
    )
    db.session.add(row)
    db.session.commit()
    return jsonify({"consultation": row.to_dict()}), 201
