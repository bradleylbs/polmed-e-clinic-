-- POLMED Mobile Clinic ERP
-- Seed: Asset Categories (medical equipment and general assets) + Optional auto-mapping of existing assets
-- Tables expected:
--   asset_categories(id PK, category_name, description, requires_calibration, calibration_frequency_months)
--   assets(id PK, asset_name, asset_tag, serial_number, manufacturer, model, category_id, ...)
--
-- Notes:
-- - Idempotent inserts: safe to run multiple times
-- - Auto-mapping only sets category_id when it is NULL, based on common name keywords
-- - Calibration frequencies are indicative defaults; adjust per policy

-- =============================
-- 1) Insert asset categories
-- =============================
INSERT INTO asset_categories (category_name, description, requires_calibration, calibration_frequency_months)
SELECT 'Diagnostic Equipment', 'Diagnostic tools such as BP monitors, ophthalmoscopes, otoscopes, thermometers', TRUE, 12
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE category_name = 'Diagnostic Equipment');

INSERT INTO asset_categories (category_name, description, requires_calibration, calibration_frequency_months)
SELECT 'Patient Monitoring', 'ECG, pulse oximeters, vital signs monitors, glucometers', TRUE, 6
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE category_name = 'Patient Monitoring');

INSERT INTO asset_categories (category_name, description, requires_calibration, calibration_frequency_months)
SELECT 'Surgical Equipment', 'Surgical instruments, cautery units, suction devices', TRUE, 12
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE category_name = 'Surgical Equipment');

INSERT INTO asset_categories (category_name, description, requires_calibration, calibration_frequency_months)
SELECT 'Sterilization & Disinfection', 'Autoclaves, UV sterilizers, washers, disinfecting units', TRUE, 12
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE category_name = 'Sterilization & Disinfection');

INSERT INTO asset_categories (category_name, description, requires_calibration, calibration_frequency_months)
SELECT 'Imaging & Ultrasound', 'Portable ultrasound, dopplers, imaging peripherals', TRUE, 12
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE category_name = 'Imaging & Ultrasound');

INSERT INTO asset_categories (category_name, description, requires_calibration, calibration_frequency_months)
SELECT 'Laboratory Equipment', 'Centrifuges, microscopes, analysers, incubators', TRUE, 12
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE category_name = 'Laboratory Equipment');

INSERT INTO asset_categories (category_name, description, requires_calibration, calibration_frequency_months)
SELECT 'Emergency Equipment', 'Defibrillators, oxygen concentrators, suction, resuscitation kits', TRUE, 6
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE category_name = 'Emergency Equipment');

INSERT INTO asset_categories (category_name, description, requires_calibration, calibration_frequency_months)
SELECT 'Cold Chain', 'Vaccine and medicine refrigerators/freezers, temperature loggers', TRUE, 6
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE category_name = 'Cold Chain');

INSERT INTO asset_categories (category_name, description, requires_calibration, calibration_frequency_months)
SELECT 'Rehabilitation & Physio', 'Wheelchairs, walkers, physio devices, exercise aids', FALSE, NULL
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE category_name = 'Rehabilitation & Physio');

INSERT INTO asset_categories (category_name, description, requires_calibration, calibration_frequency_months)
SELECT 'Waste Management', 'Sharps containers, medical waste bins, trolleys', FALSE, NULL
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE category_name = 'Waste Management');

INSERT INTO asset_categories (category_name, description, requires_calibration, calibration_frequency_months)
SELECT 'IT & Networking', 'Laptops, tablets, printers, scanners, routers, switches', FALSE, NULL
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE category_name = 'IT & Networking');

INSERT INTO asset_categories (category_name, description, requires_calibration, calibration_frequency_months)
SELECT 'Furniture & Fixtures', 'Clinic furniture including beds, desks, chairs, cabinets', FALSE, NULL
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE category_name = 'Furniture & Fixtures');

