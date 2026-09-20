import uuid
from datetime import datetime, timezone

from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db


def gen_uuid() -> str:
    return str(uuid.uuid4())


def utcnow():
    return datetime.now(timezone.utc)


class User(db.Model):
    """Farmer login credentials. Replaces Supabase's auth.users table."""

    __tablename__ = "users"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)

    profile = db.relationship("Profile", backref="user", uselist=False, cascade="all, delete-orphan")
    farms = db.relationship("Farm", backref="user", cascade="all, delete-orphan")
    zones = db.relationship("FarmZone", backref="user", cascade="all, delete-orphan")

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)


class Profile(db.Model):
    """Farmer profile — mirrors public.profiles."""

    __tablename__ = "profiles"

    id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    full_name = db.Column(db.String(255), nullable=False, default="")
    location = db.Column(db.String(255), nullable=False, default="")
    farm_size = db.Column(db.Numeric, nullable=False, default=0)
    preferred_crops = db.Column(db.JSON, nullable=False, default=list)
    phone = db.Column(db.String(32), nullable=True)
    language = db.Column(db.String(8), nullable=False, default="en")
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "full_name": self.full_name,
            "location": self.location,
            "farm_size": float(self.farm_size or 0),
            "preferred_crops": self.preferred_crops or [],
            "phone": self.phone,
            "language": self.language,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class Farm(db.Model):
    """A farmer's farm — mirrors public.farms."""

    __tablename__ = "farms"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = db.Column(db.String(255), nullable=False, default="My Farm")
    location = db.Column(db.String(255), nullable=False, default="")
    total_area = db.Column(db.Numeric, nullable=False, default=5)
    soil_type = db.Column(db.String(64), nullable=False, default="Loamy")
    water_source = db.Column(db.String(64), nullable=False, default="Borewell")
    current_crop = db.Column(db.String(64), nullable=False, default="Rice")
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)
    updated_at = db.Column(db.DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    zones = db.relationship("FarmZone", backref="farm", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "location": self.location,
            "total_area": float(self.total_area or 0),
            "soil_type": self.soil_type,
            "water_source": self.water_source,
            "current_crop": self.current_crop,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class FarmZone(db.Model):
    """A crop zone within a farm — mirrors public.farm_zones."""

    __tablename__ = "farm_zones"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    farm_id = db.Column(db.String(36), db.ForeignKey("farms.id", ondelete="CASCADE"), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    crop = db.Column(db.String(64), nullable=False)
    area = db.Column(db.Numeric, nullable=False, default=1)
    health_score = db.Column(db.Integer, nullable=False, default=80)
    soil_moisture = db.Column(db.Integer, nullable=False, default=50)
    growth_stage = db.Column(db.String(64), nullable=False, default="Vegetative")
    grid_x = db.Column(db.Integer, nullable=False, default=0)
    grid_y = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "farm_id": self.farm_id,
            "user_id": self.user_id,
            "name": self.name,
            "crop": self.crop,
            "area": float(self.area or 0),
            "health_score": self.health_score,
            "soil_moisture": self.soil_moisture,
            "growth_stage": self.growth_stage,
            "grid_x": self.grid_x,
            "grid_y": self.grid_y,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class DiseaseScan(db.Model):
    """A saved crop-health scan result — mirrors public.disease_scans."""

    __tablename__ = "disease_scans"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    crop = db.Column(db.String(64), nullable=False, default="Unknown")
    disease = db.Column(db.String(255), nullable=False)
    confidence = db.Column(db.Numeric, nullable=False, default=0)
    severity = db.Column(db.Numeric, nullable=False, default=0)
    affected_area = db.Column(db.Numeric, nullable=False, default=0)
    risk_level = db.Column(db.String(16), nullable=False, default="Low")
    healthy = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "crop": self.crop,
            "disease": self.disease,
            "confidence": float(self.confidence or 0),
            "severity": float(self.severity or 0),
            "affected_area": float(self.affected_area or 0),
            "risk_level": self.risk_level,
            "healthy": self.healthy,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class VoiceConsultation(db.Model):
    """A saved Voice Farm Doctor consultation — mirrors public.voice_consultations."""

    __tablename__ = "voice_consultations"

    id = db.Column(db.String(36), primary_key=True, default=gen_uuid)
    user_id = db.Column(db.String(36), db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    language = db.Column(db.String(8), nullable=False, default="ta")
    # Named query_text in Python (not `query`) because SQLAlchemy models
    # already expose a `.query` class attribute — a column named `query`
    # would shadow it. The underlying/JSON field name stays "query".
    query_text = db.Column("query", db.Text, nullable=False)
    response = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(32), nullable=False, default="Answered")
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "language": self.language,
            "query": self.query_text,
            "response": self.response,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


def provision_new_farmer(user: User, full_name: str, location: str, farm_size: float):
    """Python port of the `handle_new_farmer` Postgres trigger: creates a
    default profile, farm and starter crop zones for a newly registered user.
    """
    profile = Profile(
        id=user.id,
        full_name=full_name or "",
        location=location or "",
        farm_size=farm_size or 5,
    )
    db.session.add(profile)

    farm = Farm(
        user_id=user.id,
        name=f"{full_name}'s Farm" if full_name else "My Farm",
        location=location or "Tamil Nadu, India",
        total_area=farm_size or 5,
    )
    db.session.add(farm)
    db.session.flush()  # populate farm.id

    starter_zones = [
        ("North Field", "Rice", 2.0, 88, 62, "Flowering", 0, 0),
        ("East Field", "Sugarcane", 1.5, 74, 48, "Vegetative", 1, 0),
        ("South Field", "Groundnut", 1.0, 91, 55, "Maturity", 0, 1),
        ("West Field", "Cotton", 0.5, 63, 34, "Seedling", 1, 1),
    ]
    for name, crop, area, health, moisture, stage, gx, gy in starter_zones:
        db.session.add(
            FarmZone(
                farm_id=farm.id,
                user_id=user.id,
                name=name,
                crop=crop,
                area=area,
                health_score=health,
                soil_moisture=moisture,
                growth_stage=stage,
                grid_x=gx,
                grid_y=gy,
            )
        )

    return profile, farm
