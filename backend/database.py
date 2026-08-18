"""Database models and setup for camply-web."""

import json
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    create_engine,
    event,
)
from sqlalchemy.orm import DeclarativeBase, Session, relationship, sessionmaker


DATABASE_URL = "sqlite:///data/camply-web.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, _connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


class Search(Base):
    """A saved campsite search configuration."""

    __tablename__ = "searches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    provider = Column(String(100), nullable=False, default="RecreationDotGov")

    # Location filters (stored as JSON arrays)
    recreation_area_ids = Column(Text, default="[]")  # JSON array
    campground_ids = Column(Text, default="[]")  # JSON array
    campsite_ids = Column(Text, default="[]")  # JSON array

    # Date filters
    start_date = Column(String(10), nullable=False)  # YYYY-MM-DD
    end_date = Column(String(10), nullable=False)  # YYYY-MM-DD

    # Search options
    days = Column(Text, default="[]")  # JSON array of day names
    weekends = Column(Boolean, default=False)
    nights = Column(Integer, default=1)
    equipment = Column(Text, default="[]")  # JSON array of [type, length] pairs

    # Execution options
    polling_interval = Column(Integer, default=10)  # minutes
    notifications = Column(String(100), default="silent")
    enabled = Column(Boolean, default=True)

    # Status tracking
    status = Column(String(20), default="idle")  # idle, running, error
    last_run_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    alerts = relationship(
        "AlertHistory", back_populates="search", cascade="all, delete-orphan"
    )

    def get_list_field(self, field_name: str) -> list:
        """Parse a JSON list field."""
        val = getattr(self, field_name)
        if not val:
            return []
        try:
            return json.loads(val)
        except (json.JSONDecodeError, TypeError):
            return []

    def to_yaml_dict(self) -> dict:
        """Convert to a dict suitable for camply YAML config."""
        config: dict = {
            "provider": self.provider,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "continuous": True,
            "search_forever": True,
            "search_once": True,
            "notifications": self.notifications,
            "polling_interval": max(self.polling_interval or 10, 5),
            "nights": self.nights or 1,
            "weekends": bool(self.weekends),
            "offline_search": True,
            "offline_search_path": f"data/search_{self.id}_results.json",
        }
        rec_areas = self.get_list_field("recreation_area_ids")
        if rec_areas:
            config["recreation_area"] = rec_areas
        campgrounds = self.get_list_field("campground_ids")
        if campgrounds:
            config["campgrounds"] = campgrounds
        campsites = self.get_list_field("campsite_ids")
        if campsites:
            config["campsites"] = campsites
        days = self.get_list_field("days")
        if days:
            config["days"] = days
        equipment = self.get_list_field("equipment")
        if equipment:
            config["equipment"] = equipment
        return config


class AlertHistory(Base):
    """Record of a campsite availability notification."""

    __tablename__ = "alert_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    search_id = Column(Integer, ForeignKey("searches.id"), nullable=False)
    campsite_name = Column(String(500), nullable=True)
    campsite_id = Column(String(100), nullable=True)
    booking_date = Column(String(10), nullable=True)  # YYYY-MM-DD
    recreation_area = Column(String(500), nullable=True)
    campground = Column(String(500), nullable=True)
    booking_url = Column(String(1000), nullable=True)
    found_at = Column(DateTime, default=datetime.utcnow)

    search = relationship("Search", back_populates="alerts")


class Setting(Base):
    """Key-value settings store."""

    __tablename__ = "settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=True)


def init_db():
    """Create all tables."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """FastAPI dependency for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
