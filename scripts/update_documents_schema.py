#!/usr/bin/env python3
"""Apply specialist metadata schema updates to documents tables.

This utility adds the specialist-related columns and supporting indexes to the
`documents` and `patient_documents` tables. The script is idempotent: it checks
for each column or index before attempting to create it, allowing repeated runs
without errors. Database credentials are read from the same environment
variables consumed by `app.py` (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, DB_PORT
plus optional DB_SSL_CA / DB_SSL_DISABLED).
"""

from __future__ import annotations

import logging
import os
from typing import Dict, Sequence, Tuple

import mysql.connector
from mysql.connector import Error

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

DB_CONFIG = {
    "host": os.environ.get("DB_HOST", "localhost"),
    "database": os.environ.get("DB_NAME", "palmed_clinic_erp"),
    "user": os.environ.get("DB_USER", "root"),
    "password": os.environ.get("DB_PASSWORD", "Transport@2025"),
    "port": int(os.environ.get("DB_PORT", 3306)),
    "autocommit": False,
    "use_unicode": True,
    "charset": "utf8mb4",
}

DB_SSL_CA = os.environ.get("DB_SSL_CA")
DB_SSL_DISABLED = os.environ.get("DB_SSL_DISABLED", "0").lower() in ("1", "true", "yes")
if DB_SSL_CA and not DB_SSL_DISABLED:
    DB_CONFIG["ssl_ca"] = DB_SSL_CA
    DB_CONFIG["ssl_disabled"] = False
    DB_CONFIG["ssl_verify_cert"] = False
    DB_CONFIG["ssl_verify_identity"] = False

TABLE_DEFINITIONS: Dict[str, str] = {
    "documents": (
        "CREATE TABLE `documents` ("
        "  `id` int NOT NULL AUTO_INCREMENT,"
        "  `patient_id` int NOT NULL,"
        "  `document_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'prescription, report, certificate, referral, discharge, imaging',"
        "  `visit_id` int DEFAULT NULL,"
        "  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,"
        "  `file_path` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,"
        "  `file_size` int DEFAULT NULL COMMENT 'Size in bytes',"
        "  `mime_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,"
        "  `is_confidential` tinyint(1) DEFAULT '0',"
        "  `uploaded_by` int DEFAULT NULL COMMENT 'FK to users.id',"
        "  `specialist_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Clinical specialist context (dentist, optometrist, etc)',"
        "  `workflow_step` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Workflow stage identifier (e.g. dentist, audiology_assessment)',"
        "  `tags` text COLLATE utf8mb4_unicode_ci COMMENT 'Optional JSON array of descriptive tags',"
        "  `notes` text COLLATE utf8mb4_unicode_ci,"
        "  `uploaded_at` datetime DEFAULT CURRENT_TIMESTAMP,"
        "  `expires_at` datetime DEFAULT NULL,"
        "  `is_active` tinyint(1) DEFAULT '1',"
        "  `download_count` int DEFAULT '0',"
        "  `last_downloaded_at` datetime DEFAULT NULL,"
        "  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,"
        "  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,"
        "  PRIMARY KEY (`id`),"
        "  KEY `fk_doc_uploaded_by` (`uploaded_by`),"
        "  KEY `idx_patient_id` (`patient_id`),"
        "  KEY `idx_visit_id` (`visit_id`),"
        "  KEY `idx_document_type` (`document_type`),"
        "  KEY `idx_documents_specialist_type` (`specialist_type`),"
        "  KEY `idx_documents_workflow_step` (`workflow_step`),"
        "  KEY `idx_uploaded_at` (`uploaded_at`),"
        "  KEY `idx_is_active` (`is_active`),"
        "  KEY `idx_created_at` (`created_at`),"
        "  CONSTRAINT `fk_doc_patient` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,"
        "  CONSTRAINT `fk_doc_uploaded_by` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,"
        "  CONSTRAINT `fk_doc_visit` FOREIGN KEY (`visit_id`) REFERENCES `patient_visits` (`id`) ON DELETE SET NULL"
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Patient documents and uploaded files'"
    ),
    "patient_documents": (
        "CREATE TABLE `patient_documents` ("
        "  `id` int NOT NULL AUTO_INCREMENT,"
        "  `patient_id` int NOT NULL,"
        "  `visit_id` int DEFAULT NULL,"
        "  `document_name` varchar(255) NOT NULL,"
        "  `document_type` enum('lab_report','prescription','medical_certificate','referral','invoice','other') DEFAULT 'other',"
        "  `file_path` varchar(500) DEFAULT NULL,"
        "  `file_size_bytes` int DEFAULT NULL,"
        "  `mime_type` varchar(100) DEFAULT NULL,"
        "  `is_patient_accessible` tinyint(1) DEFAULT '1',"
        "  `uploaded_by` int DEFAULT NULL,"
        "  `specialist_type` varchar(100) DEFAULT NULL COMMENT 'Clinical specialist context (dentist, optometrist, etc)',"
        "  `workflow_step` varchar(100) DEFAULT NULL COMMENT 'Workflow stage identifier (e.g. dentist, audiology_assessment)',"
        "  `tags` text COMMENT 'Optional JSON array of descriptive tags',"
        "  `notes` text,"
        "  `upload_date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,"
        "  PRIMARY KEY (`id`),"
        "  KEY `visit_id` (`visit_id`),"
        "  KEY `idx_patient_documents_patient` (`patient_id`),"
        "  KEY `idx_patient_documents_type` (`document_type`),"
        "  KEY `idx_patient_documents_specialist` (`specialist_type`),"
        "  KEY `idx_patient_documents_workflow` (`workflow_step`),"
        "  KEY `idx_patient_documents_accessible` (`is_patient_accessible`),"
        "  CONSTRAINT `patient_documents_ibfk_1` FOREIGN KEY (`patient_id`) REFERENCES `patients` (`id`) ON DELETE CASCADE,"
        "  CONSTRAINT `patient_documents_ibfk_2` FOREIGN KEY (`visit_id`) REFERENCES `patient_visits` (`id`) ON DELETE SET NULL"
        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci"
    ),
}


