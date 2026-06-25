from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.orm import sessionmaker
from app.config import get_settings

settings = get_settings()

# We need check_same_thread: False only for SQLite because FastAPI handles requests
# in separate threads, and SQLite by default restricts connection sharing.
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {},
    echo=False
)

# Use SQLModel's Session class with standard sessionmaker
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=Session
)


def get_session():
    """Dependency injection generator to yield database sessions.

    Guarantees the session is closed after the request lifecycle completes.
    """
    with SessionLocal() as session:
        yield session


def create_db_and_tables():
    """Initializes the database and creates all tables defined in SQLModel schemas.
    Seeds default AppSettings if they do not already exist.
    """
    SQLModel.metadata.create_all(engine)
    
    from app.models.settings import AppSetting
    from sqlmodel import select
    
    with SessionLocal() as session:
        defaults = {
            "tech_concentration_threshold": ("40", "Alert threshold for tech sector concentration percentage"),
            "single_stock_threshold": ("20", "Alert threshold for any single stock allocation percentage"),
            "drawdown_alert_pct": ("15", "Alert threshold for stock/RSU drawdown percentage from average cost"),
            "earnings_warning_days": ("7", "Number of days before earnings to trigger warning"),
            "monthly_review_day": ("1", "Day of the month to run the automated portfolio analysis (1-28)")
        }
        for key, (val, desc) in defaults.items():
            existing = session.exec(select(AppSetting).where(AppSetting.key == key)).first()
            if not existing:
                setting = AppSetting(key=key, value=val, description=desc)
                session.add(setting)
        session.commit()

