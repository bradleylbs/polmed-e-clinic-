#!/usr/bin/env python3
"""Quick report to check specialist assignments and referrals."""

import os
from datetime import datetime

import mysql.connector
from mysql.connector import Error

SPECIALIST_TYPES = {
    "dentist",
    "optometrist",
    "audiologist",
    "gynaecologist",
    "ultrasound",
    "psychologist",
}

# Reuse the same defaults as the Flask app / seed script
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


def fetch_rows(query: str, params: tuple | None = None):
    connection = None
    cursor = None
    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, params or ())
        return cursor.fetchall()
    except Error as exc:  # pragma: no cover - diagnostic helper
        print(f"ERROR: {exc}")
        return None
    finally:
        if cursor is not None:
            cursor.close()
        if connection is not None and connection.is_connected():
            connection.close()


def main():
    print("=== Specialist Assignment Snapshot ===")
    assignment_rows = fetch_rows(
        """
        SELECT
            LOWER(vs.specialist_type) AS specialist_type,
            COUNT(*) AS total_rows,
            SUM(CASE WHEN vs.required = 1 THEN 1 ELSE 0 END) AS required_rows,
            SUM(CASE WHEN vs.required = 1 AND vs.completed_at IS NOT NULL THEN 1 ELSE 0 END) AS completed_required,
            MAX(vs.created_at) AS last_created
        FROM visit_specialists vs
        GROUP BY vs.specialist_type
        ORDER BY total_rows DESC
        """
    )

    if not assignment_rows:
        print("No entries in visit_specialists yet.")
    else:
        for row in assignment_rows:
            role = row["specialist_type"] or "unknown"
            total = row["total_rows"]
            required = row["required_rows"]
            completed = row["completed_required"]
            last_created = row["last_created"]
            last_display = (
                datetime.strftime(last_created, "%Y-%m-%d %H:%M:%S")
                if isinstance(last_created, datetime)
                else str(last_created)
            )
            print(
                f"- {role}: {total} rows (required={required}, completed={completed}), last assignment {last_display}"
            )

    print("\nLatest required assignments (up to 10):")
    latest_assignments = fetch_rows(
        """
        SELECT
            LOWER(vs.specialist_type) AS specialist_type,
            vs.visit_id,
            pv.patient_id,
            vs.required,
            vs.completed_at,
            vs.created_at
        FROM visit_specialists vs
        JOIN patient_visits pv ON pv.id = vs.visit_id
        WHERE vs.required = 1
        ORDER BY vs.created_at DESC
        LIMIT 10
        """
    )

    if not latest_assignments:
        print("  (No required specialist assignments found)")
    else:
        for row in latest_assignments:
            specialist_type = row["specialist_type"]
            visit_id = row["visit_id"]
            patient_id = row["patient_id"]
            completed_at = row["completed_at"]
            status = "completed" if completed_at else "pending"
            created_ts = row["created_at"]
            created_display = (
                datetime.strftime(created_ts, "%Y-%m-%d %H:%M:%S")
                if isinstance(created_ts, datetime)
                else str(created_ts)
            )
            print(
                f"  • visit {visit_id} / patient {patient_id} -> {specialist_type} ({status}) created {created_display}"
            )

    print("\n=== Specialist Referral Snapshot ===")
    placeholders = ", ".join(["%s"] * len(SPECIALIST_TYPES))
    referral_rows = fetch_rows(
        f"""
        SELECT
            LOWER(REPLACE(r.to_stage, ' ', '_')) AS referral_target,
            COUNT(*) AS total_referrals,
            SUM(CASE WHEN r.status = 'completed' THEN 1 ELSE 0 END) AS completed_referrals,
            MAX(r.created_at) AS last_created
        FROM referrals r
        WHERE LOWER(REPLACE(r.to_stage, ' ', '_')) IN ({placeholders})
        GROUP BY LOWER(REPLACE(r.to_stage, ' ', '_'))
        ORDER BY total_referrals DESC
        """,
        tuple(SPECIALIST_TYPES),
    )

    if not referral_rows:
        print("No referrals targeting specialists were found.")
    else:
        for row in referral_rows:
            target = row["referral_target"] or "unknown"
            total = row["total_referrals"]
            completed = row["completed_referrals"]
            last_created = row["last_created"]
            last_display = (
                datetime.strftime(last_created, "%Y-%m-%d %H:%M:%S")
                if isinstance(last_created, datetime)
                else str(last_created)
            )
            print(
                f"- {target}: {total} referrals (completed={completed}), last recorded {last_display}"
            )

    print("\nRecent specialist referrals (up to 10):")
    recent_referrals = fetch_rows(
        f"""
        SELECT
            r.id,
            r.patient_id,
            r.visit_id,
            LOWER(REPLACE(r.to_stage, ' ', '_')) AS referral_target,
            r.status,
            r.created_at
        FROM referrals r
        WHERE LOWER(REPLACE(r.to_stage, ' ', '_')) IN ({placeholders})
        ORDER BY r.created_at DESC
        LIMIT 10
        """,
        tuple(SPECIALIST_TYPES),
    )

    if not recent_referrals:
        print("  (No specialist referrals recorded)")
    else:
        for row in recent_referrals:
            referral_id = row["id"]
            patient_id = row["patient_id"]
            visit_id = row["visit_id"]
            target = row["referral_target"]
            status = row["status"]
            created = row["created_at"]
            created_display = (
                datetime.strftime(created, "%Y-%m-%d %H:%M:%S")
                if isinstance(created, datetime)
                else str(created)
            )
            print(
                f"  • referral {referral_id} -> {target} (patient {patient_id}, visit {visit_id}), status={status}, created {created_display}"
            )


if __name__ == "__main__":
    main()