DOCUMENTS_COLUMNS: Sequence[Tuple[str, str]] = (
    (
        "specialist_type",
        "VARCHAR(100) NULL COMMENT 'Clinical specialist context (dentist, optometrist, etc)' AFTER `uploaded_by`",
    ),
    (
        "workflow_step",
        "VARCHAR(100) NULL COMMENT 'Workflow stage identifier (e.g. dentist, audiology_assessment)' AFTER `specialist_type`",
    ),
    (
        "tags",
        "TEXT NULL COMMENT 'Optional JSON array of descriptive tags' AFTER `workflow_step`",
    ),
    (
        "notes",
        "TEXT NULL AFTER `tags`",
    ),
)

DOCUMENTS_INDEXES: Sequence[Tuple[str, str]] = (
    ("idx_documents_specialist_type", "(`specialist_type`)",),
    ("idx_documents_workflow_step", "(`workflow_step`)",),
)

PATIENT_DOCUMENTS_COLUMNS: Sequence[Tuple[str, str]] = (
    (
        "specialist_type",
        "VARCHAR(100) NULL COMMENT 'Clinical specialist context (dentist, optometrist, etc)' AFTER `uploaded_by`",
    ),
    (
        "workflow_step",
        "VARCHAR(100) NULL COMMENT 'Workflow stage identifier (e.g. dentist, audiology_assessment)' AFTER `specialist_type`",
    ),
    (
        "tags",
        "TEXT NULL COMMENT 'Optional JSON array of descriptive tags' AFTER `workflow_step`",
    ),
    (
        "notes",
        "TEXT NULL AFTER `tags`",
    ),
)

PATIENT_DOCUMENTS_INDEXES: Sequence[Tuple[str, str]] = (
    ("idx_patient_documents_specialist", "(`specialist_type`)",),
    ("idx_patient_documents_workflow", "(`workflow_step`)",),
)


def table_exists(cursor, table: str) -> bool:
    query = (
        "SELECT COUNT(*) FROM information_schema.tables "
        "WHERE table_schema = %s AND table_name = %s"
    )
    cursor.execute(query, (DB_CONFIG["database"], table))
    return cursor.fetchone()[0] > 0


def column_exists(cursor, table: str, column: str) -> bool:
    query = (
        "SELECT COUNT(*) FROM information_schema.columns "
        "WHERE table_schema = %s AND table_name = %s AND column_name = %s"
    )
    cursor.execute(query, (DB_CONFIG["database"], table, column))
    return cursor.fetchone()[0] > 0


def index_exists(cursor, table: str, index: str) -> bool:
    query = (
        "SELECT COUNT(*) FROM information_schema.statistics "
        "WHERE table_schema = %s AND table_name = %s AND index_name = %s"
    )
    cursor.execute(query, (DB_CONFIG["database"], table, index))
    return cursor.fetchone()[0] > 0


def ensure_columns(cursor, table: str, alterations: Sequence[Tuple[str, str]]) -> None:
    for column, definition in alterations:
        if column_exists(cursor, table, column):
            logger.info("%s.%s already exists; skipping", table, column)
            continue
        logger.info("Adding %s.%s", table, column)
        cursor.execute(f"ALTER TABLE `{table}` ADD COLUMN `{column}` {definition}")


def ensure_indexes(cursor, table: str, indexes: Sequence[Tuple[str, str]]) -> None:
    for index, definition in indexes:
        if index_exists(cursor, table, index):
            logger.info("Index %s on %s already exists; skipping", index, table)
            continue
        logger.info("Creating index %s on %s", index, table)
        cursor.execute(f"ALTER TABLE `{table}` ADD INDEX `{index}` {definition}")


def main() -> None:
    logger.info("Connecting to MySQL host %s", DB_CONFIG["host"])
    connection = None
    cursor = None

    try:
        connection = mysql.connector.connect(**DB_CONFIG)
        cursor = connection.cursor()

        for table_name in ("documents", "patient_documents"):
            if not table_exists(cursor, table_name):
                logger.info("Creating table %s", table_name)
                cursor.execute(TABLE_DEFINITIONS[table_name])
                continue

            if table_name == "documents":
                ensure_columns(cursor, table_name, DOCUMENTS_COLUMNS)
                ensure_indexes(cursor, table_name, DOCUMENTS_INDEXES)
            else:
                ensure_columns(cursor, table_name, PATIENT_DOCUMENTS_COLUMNS)
                ensure_indexes(cursor, table_name, PATIENT_DOCUMENTS_INDEXES)

        connection.commit()
        logger.info("Schema update completed successfully")
    except Error as exc:
        if connection:
            connection.rollback()
        logger.error("Schema update failed: %s", exc)
        raise SystemExit(1) from exc
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()
        logger.info("Connection closed")


if __name__ == "__main__":
    main()
