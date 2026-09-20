import re

from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from app.extensions import db
from app.models import User, provision_new_farmer

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    full_name = (data.get("full_name") or "").strip()
    location = (data.get("location") or "").strip()
    farm_size = data.get("farm_size") or 5

    if not EMAIL_RE.match(email):
        return jsonify({"error": "Please enter a valid email address."}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400
    if not full_name:
        return jsonify({"error": "Full name is required."}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with this email already exists."}), 409

    user = User(email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.flush()  # populate user.id before provisioning related rows

    # Mirrors the original Postgres `handle_new_farmer` trigger: automatically
    # creates a profile, farm and starter crop zones for every new farmer.
    provision_new_farmer(user, full_name, location, float(farm_size))

    db.session.commit()

    token = create_access_token(identity=user.id)
    return jsonify({"token": token, "user": {"id": user.id, "email": user.email}}), 201


@bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({"error": "Invalid email or password."}), 401

    token = create_access_token(identity=user.id)
    return jsonify({"token": token, "user": {"id": user.id, "email": user.email}})


@bp.get("/me")
@jwt_required()
def me():
    user = User.query.get(get_jwt_identity())
    if not user:
        return jsonify({"error": "Not found"}), 404
    return jsonify({"user": {"id": user.id, "email": user.email}})
