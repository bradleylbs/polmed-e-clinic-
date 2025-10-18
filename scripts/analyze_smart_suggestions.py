#!/usr/bin/env python3
"""Utility script to inspect smart suggestion activity in Azure MySQL."""

import json
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Tuple

import mysql.connector
from mysql.connector import MySQLConnection

# Reuse the same connection defaults defined in create_final_procedure.py
DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "db-polmed.mysql.database.azure.com"),
    "database": os.environ.get("DB_NAME", "palmed_clinic_erp"),
    "user": os.environ.get("DB_USER", "dbadmin"),
    "password": os.environ.get("DB_PASSWORD", "Polm3d!DB@2025"),
    "port": int(os.environ.get("DB_PORT", 3306)),
    "autocommit": True,
    "use_unicode": True,
    "charset": "utf8mb4",
    "ssl_disabled": False,
}


def get_connection() -> MySQLConnection:
    """Open a MySQL connection targeting the Azure instance."""
    return mysql.connector.connect(**DB_CONFIG)


def fetch_single(cursor, query: str, params: Tuple[Any, ...] = ()) -> Dict[str, Any]:
    cursor.execute(query, params)
    return cursor.fetchone() or {}


def fetch_all(cursor, query: str, params: Tuple[Any, ...] = ()) -> List[Dict[str, Any]]:
    cursor.execute(query, params)
    return cursor.fetchall() or []


def describe_smart_suggestions(cursor) -> None:
    print("\n=== SMART_SUGGESTIONS TABLE STRUCTURE ===")
    row = fetch_single(cursor, "SHOW CREATE TABLE smart_suggestions")
    ddl = row.get("Create Table") if isinstance(row, dict) else None
    if ddl:
        print(ddl)
    else:
        print("Table smart_suggestions not found. Ensure migrations ran on Azure.")


def summarize_counts(cursor) -> None:
    print("\n=== TOTAL RECORDS BY TYPE ===")
    rows = fetch_all(
        cursor,
        """
        SELECT suggestion_type,
               COUNT(*)                                     AS total,
               SUM(CASE WHEN was_accepted = 1 THEN 1 ELSE 0 END) AS accepted,
               ROUND(AVG(COALESCE(feedback_score, 0)), 2)   AS avg_feedback,
               ROUND(AVG(confidence_score), 2)              AS avg_confidence
        FROM smart_suggestions
        GROUP BY suggestion_type
        ORDER BY total DESC
        """,
    )
    if not rows:
        print("No smart suggestion data found yet.")
        return

    for row in rows:
        print(
            f"- {row['suggestion_type']:<13} | total={row['total']:>4} | "
            f"accepted={row['accepted']:>4} | avg_conf={row['avg_confidence'] or 0:.2f} | "
            f"avg_feedback={row['avg_feedback'] or 0:.2f}"
        )


def summarize_recent(cursor, limit: int = 25) -> None:
    print(f"\n=== LAST {limit} SMART SUGGESTIONS ===")
    rows = fetch_all(
        cursor,
        """
        SELECT id,
               suggestion_type,
               confidence_score,
               was_accepted,
               feedback_score,
               created_at,
               JSON_LENGTH(suggestion_data) AS suggestion_count
        FROM smart_suggestions
        ORDER BY created_at DESC
        LIMIT %s
        """,
        (limit,),
    )
    if not rows:
        print("No recent suggestion records to display.")
        return

    for row in rows:
        created = row["created_at"].strftime("%Y-%m-%d %H:%M") if row.get("created_at") else "n/a"
        accepted = "yes" if row.get("was_accepted") else "no"
        feedback = row.get("feedback_score") if row.get("feedback_score") is not None else "-"
        print(
            f"#{row['id']:>4} | {row['suggestion_type']:<13} | conf={row['confidence_score']:.2f} | "
            f"items={row['suggestion_count']:<2} | accepted={accepted:<3} | feedback={feedback:<3} | {created}"
        )


def summarize_by_user(cursor) -> None:
    print("\n=== TOP USERS BY ACTIVITY (LAST 30 DAYS) ===")
    rows = fetch_all(
        cursor,
        """
        SELECT ss.user_id,
               u.username,
               COUNT(*) AS total,
               SUM(CASE WHEN was_accepted = 1 THEN 1 ELSE 0 END) AS accepted
        FROM smart_suggestions ss
        LEFT JOIN users u ON u.id = ss.user_id
        WHERE ss.created_at >= %s
        GROUP BY ss.user_id, u.username
        ORDER BY total DESC
        LIMIT 10
        """,
        (datetime.utcnow() - timedelta(days=30),),
    )
    if not rows:
        print("No user activity recorded in the last 30 days.")
        return

    for row in rows:
        username = row.get("username") or "(unknown)"
        print(
            f"- {username:<20} | user_id={row['user_id']:<4} | "
            f"requests={row['total']:<4} | accepted={row['accepted']:<4}"
        )


def dump_latest_payload(cursor) -> None:
    print("\n=== SAMPLE PAYLOAD (MOST RECENT ENTRY) ===")
    row = fetch_single(
        cursor,
        """
        SELECT suggestion_type,
               input_context,
               suggestion_data,
               patient_context,
               confidence_score,
               created_at
        FROM smart_suggestions
        ORDER BY created_at DESC
        LIMIT 1
        """,
    )
    if not row:
        print("No suggestion rows found.")
        return

    pretty = {
        "suggestion_type": row.get("suggestion_type"),
        "confidence": row.get("confidence_score"),
        "created_at": row.get("created_at").strftime("%Y-%m-%d %H:%M") if row.get("created_at") else None,
        "input_context": row.get("input_context"),
        "suggestions": json.loads(row.get("suggestion_data")) if row.get("suggestion_data") else None,
        "patient_context": json.loads(row.get("patient_context")) if row.get("patient_context") else None,
    }
    print(json.dumps(pretty, indent=2, ensure_ascii=False))


def main() -> None:
    print("Connecting to Azure MySQL...")
    connection = get_connection()
    try:
        with connection.cursor(dictionary=True) as cursor:
            describe_smart_suggestions(cursor)
            summarize_counts(cursor)
            summarize_recent(cursor)
            summarize_by_user(cursor)
            dump_latest_payload(cursor)
    finally:
        connection.close()
        print("\nDone.")


if __name__ == "__main__":
    main()
