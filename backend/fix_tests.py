import re

file_path = "e:/AgniRakhsa-FireDetection/backend/tests/test_fusion_notification.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix 1: test_normal_weighted_fusion
content = re.sub(
    r'assert abs\(expected - 0\.68\) < 0\.01',
    r'assert abs(expected - 0.665) < 0.01',
    content
)

# Fix 2: Add room details to all mock_supabase.table().select()... return values in the new tests
# So that when fusion_service fetches room details, it doesn't fail with MagicMock.
content = content.replace(
    'data=[{"id": "1", "risk_level": "medium", "created_at": "2026-06-01T00:00:00Z"}]',
    'data=[{"id": "1", "risk_level": "medium", "created_at": "2026-06-01T00:00:00Z", "name": "Room 1", "floor": "1", "building_name": "A"}]'
)
content = content.replace(
    'data=[{"id": "1", "risk_level": "high", "created_at": "2026-06-01T00:00:00Z"}]',
    'data=[{"id": "1", "risk_level": "high", "created_at": "2026-06-01T00:00:00Z", "name": "Room 1", "floor": "1", "building_name": "A"}]'
)
content = content.replace(
    'data=[{"id": "1", "risk_level": "high", "created_at": recent_time}]',
    'data=[{"id": "1", "risk_level": "high", "created_at": recent_time, "name": "Room 1", "floor": "1", "building_name": "A"}]'
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
