#!/usr/bin/env python3
"""Deploy stored procedures that power smart_suggestions logging and analytics."""

import os
from textwrap import dedent

import mysql.connector

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

PROCEDURES = {
    "sp_log_smart_suggestion": dedent(
        """
        CREATE PROCEDURE sp_log_smart_suggestion(
            IN  p_suggestion_type  VARCHAR(32),
            IN  p_input_context    TEXT,
            IN  p_suggestion_data  JSON,
            IN  p_confidence_score DECIMAL(5,3),
            IN  p_model_version    VARCHAR(50),
            IN  p_user_id          INT,
            IN  p_patient_context  JSON,
            OUT p_new_id           INT
        )
        BEGIN
            INSERT INTO smart_suggestions (
                suggestion_type,
                input_context,
                suggestion_data,
                confidence_score,
                model_version,
                user_id,
                patient_context,
                was_accepted,
                accepted_at,
                feedback_score,
                feedback_notes
            ) VALUES (
                p_suggestion_type,
                p_input_context,
                p_suggestion_data,
                IFNULL(p_confidence_score, 0.000),
                NULLIF(p_model_version, ''),
                p_user_id,
                p_patient_context,
                0,
                NULL,
                NULL,
                NULL
            );

            SET p_new_id = LAST_INSERT_ID();
            SELECT p_new_id AS new_id;
        END
        """
    ),
    "sp_record_suggestion_feedback": dedent(
        """
        CREATE PROCEDURE sp_record_suggestion_feedback(
            IN p_suggestion_id  INT,
            IN p_was_accepted   TINYINT,
            IN p_feedback_score INT,
            IN p_feedback_notes TEXT
        )
        BEGIN
            DECLARE v_now TIMESTAMP;
            SET v_now = UTC_TIMESTAMP();

            UPDATE smart_suggestions
            SET was_accepted = IFNULL(p_was_accepted, was_accepted),
                feedback_score = p_feedback_score,
                feedback_notes = p_feedback_notes,
                accepted_at = CASE
                    WHEN p_was_accepted = 1 THEN IFNULL(accepted_at, v_now)
                    WHEN p_was_accepted = 0 THEN NULL
                    ELSE accepted_at
                END
            WHERE id = p_suggestion_id;

            SELECT ROW_COUNT() AS affected_rows;
        END
        """
    ),
    "sp_get_recent_suggestions": dedent(
        """
        CREATE PROCEDURE sp_get_recent_suggestions(
            IN p_suggestion_type VARCHAR(32),
            IN p_user_id         INT,
            IN p_start_ts        DATETIME,
            IN p_end_ts          DATETIME,
            IN p_limit           INT
        )
        BEGIN
            DECLARE v_limit INT;
            SET v_limit = CASE
                WHEN p_limit IS NULL OR p_limit <= 0 THEN 25
                WHEN p_limit > 250 THEN 250
                ELSE p_limit
            END;

            SELECT
                ss.id,
                ss.suggestion_type,
                ss.input_context,
                ss.suggestion_data,
                ss.confidence_score,
                ss.model_version,
                ss.user_id,
                ss.patient_context,
                ss.was_accepted,
                ss.accepted_at,
                ss.feedback_score,
                ss.feedback_notes,
                ss.created_at,
                JSON_LENGTH(ss.suggestion_data) AS suggestion_count,
                u.username,
                u.role
            FROM smart_suggestions ss
            LEFT JOIN users u ON u.id = ss.user_id
            WHERE (p_suggestion_type IS NULL
                   OR p_suggestion_type = ''
                   OR LOWER(p_suggestion_type) = 'all'
                   OR ss.suggestion_type = p_suggestion_type)
              AND (p_user_id IS NULL OR ss.user_id = p_user_id)
              AND (p_start_ts IS NULL OR ss.created_at >= p_start_ts)
              AND (p_end_ts IS NULL OR ss.created_at <= p_end_ts)
            ORDER BY ss.created_at DESC
            LIMIT v_limit;
        END
        """
    ),
    "sp_get_suggestion_metrics": dedent(
        """
        CREATE PROCEDURE sp_get_suggestion_metrics(
            IN p_start_ts DATETIME,
            IN p_end_ts   DATETIME
        )
        BEGIN
            SELECT
                'type' AS grouping,
                ss.suggestion_type AS grouping_key,
                COUNT(*) AS total_requests,
                SUM(CASE WHEN ss.was_accepted = 1 THEN 1 ELSE 0 END) AS accepted_requests,
                ROUND(AVG(ss.confidence_score), 3) AS avg_confidence,
                ROUND(AVG(ss.feedback_score), 3) AS avg_feedback
            FROM smart_suggestions ss
            WHERE (p_start_ts IS NULL OR ss.created_at >= p_start_ts)
              AND (p_end_ts IS NULL OR ss.created_at <= p_end_ts)
            GROUP BY ss.suggestion_type
            ORDER BY total_requests DESC;

            SELECT
                'user' AS grouping,
                COALESCE(u.username, CONCAT('user_', ss.user_id)) AS grouping_key,
                COUNT(*) AS total_requests,
                SUM(CASE WHEN ss.was_accepted = 1 THEN 1 ELSE 0 END) AS accepted_requests,
                ROUND(AVG(ss.confidence_score), 3) AS avg_confidence,
                ROUND(AVG(ss.feedback_score), 3) AS avg_feedback
            FROM smart_suggestions ss
            LEFT JOIN users u ON u.id = ss.user_id
            WHERE (p_start_ts IS NULL OR ss.created_at >= p_start_ts)
              AND (p_end_ts IS NULL OR ss.created_at <= p_end_ts)
            GROUP BY ss.user_id, u.username
            ORDER BY total_requests DESC;
        END
        """
    ),
}


def deploy_procedure(cursor, name: str, definition: str) -> None:
    print(f"\n• Recreating {name}...")
    cursor.execute(f"DROP PROCEDURE IF EXISTS {name}")
    cursor.execute(definition)
    print("  ✓ Created")


def main() -> None:
    print("Connecting to database...")
    connection = mysql.connector.connect(**DB_CONFIG)
    try:
        with connection.cursor() as cursor:
            for proc_name, proc_sql in PROCEDURES.items():
                deploy_procedure(cursor, proc_name, proc_sql)
        connection.commit()
        print("\nAll smart suggestion procedures deployed successfully.")
    finally:
        connection.close()
        print("Connection closed.")


if __name__ == "__main__":
    main()
