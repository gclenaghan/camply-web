"""Pydantic schemas for API request/response models."""

from datetime import datetime

from pydantic import BaseModel, Field


class SearchCreate(BaseModel):
    """Schema for creating a new search."""

    name: str = Field(..., min_length=1, max_length=255)
    provider: str = Field(default="RecreationDotGov")
    recreation_area_ids: list[int | str] = Field(default_factory=list)
    campground_ids: list[int | str] = Field(default_factory=list)
    campsite_ids: list[int | str] = Field(default_factory=list)
    start_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    end_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    days: list[str] = Field(default_factory=list)
    weekends: bool = False
    nights: int = Field(default=1, ge=1)
    equipment: list[list] = Field(default_factory=list)
    polling_interval: int = Field(default=10, ge=5)
    notifications: str = Field(default="silent")
    enabled: bool = True


class SearchUpdate(BaseModel):
    """Schema for updating a search."""

    name: str | None = None
    provider: str | None = None
    recreation_area_ids: list[int | str] | None = None
    campground_ids: list[int | str] | None = None
    campsite_ids: list[int | str] | None = None
    start_date: str | None = None
    end_date: str | None = None
    days: list[str] | None = None
    weekends: bool | None = None
    nights: int | None = None
    equipment: list[list] | None = None
    polling_interval: int | None = None
    notifications: str | None = None
    enabled: bool | None = None


class AlertHistoryResponse(BaseModel):
    """Schema for alert history entries."""

    id: int
    search_id: int
    campsite_name: str | None
    campsite_id: str | None
    booking_date: str | None
    recreation_area: str | None
    campground: str | None
    booking_url: str | None
    found_at: datetime

    class Config:
        from_attributes = True


class SearchResponse(BaseModel):
    """Schema for search responses."""

    id: int
    name: str
    provider: str
    recreation_area_ids: list[int | str]
    campground_ids: list[int | str]
    campsite_ids: list[int | str]
    start_date: str
    end_date: str
    days: list[str]
    weekends: bool
    nights: int
    equipment: list[list]
    polling_interval: int
    notifications: str
    enabled: bool
    status: str
    last_run_at: datetime | None
    last_error: str | None
    created_at: datetime
    updated_at: datetime
    alert_count: int = 0

    class Config:
        from_attributes = True


class SearchDetailResponse(SearchResponse):
    """Schema for search detail with alert history."""

    alerts: list[AlertHistoryResponse] = []


class SettingsResponse(BaseModel):
    """Schema for settings."""

    settings: dict[str, str]


class SettingsUpdate(BaseModel):
    """Schema for updating settings."""

    settings: dict[str, str]


PROVIDERS = [
    {"id": "RecreationDotGov", "name": "Recreation.gov", "description": "Federal campgrounds across the USA"},
    {"id": "Yellowstone", "name": "Yellowstone", "description": "Yellowstone National Park Lodges"},
    {"id": "GoingToCamp", "name": "GoingToCamp", "description": "Parks Canada, WA/WI/MI State Parks, BC Parks, and more"},
    {"id": "ReserveCalifornia", "name": "ReserveCalifornia", "description": "California State Parks"},
    {"id": "AlabamaStateParks", "name": "Alabama State Parks", "description": "ReserveAlaPark.com"},
    {"id": "ArizonaStateParks", "name": "Arizona State Parks", "description": "AZStateParks.com"},
    {"id": "FloridaStateParks", "name": "Florida State Parks", "description": "FloridaStateParks.org"},
    {"id": "MinnesotaStateParks", "name": "Minnesota State Parks", "description": "ReserveMN.usedirect.com"},
    {"id": "MissouriStateParks", "name": "Missouri State Parks", "description": "icampmo1.usedirect.com"},
    {"id": "OhioStateParks", "name": "Ohio State Parks", "description": "ReserveOhio.com"},
    {"id": "VirginiaStateParks", "name": "Virginia State Parks", "description": "ReserveVAParks.com"},
    {"id": "NorthernTerritory", "name": "Northern Territory (AU)", "description": "Australian Northern Territory"},
    {"id": "FairfaxCountyParks", "name": "Fairfax County Parks", "description": "Fairfax County, Virginia"},
    {"id": "MaricopaCountyParks", "name": "Maricopa County Parks", "description": "Maricopa County, Arizona"},
    {"id": "OregonMetro", "name": "Oregon Metro", "description": "Portland Metro area"},
    {"id": "RecreationDotGovTicket", "name": "Recreation.gov (Tickets)", "description": "Tours & Tickets on Recreation.gov"},
    {"id": "RecreationDotGovTimedEntry", "name": "Recreation.gov (Timed Entry)", "description": "Timed entries on Recreation.gov"},
    {"id": "RecreationDotGovDailyTicket", "name": "Recreation.gov (Daily Ticket)", "description": "Daily tickets on Recreation.gov"},
    {"id": "RecreationDotGovDailyTimedEntry", "name": "Recreation.gov (Daily Timed Entry)", "description": "Daily timed entries on Recreation.gov"},
]

NOTIFICATION_METHODS = [
    {"id": "silent", "name": "Silent (log only)", "env_vars": []},
    {"id": "email", "name": "Email", "env_vars": ["EMAIL_TO_ADDRESS", "EMAIL_USERNAME", "EMAIL_PASSWORD", "EMAIL_SMTP_SERVER", "EMAIL_SMTP_PORT", "EMAIL_FROM_ADDRESS", "EMAIL_SUBJECT_LINE"]},
    {"id": "pushover", "name": "Pushover", "env_vars": ["PUSHOVER_PUSH_TOKEN", "PUSHOVER_PUSH_USER"]},
    {"id": "pushbullet", "name": "Pushbullet", "env_vars": ["PUSHBULLET_API_TOKEN"]},
    {"id": "telegram", "name": "Telegram", "env_vars": ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]},
    {"id": "slack", "name": "Slack", "env_vars": ["SLACK_WEBHOOK"]},
    {"id": "twilio", "name": "Twilio (SMS)", "env_vars": ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_SOURCE_NUMBER", "TWILIO_DEST_NUMBER"]},
    {"id": "ntfy", "name": "ntfy", "env_vars": ["NTFY_TOPIC"]},
    {"id": "apprise", "name": "Apprise", "env_vars": ["APPRISE_URL"]},
    {"id": "webhook", "name": "Webhook", "env_vars": ["WEBHOOK_URL"]},
]
