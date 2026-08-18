"""APScheduler-based search scheduler."""

import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from backend.database import SessionLocal, Search
from backend.runner import run_search

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


def _run_search_job(search_id: int) -> None:
    """Job wrapper that creates its own DB session."""
    db = SessionLocal()
    try:
        run_search(search_id, db)
    finally:
        db.close()


def schedule_search(search: Search) -> None:
    """Add or update a search job in the scheduler."""
    job_id = f"search_{search.id}"

    # Remove existing job if present
    try:
        scheduler.remove_job(job_id)
    except Exception:
        pass

    if not search.enabled:
        logger.info("Search %d (%s) is disabled, not scheduling", search.id, search.name)
        return

    interval_minutes = max(search.polling_interval or 10, 5)
    scheduler.add_job(
        _run_search_job,
        trigger=IntervalTrigger(minutes=interval_minutes),
        id=job_id,
        args=[search.id],
        replace_existing=True,
        name=f"Search: {search.name}",
    )
    logger.info(
        "Scheduled search %d (%s) every %d minutes",
        search.id, search.name, interval_minutes,
    )


def unschedule_search(search_id: int) -> None:
    """Remove a search job from the scheduler."""
    job_id = f"search_{search_id}"
    try:
        scheduler.remove_job(job_id)
        logger.info("Unscheduled search %d", search_id)
    except Exception:
        pass


def load_all_searches() -> None:
    """Load all enabled searches from DB and schedule them."""
    db = SessionLocal()
    try:
        searches = db.query(Search).filter(Search.enabled == True).all()  # noqa: E712
        for search in searches:
            schedule_search(search)
        logger.info("Loaded %d enabled searches", len(searches))
    finally:
        db.close()


def start_scheduler() -> None:
    """Start the scheduler and load existing searches."""
    if not scheduler.running:
        scheduler.start()
        load_all_searches()
        logger.info("Scheduler started")


def shutdown_scheduler() -> None:
    """Shut down the scheduler."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler shut down")