INSERT INTO asset_categories (category_name, description, requires_calibration, calibration_frequency_months)
SELECT 'Power & Electrical', 'Generators, inverters, UPS, voltage stabilizers, batteries', FALSE, NULL
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE category_name = 'Power & Electrical');

INSERT INTO asset_categories (category_name, description, requires_calibration, calibration_frequency_months)
SELECT 'Vehicles & Mobile Units', 'Mobile clinic vans, trailers, medical carts', FALSE, NULL
WHERE NOT EXISTS (SELECT 1 FROM asset_categories WHERE category_name = 'Vehicles & Mobile Units');

-- =========================================
-- 2) Auto-map existing assets (optional)
-- =========================================
-- Uses simple keyword matching on asset_name; edit or extend as needed
-- Note: Only sets category if currently NULL to avoid overwriting manual assignments

SET @cat_pm = (SELECT id FROM asset_categories WHERE category_name = 'Patient Monitoring');
UPDATE assets
SET category_id = @cat_pm
WHERE category_id IS NULL
  AND @cat_pm IS NOT NULL
  AND (
    LOWER(asset_name) LIKE '%monitor%' OR
    LOWER(asset_name) LIKE '%ecg%' OR
    LOWER(asset_name) LIKE '%spo2%' OR
    LOWER(asset_name) LIKE '%pulse ox%' OR
    LOWER(asset_name) LIKE '%glucometer%' OR
    LOWER(asset_name) LIKE '%vital%'
  );

SET @cat_diag = (SELECT id FROM asset_categories WHERE category_name = 'Diagnostic Equipment');
UPDATE assets
SET category_id = @cat_diag
WHERE category_id IS NULL
  AND @cat_diag IS NOT NULL
  AND (
    LOWER(asset_name) LIKE '%thermometer%' OR
    LOWER(asset_name) LIKE '%otoscope%' OR
    LOWER(asset_name) LIKE '%ophthalmoscope%' OR
    LOWER(asset_name) LIKE '%stethoscope%' OR
    LOWER(asset_name) LIKE '%bp%' OR LOWER(asset_name) LIKE '%blood pressure%'
  );

SET @cat_surg = (SELECT id FROM asset_categories WHERE category_name = 'Surgical Equipment');
UPDATE assets
SET category_id = @cat_surg
WHERE category_id IS NULL
  AND @cat_surg IS NOT NULL
  AND (
    LOWER(asset_name) LIKE '%forceps%' OR
    LOWER(asset_name) LIKE '%scalpel%' OR
    LOWER(asset_name) LIKE '%retractor%' OR
    LOWER(asset_name) LIKE '%suction%'
  );

SET @cat_ster = (SELECT id FROM asset_categories WHERE category_name = 'Sterilization & Disinfection');
UPDATE assets
SET category_id = @cat_ster
WHERE category_id IS NULL
  AND @cat_ster IS NOT NULL
  AND (
    LOWER(asset_name) LIKE '%autoclave%' OR
    LOWER(asset_name) LIKE '%steriliz%' OR
    LOWER(asset_name) LIKE '%uv%'
  );

SET @cat_img = (SELECT id FROM asset_categories WHERE category_name = 'Imaging & Ultrasound');
UPDATE assets
SET category_id = @cat_img
WHERE category_id IS NULL
  AND @cat_img IS NOT NULL
  AND (
    LOWER(asset_name) LIKE '%ultrasound%' OR
    LOWER(asset_name) LIKE '%doppler%' OR
    LOWER(asset_name) LIKE '%probe%'
  );

SET @cat_lab = (SELECT id FROM asset_categories WHERE category_name = 'Laboratory Equipment');
UPDATE assets
SET category_id = @cat_lab
WHERE category_id IS NULL
  AND @cat_lab IS NOT NULL
  AND (
    LOWER(asset_name) LIKE '%centrifuge%' OR
    LOWER(asset_name) LIKE '%microscope%' OR
    LOWER(asset_name) LIKE '%incubator%' OR
    LOWER(asset_name) LIKE '%analy%'
  );

