from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config.settings import settings

SQLALCHEMY_DATABASE_URL = (f"postgresql://{settings.db_user}:{settings.db_password}@"
                           f"{settings.db_host}:{settings.db_port}/{settings.db_name}")

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={'options': '-csearch_path={}'.format('public')}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
