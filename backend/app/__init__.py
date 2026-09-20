from flask import Flask, jsonify
from flask_cors import CORS

from config import Config

from app.extensions import db, jwt


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    db.init_app(app)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}}, supports_credentials=True)

    from app.routes.auth import bp as auth_bp
    from app.routes.farm import bp as farm_bp
    from app.routes.assistant import bp as assistant_bp
    from app.routes.disease import bp as disease_bp
    from app.routes.predict import bp as predict_bp
    from app.routes.intel import bp as intel_bp
    from app.routes.voice_doctor import bp as voice_doctor_bp
    from app.routes.tts import bp as tts_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(farm_bp)
    app.register_blueprint(assistant_bp)
    app.register_blueprint(disease_bp)
    app.register_blueprint(predict_bp)
    app.register_blueprint(intel_bp)
    app.register_blueprint(voice_doctor_bp)
    app.register_blueprint(tts_bp)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "service": "FarmSphere AI API"})

    @jwt.unauthorized_loader
    def _unauthorized(reason):
        return jsonify({"error": "Authentication required."}), 401

    @jwt.invalid_token_loader
    def _invalid(reason):
        return jsonify({"error": "Invalid or expired session. Please log in again."}), 401

    @jwt.expired_token_loader
    def _expired(header, payload):
        return jsonify({"error": "Session expired. Please log in again."}), 401

    with app.app_context():
        db.create_all()

    return app
