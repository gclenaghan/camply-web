"""FastAPI REST API routes."""

import json
import logging
from threading import Thread

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import AlertHistory, Search, Setting, get_db
from backend.runner import run_search
from backend.scheduler import schedule_search, unschedule_search
from backend.schemas import (
    NOTIFICATION_METHODS,
    PROVIDERS,
    AlertHistoryResponse,
    SearchCreate,
    SearchDetailResponse,
    SearchResponse,
    SearchUpdate,
    SettingsResponse,
    SettingsUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


def _search_to_response(search: Search) -> dict:
    """Convert a Search model to response dict."""
    return {
        "id": search.id,
        "name": search.name,
        "provider": search.provider,
        "recreation_area_ids": search.get_list_field("recreation_area_ids"),
        "campground_ids": search.get_list_field("campground_ids"),
        "campsite_ids": search.get_list_field("campsite_ids"),
        "start_date": search.start_date,
        "end_date": search.end_date,
        "days": search.get_list_field("days"),
        "weekends": search.weekends,
        "nights": search.nights,
        "equipment": search.get_list_field("equipment"),
        "polling_interval": search.polling_interval,
        "notifications": search.notifications,
        "enabled": search.enabled,
        "status": search.status,
        "last_run_at": search.last_run_at,
        "last_error": search.last_error,
        "created_at": search.created_at,
        "updated_at": search.updated_at,
        "alert_count": len(search.alerts),
    }


# --- Searches ---


@router.get("/searches", response_model=list[SearchResponse])
def list_searches(db: Session = Depends(get_db)):
    """List all saved searches."""
    searches = db.query(Search).order_by(Search.created_at.desc()).all()
    return [_search_to_response(s) for s in searches]


@router.post("/searches", response_model=SearchResponse, status_code=201)
def create_search(data: SearchCreate, db: Session = Depends(get_db)):
    """Create a new saved search."""
    search = Search(
        name=data.name,
        provider=data.provider,
        recreation_area_ids=json.dumps(data.recreation_area_ids),
        campground_ids=json.dumps(data.campground_ids),
        campsite_ids=json.dumps(data.campsite_ids),
        start_date=data.start_date,
        end_date=data.end_date,
        days=json.dumps(data.days),
        weekends=data.weekends,
        nights=data.nights,
        equipment=json.dumps(data.equipment),
        polling_interval=data.polling_interval,
        notifications=data.notifications,
        enabled=data.enabled,
    )
    db.add(search)
    db.commit()
    db.refresh(search)

    if search.enabled:
        schedule_search(search)

    return _search_to_response(search)


@router.get("/searches/{search_id}", response_model=SearchDetailResponse)
def get_search(search_id: int, db: Session = Depends(get_db)):
    """Get search details with alert history."""
    search = db.query(Search).filter(Search.id == search_id).first()
    if not search:
        raise HTTPException(status_code=404, detail="Search not found")

    resp = _search_to_response(search)
    resp["alerts"] = [
        AlertHistoryResponse.model_validate(a)
        for a in sorted(search.alerts, key=lambda x: x.found_at, reverse=True)
    ]
    return resp


@router.put("/searches/{search_id}", response_model=SearchResponse)
def update_search(search_id: int, data: SearchUpdate, db: Session = Depends(get_db)):
    """Update a saved search."""
    search = db.query(Search).filter(Search.id == search_id).first()
    if not search:
        raise HTTPException(status_code=404, detail="Search not found")

    update_data = data.model_dump(exclude_unset=True)
    json_fields = [
        "recreation_area_ids", "campground_ids", "campsite_ids",
        "days", "equipment",
    ]
    for key, value in update_data.items():
        if key in json_fields:
            setattr(search, key, json.dumps(value))
        else:
            setattr(search, key, value)

    db.commit()
    db.refresh(search)

    # Reschedule
    if search.enabled:
        schedule_search(search)
    else:
        unschedule_search(search.id)

    return _search_to_response(search)


@router.delete("/searches/{search_id}", status_code=204)
def delete_search(search_id: int, db: Session = Depends(get_db)):
    """Delete a saved search."""
    search = db.query(Search).filter(Search.id == search_id).first()
    if not search:
        raise HTTPException(status_code=404, detail="Search not found")

    unschedule_search(search.id)
    db.delete(search)
    db.commit()


@router.post("/searches/{search_id}/run", response_model=SearchResponse)
def trigger_run(search_id: int, db: Session = Depends(get_db)):
    """Trigger an immediate search run."""
    search = db.query(Search).filter(Search.id == search_id).first()
    if not search:
        raise HTTPException(status_code=404, detail="Search not found")

    if search.status == "running":
        raise HTTPException(status_code=409, detail="Search is already running")

    # Run in background thread so we don't block the response
    def _bg_run():
        from backend.database import SessionLocal
        session = SessionLocal()
        try:
            run_search(search_id, session)
        finally:
            session.close()

    thread = Thread(target=_bg_run, daemon=True)
    thread.start()

    search.status = "running"
    db.commit()
    db.refresh(search)
    return _search_to_response(search)


@router.get("/searches/{search_id}/history", response_model=list[AlertHistoryResponse])
def get_history(search_id: int, db: Session = Depends(get_db)):
    """Get alert history for a search."""
    search = db.query(Search).filter(Search.id == search_id).first()
    if not search:
        raise HTTPException(status_code=404, detail="Search not found")

    alerts = (
        db.query(AlertHistory)
        .filter(AlertHistory.search_id == search_id)
        .order_by(AlertHistory.found_at.desc())
        .all()
    )
    return alerts


# --- Settings ---


@router.get("/settings", response_model=SettingsResponse)
def get_settings(db: Session = Depends(get_db)):
    """Get all settings."""
    settings = db.query(Setting).all()
    return {"settings": {s.key: s.value or "" for s in settings}}


@router.put("/settings", response_model=SettingsResponse)
def update_settings(data: SettingsUpdate, db: Session = Depends(get_db)):
    """Update settings."""
    for key, value in data.settings.items():
        setting = db.query(Setting).filter(Setting.key == key).first()
        if setting:
            setting.value = value
        else:
            db.add(Setting(key=key, value=value))
    db.commit()

    settings = db.query(Setting).all()
    return {"settings": {s.key: s.value or "" for s in settings}}


# --- Providers & Notification Methods ---


@router.get("/providers")
def list_providers():
    """List available campsite providers."""
    return PROVIDERS


@router.get("/notification-methods")
def list_notification_methods():
    """List available notification methods."""
    return NOTIFICATION_METHODS
