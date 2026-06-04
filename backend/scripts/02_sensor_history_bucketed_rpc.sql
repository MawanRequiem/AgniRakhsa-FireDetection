-- Dynamic bucketing sensor history RPC for AgniRaksha
CREATE OR REPLACE FUNCTION get_sensor_history_bucketed_rpc(
    p_device_id UUID DEFAULT NULL,
    p_room_id UUID DEFAULT NULL,
    p_minutes INT DEFAULT 30,
    p_bucket_seconds INT DEFAULT 10
)
RETURNS TABLE (
    bucket_time TIMESTAMP WITH TIME ZONE,
    sensor_id UUID,
    sensor_type VARCHAR,
    avg_value NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH filtered_sensors AS (
        SELECT s.id, s.sensor_type
        FROM sensors s
        WHERE 
            (p_device_id IS NULL OR s.device_id = p_device_id)
            AND (p_room_id IS NULL OR s.room_id = p_room_id)
    ),
    bucketed_readings AS (
        SELECT 
            -- Calculate bucket time by rounding to nearest bucket_seconds
            to_timestamp(floor(extract(epoch from r.reading_at) / p_bucket_seconds) * p_bucket_seconds) AT TIME ZONE 'UTC' AS b_time,
            r.sensor_id,
            r.value
        FROM sensor_readings r
        WHERE r.sensor_id IN (SELECT id FROM filtered_sensors)
          AND r.reading_at >= NOW() - (p_minutes || ' minutes')::INTERVAL
    )
    SELECT 
        b_time,
        br.sensor_id,
        fs.sensor_type::VARCHAR,
        ROUND(AVG(br.value), 2) AS avg_value
    FROM bucketed_readings br
    JOIN filtered_sensors fs ON br.sensor_id = fs.id
    GROUP BY b_time, br.sensor_id, fs.sensor_type
    ORDER BY b_time ASC;
END;
$$ LANGUAGE plpgsql;
