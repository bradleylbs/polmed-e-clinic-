"""Direct SQL test of booking"""
import mysql.connector

DB_CONFIG = {
    'host': 'db-polmed.mysql.database.azure.com',
    'database': 'palmed_clinic_erp',
    'user': 'dbadmin',
    'password': 'Polm3d!DB@2025',
    'ssl_disabled': False
}

connection = mysql.connector.connect(**DB_CONFIG)
cursor = connection.cursor()

# Find available appointment
cursor.execute("SELECT id FROM patient_appointments WHERE status='Available' LIMIT 1")
appt_id = cursor.fetchone()[0]

# Call procedure
cursor.execute("""
    CALL sp_book_appointment(
        %s, 8, 'Jack Mabaso', '0729944567', 'jack@test.com', 'Test booking',
        @ref, @result
    )
""", (appt_id,))

# Fetch results
cursor.execute("SELECT @ref AS ref, @result AS result")
result = cursor.fetchone()
print(f"Booking Reference: {result[0]}")
print(f"Result Message: {result[1]}")

connection.rollback()
cursor.close()
connection.close()
