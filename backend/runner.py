"""Search runner — executes camply searches as subprocesses."""

import json
import logging
import os
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path

import yaml
from sqlalchemy.orm import Session

from backend.database import AlertHistory, Search, Setting

logger = logging.getLogger(__name__)


def get_notification_env(db: Session) -> dict[str, str]:
    """Load notification-related env vars from settings table."""
    env_keys = [
        "EMAIL_TO_ADDRESS", "EMAIL_TO", "EMAIL_USERNAME", "EMAIL_PASSWORD",
        "EMAIL_SMTP_SERVER", "EMAIL_SMTP_PORT", 
        "EMAIL_FROM_ADDRESS", "EMAIL_SUBJECT_LINE",
        "PUSHOVER_PUSH_TOKEN", "PUSHOVER_PUSH_USER",
        "PUSHBULLET_API_TOKEN",
        "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID",
        "SLACK_WEBHOOK",
        "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN",
        "TWILIO_SOURCE_NUMBER", "TWILIO_DEST_NUMBER",
        "NTFY_TOPIC",
        "APPRISE_URL",
        "WEBHOOK_URL",
    ]
    env = {}
    settings = db.query(Setting).filter(Setting.key.in_(env_keys)).all()
    for s in settings:
        if s.value:
            if s.key == "EMAIL_TO" and "EMAIL_TO_ADDRESS" not in env:
                env["EMAIL_TO_ADDRESS"] = s.value
            env[s.key] = s.value
    return env


def run_search(search_id: int, db: Session) -> None:
    """Execute a single camply search."""
    search = db.query(Search).filter(Search.id == search_id).first()
    if not search:
        logger.error("Search %d not found", search_id)
        return

    # Mark as running
    search.status = "running"
    search.last_error = None
    db.commit()

    try:
        yaml_config = search.to_yaml_dict()

        # Make sure data directory exists
        data_dir = Path("data")
        data_dir.mkdir(exist_ok=True)

        results_path = data_dir / f"search_{search.id}_results.json"
        yaml_config["offline_search_path"] = str(results_path)

        # Load existing results to track what we've already seen
        existing_ids = set()
        if results_path.exists():
            try:
                with open(results_path) as f:
                    existing_data = json.load(f)
                    for item in existing_data:
                        key = f"{item.get('campsite_id', '')}_{item.get('booking_date', '')}"
                        existing_ids.add(key)
            except (json.JSONDecodeError, KeyError):
                pass

        # Write YAML config to temp file
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".yaml", delete=False, dir=str(data_dir)
        ) as f:
            yaml.dump(yaml_config, f)
            yaml_path = f.name

        is_error = False
        error_message = None

        try:
            # Build environment with notification settings
            env = os.environ.copy()
            env.update(get_notification_env(db))

            # Run camply
            result = subprocess.run(
                ["camply", "campsites", "--yaml-config", yaml_path],
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
                env=env,
            )

            log_path = data_dir / f"search_{search.id}_run.log"
            with open(log_path, "w") as logf:
                if result.stdout:
                    logf.write(result.stdout)
                if result.stderr:
                    logf.write("\n--- STDERR ---\n")
                    logf.write(result.stderr)

            if result.returncode != 0:
                logger.warning("camply stderr: %s", result.stderr[-500:] if result.stderr else "")
                is_error = True
                error_message = result.stderr[-500:] if result.stderr else "Process exited with non-zero status"

        finally:
            # Clean up temp YAML
            try:
                os.unlink(yaml_path)
            except OSError:
                pass

        # Parse results from offline search file
        if results_path.exists():
            try:
                with open(results_path) as f:
                    results = json.load(f)

                new_alerts = 0
                for item in results:
                    key = f"{item.get('campsite_id', '')}_{item.get('booking_date', '')}"
                    if key not in existing_ids:
                        alert = AlertHistory(
                            search_id=search.id,
                            campsite_name=item.get("campsite_name")
                            or item.get("facility_name", "Unknown"),
                            campsite_id=str(item.get("campsite_id", "")),
                            booking_date=item.get("booking_date", ""),
                            recreation_area=item.get("recreation_area", "")
                            or item.get("recreation_area_full_name", ""),
                            campground=item.get("facility_name", ""),
                            booking_url=item.get("booking_url", ""),
                            found_at=datetime.utcnow(),
                        )
                        db.add(alert)
                        new_alerts += 1

                if new_alerts > 0:
                    logger.info(
                        "Search %d (%s): Found %d new campsites. Disabling search.",
                        search.id, search.name, new_alerts,
                    )
                    search.enabled = False

            except (json.JSONDecodeError, KeyError) as e:
                logger.error("Error parsing results for search %d: %s", search.id, e)

        if is_error:
            search.status = "error"
            search.last_error = error_message
        else:
            search.status = "idle"
            search.last_error = None
        search.last_run_at = datetime.utcnow()
        db.commit()

    except subprocess.TimeoutExpired:
        search.status = "error"
        search.last_error = "Search timed out after 5 minutes"
        search.last_run_at = datetime.utcnow()
        db.commit()
        logger.error("Search %d timed out", search.id)

    except Exception as e:
        search.status = "error"
        search.last_error = str(e)[:500]
        search.last_run_at = datetime.utcnow()
        db.commit()
        logger.exception("Error running search %d", search.id)
