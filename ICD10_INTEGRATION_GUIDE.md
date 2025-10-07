# ICD-10 Code Integration Guide

## ✅ Complete Integration Summary

The ICD-10 code search functionality is now **fully wired** and ready to use in the doctor consultation workflow!

---

## 🔧 Backend Implementation

### Database Table: `icd10_codes`
```sql
CREATE TABLE `icd10_codes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `icd10_code` varchar(10) NOT NULL,
  `description` text NOT NULL,
  `category` varchar(100),
  `subcategory` varchar(100),
  `keywords` json,
  `usage_count` int DEFAULT '0',
  `is_common` tinyint(1) DEFAULT '0',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY (`icd10_code`),
  FULLTEXT KEY (`icd10_code`, `description`)
)
```

### API Endpoints (in `scripts/app.py`)

#### 1. Search ICD-10 Codes
**Endpoint:** `GET /api/icd10/search`

**Query Parameters:**
- `q` - Search term (searches both code and description)
- `limit` - Maximum results (default: 50)
- `common_only` - Filter to common codes only (default: false)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "code": "I10",
      "description": "Essential (primary) hypertension",
      "isCommon": true,
      "display": "I10 - Essential (primary) hypertension"
    }
  ]
}
```

#### 2. Get Common ICD-10 Codes
**Endpoint:** `GET /api/icd10/common`

**Query Parameters:**
- `limit` - Maximum results (default: 30)

**Response:** Same format as search endpoint

**Access Control:** Both endpoints require authentication and one of these roles:
- Administrator
- Doctor
- Nurse

---

## 🎨 Frontend Implementation

### API Service (`lib/api-service.ts`)

#### Interface Definition:
```typescript
export interface ICD10Code {
  code: string
  description: string
  isCommon: boolean
  display: string
}
```

#### Service Methods:
```typescript
// Search ICD-10 codes
async searchICD10Codes(
  searchTerm: string, 
  limit: number = 50, 
  commonOnly: boolean = false
): Promise<ApiResponse<ICD10Code[]>>

// Get common ICD-10 codes
async getCommonICD10Codes(
  limit: number = 30
): Promise<ApiResponse<ICD10Code[]>>
```

---

### Clinical Workflow Component (`components/patients/clinical-workflow.tsx`)

#### State Management:
```typescript
const [icd10Codes, setIcd10Codes] = useState<ICD10Code[]>([])
const [icd10SearchTerm, setIcd10SearchTerm] = useState("")
const [icd10PopoverOpen, setIcd10PopoverOpen] = useState(false)
const [loadingIcd10, setLoadingIcd10] = useState(false)
```

#### Key Functions:

1. **Load ICD-10 Codes** - Searches as user types
```typescript
const loadICD10Codes = useCallback(async (searchTerm: string) => {
  setLoadingIcd10(true)
  const response = await apiService.searchICD10Codes(searchTerm, 50, false)
  if (response.success && response.data) {
    setIcd10Codes(response.data)
  }
  setLoadingIcd10(false)
}, [])
```

2. **Add ICD-10 Code** - Adds selected code to clinical notes
```typescript
const addICD10Code = (code: ICD10Code) => {
  const existingCodes = clinicalNotes.icd10Codes.split(',')
    .map(c => c.trim())
    .filter(Boolean)
  
  if (!existingCodes.includes(code.code)) {
    const newCodes = existingCodes.length > 0 
      ? `${existingCodes.join(', ')}, ${code.code}` 
      : code.code
    updateClinicalNotes("icd10Codes", newCodes)
    toast({
      title: "ICD-10 Code Added",
      description: `${code.code} - ${code.description}`,
    })
  }
  setIcd10PopoverOpen(false)
  setIcd10SearchTerm("")
}
```

3. **Auto-load Common Codes** - Loads on component mount
```typescript
useEffect(() => {
  loadICD10Codes("")
}, [loadICD10Codes])
```

---

## 🎯 UI Features

### Searchable Combobox
- **Location:** Doctor Consultation tab → ICD-10 Codes section
- **Features:**
  - Real-time search as you type
  - Searches both code and description
  - Shows common codes by default (when no search term)
  - Visual indicators for common codes with badge
  - Checkmarks for already-selected codes
  - Display format: `CODE - Description`

### Selected Codes Display
- Shows all selected codes as removable badges
- Click × to remove a code
- Codes are stored as comma-separated values in `clinicalNotes.icd10Codes`

---

## 📊 Data Flow

```
User Types in Search Box
    ↓
loadICD10Codes(searchTerm)
    ↓
apiService.searchICD10Codes(searchTerm, 50, false)
    ↓
GET /api/icd10/search?q=searchTerm&limit=50&common_only=false
    ↓
Database Query (LIKE search on icd10_code and description)
    ↓
Returns matching codes (common codes first)
    ↓
Display in dropdown with common badge
    ↓
User Selects Code
    ↓
addICD10Code(selectedCode)
    ↓
Updates clinicalNotes.icd10Codes
    ↓
Shows toast notification
    ↓
Displays as badge in selected codes area
```

---

## 🧪 Testing Checklist

- [x] Backend endpoints return correct data structure
- [x] Column names match database schema (`icd10_code` → aliased as `code`)
- [x] Frontend API service methods defined
- [x] ICD10Code interface exported and imported
- [x] State variables initialized
- [x] Search function wired to input
- [x] Add function updates clinical notes
- [x] Common codes load on mount
- [x] UI displays searchable combobox
- [x] Selected codes shown as badges
- [x] Remove functionality works
- [x] Toast notifications on add
- [x] No TypeScript errors
- [x] No Python syntax errors

---

## 🚀 How to Use

### For Doctors:
1. Open the Clinical Workflow for a patient
2. Navigate to the **Doctor Consultation** tab
3. Scroll to the **ICD-10 Codes** section
4. Click the search box to see common codes
5. Type to search by code (e.g., "I10") or description (e.g., "hypertension")
6. Click on a code to add it
7. Selected codes appear as badges above the search box
8. Click × on any badge to remove a code
9. Complete consultation to save codes with clinical notes

### Example Workflow:
```
1. Patient presents with high blood pressure and diabetes
2. Search "hypertension" → Select "I10 - Essential (primary) hypertension"
3. Search "diabetes" → Select "E11.9 - Type 2 diabetes mellitus without complications"
4. Review selected codes: I10, E11.9
5. Complete consultation → Codes saved to patient record
```

---

## 🔍 Troubleshooting

### No codes appearing?
- Check database has data: `SELECT COUNT(*) FROM icd10_codes`
- Verify backend is running and accessible
- Check browser console for API errors
- Ensure user has correct role (doctor/nurse/admin)

### Search not working?
- Check network tab for API call to `/api/icd10/search`
- Verify JWT token is valid (not 401 error)
- Check backend logs for database query errors

### Codes not saving?
- Ensure `clinicalNotes.icd10Codes` is being updated
- Check the "Complete Consultation" endpoint saves clinical notes
- Verify database column for storing ICD-10 codes exists

---

## 📝 Database Population Status

✅ **ICD-10 codes successfully populated using:**
- Source file: `icd10cm-order-April-2025.txt`
- Population script: `populate.py`
- Common codes flagged automatically
- All codes indexed for fast search

---

## 🎉 Status: FULLY FUNCTIONAL

All components are wired and ready for testing in the production environment!
