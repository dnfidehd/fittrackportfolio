from sqlalchemy import text


def check_database_connection(db_engine) -> bool:
    with db_engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return True
