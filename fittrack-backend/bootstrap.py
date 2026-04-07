from database import Base, engine
import models  # noqa: F401 - register SQLAlchemy models before create_all

from auto_migrate import run_auto_migration
from create_first_admin import create_first_admin


def bootstrap() -> None:
    Base.metadata.create_all(bind=engine)
    run_auto_migration(raise_on_error=True)
    create_first_admin()
    engine.dispose()


if __name__ == "__main__":
    bootstrap()