SET @cat_emg = (SELECT id FROM asset_categories WHERE category_name = 'Emergency Equipment');
UPDATE assets
SET category_id = @cat_emg
WHERE category_id IS NULL
  AND @cat_emg IS NOT NULL
  AND (
    LOWER(asset_name) LIKE '%defibrillator%' OR
    LOWER(asset_name) LIKE '%oxygen%' OR
    LOWER(asset_name) LIKE '%resusc%'
  );

SET @cat_cold = (SELECT id FROM asset_categories WHERE category_name = 'Cold Chain');
UPDATE assets
SET category_id = @cat_cold
WHERE category_id IS NULL
  AND @cat_cold IS NOT NULL
  AND (
    LOWER(asset_name) LIKE '%fridge%' OR
    LOWER(asset_name) LIKE '%refrigerator%' OR
    LOWER(asset_name) LIKE '%freezer%'
  );

SET @cat_rehab = (SELECT id FROM asset_categories WHERE category_name = 'Rehabilitation & Physio');
UPDATE assets
SET category_id = @cat_rehab
WHERE category_id IS NULL
  AND @cat_rehab IS NOT NULL
  AND (
    LOWER(asset_name) LIKE '%wheelchair%' OR
    LOWER(asset_name) LIKE '%walker%' OR
    LOWER(asset_name) LIKE '%crutch%'
  );

SET @cat_waste = (SELECT id FROM asset_categories WHERE category_name = 'Waste Management');
UPDATE assets
SET category_id = @cat_waste
WHERE category_id IS NULL
  AND @cat_waste IS NOT NULL
  AND (
    LOWER(asset_name) LIKE '%sharps%' OR
    LOWER(asset_name) LIKE '%waste%'
  );

SET @cat_it = (SELECT id FROM asset_categories WHERE category_name = 'IT & Networking');
UPDATE assets
SET category_id = @cat_it
WHERE category_id IS NULL
  AND @cat_it IS NOT NULL
  AND (
    LOWER(asset_name) LIKE '%laptop%' OR
    LOWER(asset_name) LIKE '%desktop%' OR
    LOWER(asset_name) LIKE '%printer%' OR
    LOWER(asset_name) LIKE '%scanner%' OR
    LOWER(asset_name) LIKE '%router%' OR
    LOWER(asset_name) LIKE '%switch%'
  );

SET @cat_furn = (SELECT id FROM asset_categories WHERE category_name = 'Furniture & Fixtures');
UPDATE assets
SET category_id = @cat_furn
WHERE category_id IS NULL
  AND @cat_furn IS NOT NULL
  AND (
    LOWER(asset_name) LIKE '%bed%' OR
    LOWER(asset_name) LIKE '%chair%' OR
    LOWER(asset_name) LIKE '%table%' OR
    LOWER(asset_name) LIKE '%desk%' OR
    LOWER(asset_name) LIKE '%cabinet%'
  );

SET @cat_power = (SELECT id FROM asset_categories WHERE category_name = 'Power & Electrical');
UPDATE assets
SET category_id = @cat_power
WHERE category_id IS NULL
  AND @cat_power IS NOT NULL
  AND (
    LOWER(asset_name) LIKE '%generator%' OR
    LOWER(asset_name) LIKE '%inverter%' OR
    LOWER(asset_name) LIKE '%ups%' OR
    LOWER(asset_name) LIKE '%battery%'
  );

SET @cat_veh = (SELECT id FROM asset_categories WHERE category_name = 'Vehicles & Mobile Units');
UPDATE assets
SET category_id = @cat_veh
WHERE category_id IS NULL
  AND @cat_veh IS NOT NULL
  AND (
    LOWER(asset_name) LIKE '%vehicle%' OR
    LOWER(asset_name) LIKE '%ambulance%' OR
    LOWER(asset_name) LIKE '%van%' OR
    LOWER(asset_name) LIKE '%trailer%' OR
    LOWER(asset_name) LIKE '%cart%'
  );
