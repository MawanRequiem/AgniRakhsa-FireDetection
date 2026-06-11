import re

file_path = "e:/AgniRakhsa-FireDetection/backend/tests/test_fusion_notification.py"
with open(file_path, "r", encoding="utf-8") as f:
    code = f.read()

code = re.sub(
    r'(mock_supabase\.table\(\)\.select\(\)\.eq\(\)\.eq\(\)\.order\(\)\.limit\(\)\.execute\.return_value = MagicMock\([^\)]+\))',
    r'\1\n        mock_supabase.table().select().eq().execute.return_value = MagicMock(data=[{"name": "Room 1", "floor": "1", "building_name": "A"}])',
    code
)

code = re.sub(
    r'(mock_supabase\.table\(\)\.select\(\)\.eq\(\)\.order\(\)\.limit\(\)\.execute\.return_value = MagicMock\([^\)]+\))',
    r'\1\n        mock_supabase.table().select().eq().execute.return_value = MagicMock(data=[{"name": "Room 1", "floor": "1", "building_name": "A"}])',
    code
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(code)
