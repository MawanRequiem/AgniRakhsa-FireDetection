-- high-concurrency ingestion RPC function for AgniRaksha
CREATE OR REPLACE FUNCTION ingest_sensor_batch_rpc(
    p_device_id UUID,
    p_readings JSONB
)
RETURNS VOID AS $$
DECLARE
    v_now TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
    -- 1. Mass insert into sensor_readings
    INSERT INTO sensor_readings (sensor_id, value, reading_at)
    SELECT 
        (r->>'sensor_id')::UUID,
        (r->>'value')::NUMERIC,
        COALESCE((r->>'reading_at')::TIMESTAMP WITH TIME ZONE, v_now)
    FROM jsonb_array_elements(p_readings) AS r;

    -- 2. Update status and last_seen for the device
    UPDATE devices 
    SET last_seen = v_now, status = 'online'
    WHERE id = p_device_id;

    -- 3. Bulk update sensors current_value and last_update via a table join
    UPDATE sensors AS s
    SET 
        current_value = r.new_value,
        last_update = v_now
    FROM (
        SELECT 
            (elem->>'sensor_id')::UUID AS sensor_id,
            (elem->>'value')::NUMERIC AS new_value
        FROM jsonb_array_elements(p_readings) AS elem
    ) AS r
    WHERE s.id = r.sensor_id;
END;
$$ LANGUAGE plpgsql;
