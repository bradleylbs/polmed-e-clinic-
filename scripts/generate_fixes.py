"""
Database and API Alignment Fix Recommendations
Generates actionable fixes for identified issues
"""

import json
import os

# Load analysis results
COLUMN_ANALYSIS_FILE = os.path.join(os.path.dirname(__file__), 'column_usage_analysis.json')
DB_STRUCTURE_FILE = os.path.join(os.path.dirname(__file__), 'database_structure_analysis.json')

class AlignmentFixer:
    def __init__(self):
        self.column_analysis = None
        self.db_structure = None
        self.fixes = {
            'critical': [],
            'high_priority': [],
            'medium_priority': [],
            'low_priority': []
        }
    
    def load_analysis(self):
        """Load analysis results"""
        try:
            with open(COLUMN_ANALYSIS_FILE, 'r', encoding='utf-8') as f:
                self.column_analysis = json.load(f)
            with open(DB_STRUCTURE_FILE, 'r', encoding='utf-8') as f:
                self.db_structure = json.load(f)
            print("✓ Loaded analysis results")
            return True
        except Exception as e:
            print(f"❌ Failed to load analysis: {e}")
            return False
    
    def analyze_smart_suggestions_issue(self):
        """Analyze the smart_suggestions table issue (has data but columns not used)"""
        table = 'smart_suggestions'
        if table in self.db_structure['tables']:
            table_info = self.db_structure['tables'][table]
            row_count = table_info['row_count']
            
            if row_count > 0:
                used_cols = set(self.column_analysis['column_usage'].get(table, {}).keys())
                all_cols = {col['name'] for col in table_info['columns']}
                unused = all_cols - used_cols
                
                self.fixes['high_priority'].append({
                    'issue': f'Table {table} has {row_count} rows but {len(unused)} columns are never queried',
                    'table': table,
                    'unused_columns': list(unused),
                    'fix_type': 'add_api_endpoint',
                    'recommendation': 'Create API endpoints to query and utilize smart_suggestions data',
                    'code_location': '/api/smart-suggestions endpoints in app.py',
                    'action': 'Check if endpoints at lines 2547-2791 are correctly querying all columns'
                })
    
    def analyze_unused_foreign_keys(self):
        """Analyze unused foreign key relationships"""
        unused_fks = []
        
        for table_name, table_info in self.db_structure['tables'].items():
            if table_name.startswith('v_') or table_name.startswith('vw_'):
                continue
            
            for fk in table_info.get('foreign_keys', []):
                col_name = fk['column']
                is_used = col_name in self.column_analysis['column_usage'].get(table_name, {})
                
                if not is_used and table_info['row_count'] > 0:
                    unused_fks.append({
                        'table': table_name,
                        'column': col_name,
                        'references': f"{fk['referenced_table']}.{fk['referenced_column']}",
                        'rows': table_info['row_count']
                    })
        
        if unused_fks:
            critical_fks = [fk for fk in unused_fks if fk['rows'] > 10]
            if critical_fks:
                self.fixes['high_priority'].append({
                    'issue': f'{len(critical_fks)} foreign keys with significant data are not being used',
                    'details': critical_fks[:10],
                    'fix_type': 'utilize_foreign_keys',
                    'recommendation': 'Add JOIN queries to utilize these relationships for data integrity and reporting',
                    'action': 'Review queries and add proper JOIN clauses'
                })
    
    def analyze_unimplemented_features(self):
        """Identify tables with 0 rows and many unused columns (unimplemented features)"""
        unimplemented = []
        
        for table_name in self.column_analysis['unused_columns']:
            table_info = self.db_structure['tables'].get(table_name, {})
            unused_cols = self.column_analysis['unused_columns'][table_name]
            
            if table_info.get('row_count', 0) == 0 and len(unused_cols) >= 10:
                unimplemented.append({
                    'table': table_name,
                    'unused_columns': len(unused_cols),
                    'total_columns': len(table_info.get('columns', []))
                })
        
        if unimplemented:
            self.fixes['medium_priority'].append({
                'issue': f'{len(unimplemented)} tables appear to be unimplemented features',
                'tables': [t['table'] for t in unimplemented],
                'fix_type': 'implement_or_remove',
                'recommendation': 'Either implement these features or remove the tables to reduce database complexity',
                'action': 'Review each table and decide: implement API endpoints or drop tables'
            })
    
    def generate_sql_cleanup_script(self):
        """Generate SQL script to clean up unused tables"""
        sql_statements = []
        sql_statements.append("-- Database Cleanup Script")
        sql_statements.append("-- Generated from alignment analysis")
        sql_statements.append("-- REVIEW CAREFULLY BEFORE EXECUTING\n")
        
        # Tables with 0 rows and many unused columns
        empty_unused_tables = []
        for table_name in self.column_analysis['unused_columns']:
            table_info = self.db_structure['tables'].get(table_name, {})
            if table_info.get('row_count', 0) == 0:
                unused_cols = self.column_analysis['unused_columns'][table_name]
                if len(unused_cols) >= 8:  # More than 8 unused columns
                    empty_unused_tables.append(table_name)
        
        if empty_unused_tables:
            sql_statements.append("-- Option 1: Drop empty, unused tables (DESTRUCTIVE)")
            sql_statements.append("-- Uncomment only after confirming these are not needed\n")
            for table in empty_unused_tables:
                sql_statements.append(f"-- DROP TABLE IF EXISTS `{table}`;")
            sql_statements.append("")
        
        # Add indexes for frequently queried columns without indexes
        sql_statements.append("\n-- Option 2: Add indexes for frequently queried columns")
        sql_statements.append("-- These will improve query performance\n")
        
        high_usage_cols = []
        for table, cols in self.column_analysis['column_usage'].items():
            table_info = self.db_structure['tables'].get(table, {})
            existing_indexes = table_info.get('indexes', {})
            
            for col, usage_count in cols.items():
                if usage_count >= 5:  # Used 5+ times
                    # Check if column has an index
                    has_index = any(col in [c['column'] for c in idx_cols] 
                                  for idx_cols in existing_indexes.values())
                    
                    if not has_index:
                        col_info = next((c for c in table_info['columns'] if c['name'] == col), None)
                        if col_info and col_info['key'] != 'PRI':  # Not primary key
                            high_usage_cols.append((table, col, usage_count))
        
        high_usage_cols.sort(key=lambda x: x[2], reverse=True)
        for table, col, count in high_usage_cols[:20]:  # Top 20
            sql_statements.append(f"-- Used {count} times")
            sql_statements.append(f"CREATE INDEX IF NOT EXISTS idx_{table}_{col} ON `{table}`(`{col}`);\n")
        
        return "\n".join(sql_statements)
    
    def generate_api_enhancements(self):
        """Generate recommendations for API enhancements"""
        recommendations = []
        
        recommendations.append("="*80)
        recommendations.append("API ENHANCEMENT RECOMMENDATIONS")
        recommendations.append("="*80)
        
        # 1. Smart Suggestions Enhancement
        recommendations.append("\n1. SMART SUGGESTIONS FEATURE")
        recommendations.append("   Current Status: Table has 17 rows but columns not fully utilized")
        recommendations.append("   Location: /api/smart-suggestions endpoints")
        recommendations.append("   Action Required:")
        recommendations.append("   - Verify queries are selecting all relevant columns")
        recommendations.append("   - Add endpoints for feedback tracking (was_accepted, feedback_score)")
        recommendations.append("   - Implement confidence_score filtering")
        recommendations.append("   Example Query Fix:")
        recommendations.append("""
   SELECT 
       id, suggestion_type, input_context, suggestion_data, 
       confidence_score, was_accepted, feedback_score, feedback_notes,
       user_id, patient_context, created_at
   FROM smart_suggestions
   WHERE user_id = %s
   ORDER BY created_at DESC
   LIMIT 50
        """)
        
        # 2. Time Tracking Enhancement (from previous issue)
        recommendations.append("\n2. TIME TRACKING IN DASHBOARD")
        recommendations.append("   Current Status: Implemented in dashboard stats")
        recommendations.append("   Location: /api/dashboard/stats")
        recommendations.append("   Status: ✅ ALREADY IMPLEMENTED (lines 6126-6225)")
        
        # 3. Unused Features to Implement
        recommendations.append("\n3. FEATURES TO IMPLEMENT OR REMOVE")
        recommendations.append("\n   A. Patient Feedback System")
        recommendations.append("      Status: Table exists (patient_feedback) but no data or endpoints")
        recommendations.append("      Recommendation: Implement feedback collection after visits")
        recommendations.append("      Endpoint Needed: POST /api/patient-portal/feedback")
        recommendations.append("                       GET /api/feedback/statistics")
        
        recommendations.append("\n   B. Investigation/Lab Orders")
        recommendations.append("      Status: Tables exist but not used (investigation_orders, investigation_results)")
        recommendations.append("      Recommendation: Implement lab order management")
        recommendations.append("      Endpoints Needed: POST /api/visits/<id>/investigation-orders")
        recommendations.append("                        GET /api/investigation-orders/<id>/results")
        
        recommendations.append("\n   C. Patient Documents")
        recommendations.append("      Status: Table exists but no data")
        recommendations.append("      Recommendation: Implement document upload/management")
        recommendations.append("      Endpoint: Already exists at POST /api/patients/<id>/documents (line 7305)")
        recommendations.append("      Action: Verify endpoint is working and being used")
        
        # 4. Foreign Key Utilization
        recommendations.append("\n4. IMPROVE DATA RELATIONSHIPS")
        recommendations.append("   Action: Add JOIN queries to utilize foreign keys")
        recommendations.append("   Example - Audit Trail Enhancement:")
        recommendations.append("""
   SELECT 
       al.*,
       u.first_name, u.last_name, u.username,
       ur.role_name
   FROM audit_log al
   LEFT JOIN users u ON al.user_id = u.id
   LEFT JOIN user_roles ur ON u.role_id = ur.id
   WHERE al.created_at >= CURDATE() - INTERVAL 7 DAY
   ORDER BY al.created_at DESC
        """)
        
        # 5. Performance Optimizations
        recommendations.append("\n5. PERFORMANCE OPTIMIZATIONS")
        recommendations.append("   - Add indexes for frequently queried columns (see SQL cleanup script)")
        recommendations.append("   - Review queries with multiple JOINs for efficiency")
        recommendations.append("   - Consider materialized views for complex reporting queries")
        
        return "\n".join(recommendations)
    
    def generate_code_fixes(self):
        """Generate specific code fixes for app.py"""
        fixes = []
        
        fixes.append("="*80)
        fixes.append("SPECIFIC CODE FIXES FOR app.py")
        fixes.append("="*80)
        
        # Fix 1: Smart Suggestions Query Enhancement
        fixes.append("\n1. FIX: Smart Suggestions Endpoint")
        fixes.append("   Location: Around line 2700 in app.py")
        fixes.append("   Current Issue: Not querying all columns")
        fixes.append("   Replace the query with:")
        fixes.append("""
@app.route('/api/smart-suggestions', methods=['POST'])
@token_required
@role_required(['administrator', 'doctor', 'nurse'])
def get_smart_suggestions():
    try:
        data = request.get_json() or {}
        user_id = request.current_user['id']
        
        # Enhanced query with all columns
        query = \"\"\"
        SELECT 
            id, suggestion_type, input_context, suggestion_data, 
            confidence_score, was_accepted, feedback_score, feedback_notes,
            user_id, patient_context, created_at
        FROM smart_suggestions
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT 50
        \"\"\"
        
        suggestions = DatabaseManager.execute_query(query, (user_id,), fetch=True)
        return jsonify({'success': True, 'data': suggestions}), 200
        
    except Exception as e:
        logger.error(f"Smart suggestions error: {e}")
        return jsonify({'success': False, 'error': 'Failed to fetch suggestions'}), 500
        """)
        
        # Fix 2: Add Patient Feedback Endpoint
        fixes.append("\n2. ADD: Patient Feedback Endpoint")
        fixes.append("   Location: Add after patient portal endpoints")
        fixes.append("   New endpoint to implement:")
        fixes.append("""
@app.route('/api/patient-portal/feedback', methods=['POST'])
@patient_portal_token_required
def submit_patient_feedback():
    try:
        data = request.get_json() or {}
        patient_id = request.patient_id
        
        query = \"\"\"
        INSERT INTO patient_feedback 
        (patient_id, visit_id, feedback_type, overall_rating, 
         service_ratings, comments, is_anonymous, location_name)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        \"\"\"
        
        params = (
            patient_id,
            data.get('visit_id'),
            data.get('feedback_type', 'service_rating'),
            data.get('overall_rating'),
            json.dumps(data.get('service_ratings', {})),
            data.get('comments'),
            data.get('is_anonymous', False),
            data.get('location_name')
        )
        
        DatabaseManager.execute_query(query, params)
        return jsonify({'success': True, 'message': 'Feedback submitted'}), 201
        
    except Exception as e:
        logger.error(f"Patient feedback error: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500
        """)
        
        # Fix 3: Enhance Audit Log Queries
        fixes.append("\n3. FIX: Audit Log Queries with User Details")
        fixes.append("   Location: /api/activity/recent endpoint")
        fixes.append("   Enhancement: Add user details via JOIN")
        fixes.append("""
# Enhanced audit log query with user information
audit_activities = DatabaseManager.execute_query(
    \"\"\"
    SELECT 
        al.id, al.action, al.table_name, al.created_at,
        u.first_name, u.last_name, u.username,
        ur.role_name,
        CASE 
            WHEN al.table_name = 'patients' THEN 'patient'
            WHEN al.table_name = 'patient_visits' THEN 'visit'
            WHEN al.table_name = 'inventory_usage' THEN 'inventory'
            ELSE 'system'
        END AS activity_type
    FROM audit_log al
    LEFT JOIN users u ON al.user_id = u.id
    LEFT JOIN user_roles ur ON u.role_id = ur.id
    WHERE al.user_id = %s
    AND al.created_at >= NOW() - INTERVAL %s DAY
    ORDER BY al.created_at DESC
    LIMIT %s
    \"\"\",
    (user_id, days, limit),
    fetch=True,
)
        """)
        
        return "\n".join(fixes)
    
    def generate_report(self):
        """Generate comprehensive fix report"""
        print("\n" + "="*80)
        print("DATABASE & API ALIGNMENT FIX RECOMMENDATIONS")
        print("="*80)
        
        # Analyze issues
        self.analyze_smart_suggestions_issue()
        self.analyze_unused_foreign_keys()
        self.analyze_unimplemented_features()
        
        # Print summary
        print(f"\n📊 Issues Identified:")
        print(f"  • Critical: {len(self.fixes['critical'])}")
        print(f"  • High Priority: {len(self.fixes['high_priority'])}")
        print(f"  • Medium Priority: {len(self.fixes['medium_priority'])}")
        print(f"  • Low Priority: {len(self.fixes['low_priority'])}")
        
        # Print fixes
        for priority in ['critical', 'high_priority', 'medium_priority']:
            fixes = self.fixes[priority]
            if fixes:
                print(f"\n{'🚨' if priority == 'critical' else '⚠️'} {priority.upper().replace('_', ' ')}:")
                for i, fix in enumerate(fixes, 1):
                    print(f"\n  {i}. {fix['issue']}")
                    if 'recommendation' in fix:
                        print(f"     💡 {fix['recommendation']}")
                    if 'action' in fix:
                        print(f"     🔧 {fix['action']}")
        
        print("\n" + "="*80)
    
    def save_fixes(self):
        """Save all fix recommendations to files"""
        # Save SQL cleanup script
        sql_script = self.generate_sql_cleanup_script()
        sql_file = os.path.join(os.path.dirname(__file__), 'database_cleanup.sql')
        with open(sql_file, 'w', encoding='utf-8') as f:
            f.write(sql_script)
        print(f"\n💾 SQL cleanup script saved to: {sql_file}")
        
        # Save API enhancements
        api_enhancements = self.generate_api_enhancements()
        api_file = os.path.join(os.path.dirname(__file__), 'api_enhancement_recommendations.txt')
        with open(api_file, 'w', encoding='utf-8') as f:
            f.write(api_enhancements)
        print(f"📄 API enhancements saved to: {api_file}")
        
        # Save code fixes
        code_fixes = self.generate_code_fixes()
        code_file = os.path.join(os.path.dirname(__file__), 'code_fixes.txt')
        with open(code_file, 'w', encoding='utf-8') as f:
            f.write(code_fixes)
        print(f"🔧 Code fixes saved to: {code_file}")
        
        # Save JSON summary
        json_file = os.path.join(os.path.dirname(__file__), 'fix_recommendations.json')
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(self.fixes, f, indent=2, ensure_ascii=False)
        print(f"📊 Fix summary saved to: {json_file}")
    
    def run(self):
        """Run the fix analysis"""
        if not self.load_analysis():
            return False
        
        self.generate_report()
        self.save_fixes()
        
        return True


def main():
    """Main execution"""
    fixer = AlignmentFixer()
    
    if fixer.run():
        print("\n✅ Fix recommendations generated!")
        print("\n📋 Next Steps:")
        print("  1. Review database_cleanup.sql for optional cleanup")
        print("  2. Review api_enhancement_recommendations.txt for feature additions")
        print("  3. Apply code_fixes.txt to app.py")
        print("  4. Test changes in development environment")
        print("  5. Deploy to production after testing")
    else:
        print("\n❌ Failed to generate fixes")


if __name__ == "__main__":
    main()
