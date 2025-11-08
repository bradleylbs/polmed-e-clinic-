#!/usr/bin/env python3
"""Utility to force specialist assignments for a visit.

This helper script mirrors the behaviour of the front-end workflow toggle by
inserting (or removing) rows in the ``visit_specialists`` table. It is handy for
validating the backend path whenever the UI flow is unclear or not yet wired
for a given role.

Usage examples:

    # Require an ultrasound stage for visit 54
    python scripts/assign_specialist_stage.py --visit 54 --add ultrasound

    # Require both ultrasound and dentist stages
    python scripts/assign_specialist_stage.py --visit 54 --add ultrasound dentist

    # Remove a specialist stage if you need to reset
    python scripts/assign_specialist_stage.py --visit 54 --remove ultrasound

The script relies on the same environment variables (DB_HOST, DB_NAME, etc.)
that the Flask app uses. Defaults match the shared Azure instance so it can be
run without extra flags in most cases.
"""

from __future__ import annotations

import argparse
import os
from collections.abc import Iterable
from datetime import datetime

import mysql.connector
from mysql.connector import Error

# Reuse the default connection values from the other diagnostic scripts so we
# are pointing at the same database as the Flask API.
DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "db-polmed.mysql.database.azure.com"),
    "database": os.environ.get("DB_NAME", "palmed_clinic_erp"),
    "user": os.environ.get("DB_USER", "dbadmin"),
    "password": os.environ.get("DB_PASSWORD", "Polm3d!DB@2025"),
    "port": int(os.environ.get("DB_PORT", 3306)),
    "autocommit": False,
    "use_unicode": True,
    "charset": "utf8mb4",
    "ssl_disabled": False,
    "ssl_verify_cert": False,
    "ssl_verify_identity": False,
}

# Mirrors scripts/app.py so aliases such as "Ultrasound Scan" or the role name
# resolve to the canonical specialist key used by the API.
SPECIALIST_DEFINITIONS = {
    "dentist": {
        "role": "dentist",
        "label": "Dental Consultation",
        "note_type": "Dentist",
    },
    "optometrist": {
        "role": "optometrist",
        "label": "Optometry Assessment",
        "note_type": "Optometrist",
    },
    "audiologist": {
        "role": "audiologist",
        "label": "Audiology Assessment",
        "note_type": "Audiologist",
    },
    "gynaecologist": {
        "role": "gynaecologist",
        "label": "Gynaecology Consultation",
        "note_type": "Gynaecologist",
    },
    "ultrasound": {
        "role": "ultrasound",
        "label": "Ultrasound Scan",
        "note_type": "Ultrasound",
    },
    "psychology": {
        "role": "psychologist",
        "label": "Psychology Session",
        "note_type": "Psychology",
    },
}

ALIASES: dict[str, str] = {}
for key, meta in SPECIALIST_DEFINITIONS.items():
    for alias in {key, meta["role"], meta["label"], meta["note_type"]}:
        ALIASES[alias.strip().lower().replace(" ", "_")] = key


def normalise_specialist(values: Iterable[str]) -> list[str]:
    """Convert incoming labels into canonical specialist keys."""
    resolved: list[str] = []
    for value in values:
        alias = str(value).strip().lower().replace(" ", "_")
        key = ALIASES.get(alias)
        if not key:
            raise ValueError(f"Unknown specialist alias '{value}'. Valid options: {sorted(SPECIALIST_DEFINITIONS)}")
        resolved.append(key)
    return resolved


def ensure_visit_exists(cursor, visit_id: int) -> None:
    cursor.execute("SELECT id FROM patient_visits WHERE id = %s", (visit_id,))
    if cursor.fetchone() is None:
        raise ValueError(f"Visit {visit_id} does not exist in patient_visits")


def insert_specialists(cursor, visit_id: int, specialists: list[str]) -> None:
    now = datetime.utcnow()
    statement = (
        """
        INSERT INTO visit_specialists (visit_id, specialist_type, required, created_at, updated_at)
        VALUES (%s, %s, 1, %s, %s)
        ON DUPLICATE KEY UPDATE
            required = VALUES(required),
            updated_at = VALUES(updated_at),
            completed_at = CASE WHEN VALUES(required) = 1 THEN completed_at ELSE NULL END,
            completed_by = CASE WHEN VALUES(required) = 1 THEN completed_by ELSE NULL END,
            notes = CASE WHEN VALUES(required) = 1 THEN notes ELSE NULL END
        """
    )
    for specialist in specialists:
        cursor.execute(statement, (visit_id, specialist, now, now))


def remove_specialists(cursor, visit_id: int, specialists: list[str]) -> None:
    cursor.executemany(
        "DELETE FROM visit_specialists WHERE visit_id = %s AND specialist_type = %s",
        [(visit_id, specialist) for specialist in specialists],
    )


def fetch_snapshot(cursor, visit_id: int) -> list[dict[str, object]]:
    cursor.execute(
        """
        SELECT visit_id, specialist_type, required, completed_at, created_at, updated_at
        FROM visit_specialists
        WHERE visit_id = %s
        ORDER BY specialist_type
        """,
        (visit_id,),
    )
    return cursor.fetchall() or []


def main() -> None:
    parser = argparse.ArgumentParser(description="Force specialist assignments for a visit")
    parser.add_argument("--visit", type=int, required=True, help="Visit ID to update")
    parser.add_argument(
        "--add",
        nargs="*",
        default=[],
        metavar="SPECIALIST",
        help="Specialist stages to require (e.g. ultrasound optometrist)",
    )
    parser.add_argument(
        "--remove",
        nargs="*",
        default=[],
        metavar="SPECIALIST",
        help="Specialist stages to remove/reset",
    )
    args = parser.parse_args()

    if not args.add and not args.remove:
        raise SystemExit("Specify at least one specialist to --add or --remove")

    add_list = normalise_specialist(args.add) if args.add else []
    remove_list = normalise_specialist(args.remove) if args.remove else []

    connection = None
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)

        ensure_visit_exists(cursor, args.visit)

        if add_list:
            insert_specialists(cursor, args.visit, add_list)
        if remove_list:
            remove_specialists(cursor, args.visit, remove_list)

        connection.commit()

        snapshot = fetch_snapshot(cursor, args.visit)
        print("Updated specialist assignments for visit", args.visit)
        if not snapshot:
            print("  (no specialist rows present)")
        else:
            for row in snapshot:
                status = "required" if row["required"] else "optional"
                completed = "completed" if row["completed_at"] else "pending"
                print(f"  - {row['specialist_type']}: {status}, {completed}, created {row['created_at']}")

    except Error as exc:
        if connection:
            connection.rollback()
        raise SystemExit(f"Database error: {exc}")
    finally:
        if connection:
            connection.close()


if __name__ == "__main__":
    main()
