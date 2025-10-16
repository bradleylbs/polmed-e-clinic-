#!/usr/bin/env python3
"""Utility test to verify patients can see route-generated slots via the patient portal.

Environment variables (used as defaults when CLI options are omitted):

- PATIENT_PORTAL_EMAIL: patient portal login email
- PATIENT_PORTAL_PASSWORD: patient portal login password
- PATIENT_PORTAL_ID: numeric patient identifier returned on login
- PATIENT_PORTAL_DATE: YYYY-MM-DD date to filter slots (defaults to today)
- BACKEND_BASE_URL: override backend base URL if not using the default deployment

You can also pass the same values via command-line flags, for example:

```
python test_patient_portal_route_availability.py \
    --email someone@example.com \
    --password Secret123 \
    --patient-id 42 \
    --date 2025-10-31
```

Run as a standalone script or let your test runner import
`test_patient_portal_route_availability`.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import argparse
import getpass

import requests

DEFAULT_BASE_URL = (
    "https://app-polmed-backend-fmamhma6g4gngfey.southafricanorth-01.azurewebsites.net"
)


def patient_portal_login(base_url: str, email: str, password: str) -> Tuple[str, Dict[str, Any]]:
    url = f"{base_url.rstrip('/')}/api/patient-portal/login"
    response = requests.post(url, json={"email": email, "password": password}, timeout=20)
    response.raise_for_status()
    payload = response.json()
    if not payload.get("success"):
        raise RuntimeError(f"Login failed: {json.dumps(payload, indent=2)}")

    token = payload.get("data", {}).get("token")
    patient_data = payload.get("data", {}).get("patient_data", {})
    if not token:
        raise RuntimeError("Login response did not include a token")
    return token, patient_data


def fetch_available_slots(
    base_url: str,
    token: str,
    patient_id: int,
    date_from: str,
    date_to: str,
) -> List[Dict[str, Any]]:
    endpoint = f"{base_url.rstrip('/')}/api/patient-portal/appointments/available/{patient_id}"
    params = {"date_from": date_from, "date_to": date_to}
    headers = {"Authorization": f"Bearer {token}"}

    response = requests.get(endpoint, params=params, headers=headers, timeout=20)
    response.raise_for_status()
    payload = response.json()
    if not payload.get("success"):
        raise RuntimeError(f"Slot fetch failed: {json.dumps(payload, indent=2)}")

    return payload.get("data", [])


def _extract_patient_id(patient_data: Dict[str, Any]) -> Optional[int]:
    """Best-effort extraction of the patient ID from the login payload."""

    for key in ("id", "patient_id", "patientId"):
        value = patient_data.get(key)
        if value is None:
            continue
        try:
            return int(value)
        except (TypeError, ValueError):
            continue
    return None


def run_availability_check(
    email: str,
    password: str,
    patient_id: Optional[int] = None,
    *,
    base_url: str = DEFAULT_BASE_URL,
    date_filter: str | None = None,
    verbose: bool = True,
) -> bool:
    if verbose:
        print("🔐 Logging into patient portal...")
    token, patient_data = patient_portal_login(base_url, email, password)

    resolved_patient_id = patient_id if patient_id is not None else _extract_patient_id(patient_data)
    if resolved_patient_id is None:
        raise RuntimeError("Unable to determine patient ID from login payload; please supply --patient-id explicitly.")

    if (
        patient_id is not None
        and patient_data.get("id")
        and int(patient_data["id"]) != resolved_patient_id
        and verbose
    ):
        print(
            "⚠️  Patient ID mismatch between provided value and login payload. "
            f"Using provided value {resolved_patient_id}."
        )

    if not date_filter:
        date_filter = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if verbose:
        print(f"📅 Checking available slots for {date_filter}...")
    slots = fetch_available_slots(base_url, token, resolved_patient_id, date_filter, date_filter)

    if verbose:
        print(f"📊 Total slots returned: {len(slots)}")
        for slot in slots[:5]:
            location = slot.get("location", {})
            route = slot.get("route", {})
            print(
                " • "
                f"{location.get('name', 'Unknown')} | {route.get('name', 'Unknown Route')} | "
                f"{slot.get('date')} {slot.get('start_time')} - {slot.get('end_time')} | "
                f"{slot.get('available_slots', 0)} open"
            )

    if not slots:
        if verbose:
            print(
                "❌ No available slots returned. Confirm that your route has generated appointments "
                "and that the date filter is correct."
            )
        return False

    depleted = [s for s in slots if int(s.get("available_slots") or 0) <= 0]
    if depleted and verbose:
        print(
            "⚠️  Some slots report zero availability, which means they cannot be booked. "
            "Consider regenerating appointment slots if this is unexpected."
        )

    return True


def test_patient_portal_route_availability() -> None:
    """Lightweight check intended for automated test runs."""
    env_email = os.getenv("PATIENT_PORTAL_EMAIL")
    env_password = os.getenv("PATIENT_PORTAL_PASSWORD")
    env_patient_id = os.getenv("PATIENT_PORTAL_ID")

    if not (env_email and env_password and env_patient_id):
        print("⏭️  Skipping portal availability test; required environment variables not set.")
        return

    assert run_availability_check(
        env_email,
        env_password,
        int(env_patient_id) if env_patient_id else None,
        base_url=os.getenv("BACKEND_BASE_URL", DEFAULT_BASE_URL),
        date_filter=os.getenv("PATIENT_PORTAL_DATE"),
        verbose=False,
    ), "Patient portal did not return any bookable slots"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Check patient portal slot availability.")
    parser.add_argument("--email", default=os.getenv("PATIENT_PORTAL_EMAIL"), help="Patient portal email")
    parser.add_argument("--password", default=os.getenv("PATIENT_PORTAL_PASSWORD"), help="Patient portal password")
    parser.add_argument("--patient-id", type=int, help="Patient identifier (defaults to login payload)")
    parser.add_argument("--date", default=os.getenv("PATIENT_PORTAL_DATE"), help="Date filter (YYYY-MM-DD)")
    parser.add_argument(
        "--base-url",
        default=os.getenv("BACKEND_BASE_URL", DEFAULT_BASE_URL),
        help="Override backend base URL",
    )
    parser.add_argument("--quiet", action="store_true", help="Reduce console output")

    args = parser.parse_args()

    email = args.email or os.getenv("PATIENT_PORTAL_EMAIL")
    password = args.password or os.getenv("PATIENT_PORTAL_PASSWORD")

    if not email and sys.stdin.isatty():
        try:
            email = input("Patient portal email: ").strip()
        except EOFError:
            email = ""

    if not password and sys.stdin.isatty():
        try:
            password = getpass.getpass("Patient portal password: ")
        except EOFError:
            password = ""

    if not email or not password:
        print(
            "⚠️  Missing credentials. Provide --email and --password arguments, "
            "set the corresponding environment variables, or run interactively to enter them."
        )
        sys.exit(2)

    env_patient_id_value = os.getenv("PATIENT_PORTAL_ID")
    patient_id = args.patient_id
    if patient_id is None and env_patient_id_value:
        try:
            patient_id = int(env_patient_id_value)
        except ValueError:
            pass

    try:
        success = run_availability_check(
            email,
            password,
            patient_id,
            base_url=args.base_url,
            date_filter=args.date,
            verbose=not args.quiet,
        )
    except Exception as exc:
        print(f"❌ Availability check failed: {exc}")
        sys.exit(1)

    if not success:
        print("❌ Patient portal did not return any bookable slots.")
        sys.exit(1)

    sys.exit(0)
