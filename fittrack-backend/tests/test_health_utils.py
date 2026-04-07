from pathlib import Path
import sys

from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

sys.path.append(str(Path(__file__).resolve().parents[1]))

from utils.health import check_database_connection


def test_check_database_connection_with_sqlite_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    assert check_database_connection(engine) is True


def test_check_database_connection_raises_for_invalid_engine():
    class BrokenEngine:
        def connect(self):
            raise RuntimeError("db unavailable")

    try:
        check_database_connection(BrokenEngine())
        assert False, "Expected an exception"
    except RuntimeError as exc:
        assert str(exc) == "db unavailable"
