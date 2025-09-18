-- PALMED Mobile Clinic ERP
-- Seed: South African medical consumable suppliers
-- Table schema expected:
-- suppliers(id PK, supplier_name, contact_person, phone, email, address, tax_number, is_active, created_at)
-- Idempotent inserts to avoid duplicates when re-running.

-- 1) UPD (United Pharmaceutical Distributors)
INSERT INTO suppliers (supplier_name, contact_person, phone, email, address, tax_number, is_active, created_at)
SELECT 'UPD (United Pharmaceutical Distributors)', 'Accounts Dept', '+27 11 555 1000', 'info@upd.co.za',
       'Longmeadow, Johannesburg, Gauteng, South Africa', 'ZA-VAT-4000000001', TRUE, UTC_TIMESTAMP()
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_name = 'UPD (United Pharmaceutical Distributors)');

-- 2) Transpharm (Clicks Group)
INSERT INTO suppliers (supplier_name, contact_person, phone, email, address, tax_number, is_active, created_at)
SELECT 'Transpharm (Clicks Group)', 'Customer Service', '+27 21 555 2000', 'orders@transpharm.co.za',
       'Montague Gardens, Cape Town, Western Cape, South Africa', 'ZA-VAT-4000000002', TRUE, UTC_TIMESTAMP()
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_name = 'Transpharm (Clicks Group)');

-- 3) CJ Distribution (Dis-Chem)
INSERT INTO suppliers (supplier_name, contact_person, phone, email, address, tax_number, is_active, created_at)
SELECT 'CJ Distribution (Dis-Chem)', 'Sales Desk', '+27 11 555 3000', 'sales@cjdistribution.co.za',
       'Midrand, Johannesburg, Gauteng, South Africa', 'ZA-VAT-4000000003', TRUE, UTC_TIMESTAMP()
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_name = 'CJ Distribution (Dis-Chem)');

-- 4) Adcock Ingram Healthcare
INSERT INTO suppliers (supplier_name, contact_person, phone, email, address, tax_number, is_active, created_at)
SELECT 'Adcock Ingram Healthcare', 'Key Accounts', '+27 11 555 4000', 'customerservice@adcock.com',
       'Midrand, Gauteng, South Africa', 'ZA-VAT-4000000004', TRUE, UTC_TIMESTAMP()
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_name = 'Adcock Ingram Healthcare');

-- 5) Aspen Pharmacare
INSERT INTO suppliers (supplier_name, contact_person, phone, email, address, tax_number, is_active, created_at)
SELECT 'Aspen Pharmacare', 'Key Accounts', '+27 31 555 5000', 'orders@aspenpharma.com',
       'Umhlanga, Durban, KwaZulu-Natal, South Africa', 'ZA-VAT-4000000005', TRUE, UTC_TIMESTAMP()
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_name = 'Aspen Pharmacare');

-- 6) Cipla South Africa
INSERT INTO suppliers (supplier_name, contact_person, phone, email, address, tax_number, is_active, created_at)
SELECT 'Cipla South Africa', 'Customer Care', '+27 21 555 6000', 'customercare@cipla.co.za',
       'Bellville, Cape Town, Western Cape, South Africa', 'ZA-VAT-4000000006', TRUE, UTC_TIMESTAMP()
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_name = 'Cipla South Africa');

-- 7) B. Braun South Africa
INSERT INTO suppliers (supplier_name, contact_person, phone, email, address, tax_number, is_active, created_at)
SELECT 'B. Braun South Africa', 'Sales Support', '+27 11 555 7000', 'info.za@bbraun.com',
       'Randburg, Johannesburg, Gauteng, South Africa', 'ZA-VAT-4000000007', TRUE, UTC_TIMESTAMP()
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_name = 'B. Braun South Africa');

-- 8) Surgical Innovations SA
INSERT INTO suppliers (supplier_name, contact_person, phone, email, address, tax_number, is_active, created_at)
SELECT 'Surgical Innovations SA', 'Sales Desk', '+27 11 555 8000', 'orders@surgicalinno.co.za',
       'Sandton, Johannesburg, Gauteng, South Africa', 'ZA-VAT-4000000008', TRUE, UTC_TIMESTAMP()
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_name = 'Surgical Innovations SA');

-- 9) Pharmed (Pty) Ltd
INSERT INTO suppliers (supplier_name, contact_person, phone, email, address, tax_number, is_active, created_at)
SELECT 'Pharmed (Pty) Ltd', 'Customer Service', '+27 31 555 9000', 'orders@pharmed.co.za',
       'Riverhorse Valley, Durban, KwaZulu-Natal, South Africa', 'ZA-VAT-4000000009', TRUE, UTC_TIMESTAMP()
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_name = 'Pharmed (Pty) Ltd');

-- 10) Pharmacy Direct
INSERT INTO suppliers (supplier_name, contact_person, phone, email, address, tax_number, is_active, created_at)
SELECT 'Pharmacy Direct', 'Customer Service', '+27 12 555 1001', 'info@pharmacydirect.co.za',
       'Centurion, Gauteng, South Africa', 'ZA-VAT-4000000010', TRUE, UTC_TIMESTAMP()
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_name = 'Pharmacy Direct');

-- 11) Imperial Health Sciences
INSERT INTO suppliers (supplier_name, contact_person, phone, email, address, tax_number, is_active, created_at)
SELECT 'Imperial Health Sciences', 'Key Accounts', '+27 11 555 1100', 'orders@imperialhs.co.za',
       'Meadowview, Johannesburg, Gauteng, South Africa', 'ZA-VAT-4000000011', TRUE, UTC_TIMESTAMP()
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_name = 'Imperial Health Sciences');

-- 12) Clicks Direct Medicines
INSERT INTO suppliers (supplier_name, contact_person, phone, email, address, tax_number, is_active, created_at)
SELECT 'Clicks Direct Medicines', 'Customer Service', '+27 21 555 1200', 'orders@cdmed.co.za',
       'Cape Town, Western Cape, South Africa', 'ZA-VAT-4000000012', TRUE, UTC_TIMESTAMP()
WHERE NOT EXISTS (SELECT 1 FROM suppliers WHERE supplier_name = 'Clicks Direct Medicines');
