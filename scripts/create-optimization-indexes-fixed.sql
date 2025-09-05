-- Advanced Database Query Optimization Indexes
-- These indexes optimize common query patterns without modifying table structure

-- Optimize activity listing queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_composite_status_time 
ON activities(status, timestamp DESC) WHERE status != 'Resolved';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_assigned_user_status 
ON activities(assigned_to_user_id, status, timestamp DESC) 
WHERE assigned_to_user_id IS NOT NULL;

-- Optimize user workload calculations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_user_completion 
ON activities(user_id, status, timestamp) 
WHERE status = 'Resolved';

-- Optimize real-time update queries (simplified without time function)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_recent_timestamp 
ON activities(timestamp DESC);

-- Optimize deadline management queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_deadline_overdue 
ON activities(deadline_date, status) 
WHERE deadline_date IS NOT NULL AND status IN ('Open', 'In Progress');

-- Optimize category-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_category_status 
ON activities(category_id, status, timestamp DESC);

-- Optimize location-based queries for geographic searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_location_geo 
ON activities(location, latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Optimize search queries by subcategory and location
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_search_terms 
ON activities(subcategory, location);

-- Optimize activity updates for timeline queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_updates_activity_time 
ON activity_updates(activity_id, timestamp DESC);

-- Optimize user assignment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_assignments_user_status 
ON activity_assignments(user_id, status, assigned_at DESC);

-- Optimize WhatsApp message queries for real-time processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_messages_unprocessed 
ON whatsapp_messages(processed, timestamp) 
WHERE processed = false;

-- Optimize user presence and activity tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role_active 
ON users(role, id) 
WHERE role IN ('staff', 'admin', 'supervisor');

-- Monitor index usage after creation (run separately)
-- SELECT * FROM pg_stat_user_indexes WHERE indexrelname LIKE 'idx_%';