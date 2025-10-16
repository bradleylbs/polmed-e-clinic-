#!/usr/bin/env python3
"""Quick inspection tool to understand why portal slot checks return empty.

The script reports route/location capacity and appointment counts for a given
visit date so you can confirm what the backend will expose to patients.

Examples
--------
python scripts/debug_route_slots.py --date 2025-10-31
python scripts/debug_route_slots.py --date 2025-10-31 --route "LIMPOPO MOBILE"

Environment
-----------
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD can override the defaults used
by the Flask app (localhost / palmed_clinic_erp / root / Transport@2025).
"""

from __future__ import annotations

import argparse
import os
import sys
from textwrap import indent

import mysql.connector

DEFAULT_DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "localhost"),
    "port": int(os.environ.get("DB_PORT", "3306")),
    "database": os.environ.get("DB_NAME", "palmed_clinic_erp"),
    "user": os.environ.get("DB_USER", "root"),
    "password": os.environ.get("DB_PASSWORD", "Transport@2025"),
    "autocommit": True,
}


APPOINTMENTS_QUERY = """
SELECT
    a.id,
    a.route_location_id,
    a.status,
    a.appointment_time,
    a.patient_id,
    a.booking_reference
FROM appointments a
WHERE a.route_location_id = %s
ORDER BY a.appointment_time
"""

ROUTE_LOCATIONS_QUERY = """
SELECT
    rl.id AS route_location_id,
    rl.route_id,
    rl.location_id,
    rl.visit_date,
    rl.start_time,
    rl.end_time,
    rl.max_appointments,
    rl.appointment_duration,
    l.location_name,
    l.city,
    l.province,
    r.route_name,
    r.route_type
FROM route_locations rl
JOIN locations l ON rl.location_id = l.id
JOIN routes r ON rl.route_id = r.id
WHERE rl.visit_date = %s
  AND (%s IS NULL OR r.route_name LIKE %s)
ORDER BY r.route_name, l.location_name, rl.start_time
"""

ROUTE_APPOINTMENTS_QUERY = """
SELECT
    ra.id,
    ra.route_location_id,
    ra.available_slots,
    ra.appointment_start,
    ra.appointment_end,
    ra.duration_minutes
FROM route_appointments ra
WHERE ra.route_location_id = %s
ORDER BY ra.appointment_start
"""


def connect_db():
    try:
        return mysql.connector.connect(**DEFAULT_DB_CONFIG)
    except mysql.connector.Error as exc:
        print(f"❌ Failed to connect to MySQL: {exc}")
        sys.exit(1)


def print_route_details(cursor, date_value: str, route_filter: str | None) -> None:
    cursor.execute(
        ROUTE_LOCATIONS_QUERY,
        (date_value, route_filter if route_filter else None, f"%{route_filter}%" if route_filter else None),
    )
    rows = cursor.fetchall()

    if not rows:
        print("⚠️  No route_locations found for that date. Double-check the route schedule.")
        return

    for row in rows:
        route_name = row[11]
        route_location_id = row[0]
        max_appts = row[6]
        duration = row[7]
        location_name = row[8]
        city = row[9]
        province = row[10]
        time_window = f"{row[4]} - {row[5]}" if row[4] and row[5] else "N/A"

        print(f"\n📍 Route {route_name} @ {location_name} ({city}, {province})")
        print(f"   • route_location_id: {route_location_id}")
        print(f"   • time window: {time_window}")
        print(f"   • max appointments: {max_appts}")
        print(f"   • appointment duration: {duration} minutes")

        # Show raw appointments table entries (legacy path)
        cursor.execute(APPOINTMENTS_QUERY, (route_location_id,))
        appointments = cursor.fetchall()
        if appointments:
            booked = [a for a in appointments if str(a[2]).lower() not in {"available", "cancelled", "no-show"}]
            print("   • appointments table entries:")
            printable = [
                f"#{a[0]} status={a[2]} time={a[3]} patient={a[4] or '-'} reference={a[5] or '-'}"
                for a in appointments
            ]
            print(indent("\n".join(printable[:10]), "     "))
            if len(printable) > 10:
                print(f"     … {len(printable) - 10} more rows")
            print(f"     booked count (status ≠ available/cancelled/no-show): {len(booked)}")
        else:
            print("   • appointments table: no records found")

        # Show route_appointments entries (new slot table)
        cursor.execute(ROUTE_APPOINTMENTS_QUERY, (route_location_id,))
        route_appointments = cursor.fetchall()
        if route_appointments:
            print("   • route_appointments table entries:")
            printable = [
                f"#{a[0]} slots_remaining={a[2]} window={a[3]} - {a[4]} duration={a[5]}"
                for a in route_appointments
            ]
            print(indent("\n".join(printable[:10]), "     "))
            if len(printable) > 10:
                print(f"     … {len(printable) - 10} more rows")
        else:
            print("   • route_appointments table: no records found")


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect appointment slots for a given date.")
    parser.add_argument("--date", required=True, help="Visit date (YYYY-MM-DD)")
    parser.add_argument("--route", help="Partial route name filter")
    args = parser.parse_args()

    connection = connect_db()
    try:
        cursor = connection.cursor()
        print_route_details(cursor, args.date, args.route)
    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":
    main()
