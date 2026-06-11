code = """
# ═══════════════════════════════════════════════════════════════════════════════
# Spam Prevention and Cooldown (Negative Tests)
# ═══════════════════════════════════════════════════════════════════════════════

class TestAlertSpamPreventionAndCooldown:
    \"\"\"Tests for Rules 1, 2, 3 in _create_alert to prevent spam.\"\"\"

    @pytest.mark.asyncio
    @patch("app.services.fusion_service.supabase")
    async def test_rule1_same_risk_level_bypassed(self, mock_supabase):
        \"\"\"Rule 1: Same unacknowledged risk level -> ignored.\"\"\"
        # Mock supabase to return an active alert with same risk
        mock_supabase.table().select().eq().eq().order().limit().execute.return_value = MagicMock(
            data=[{"id": "1", "risk_level": "high", "created_at": "2026-06-01T00:00:00Z"}]
        )
        
        await _create_alert(room_id="room1", fusion_result_id="res1", risk_level="high", fusion_score=0.8)
        
        # Verify NO new insert happened
        mock_supabase.table().insert.assert_not_called()

    @pytest.mark.asyncio
    @patch("app.services.fusion_service.supabase")
    @patch("app.services.fusion_service.manager.broadcast")
    async def test_rule2_escalation_bypasses_cooldown(self, mock_broadcast, mock_supabase):
        \"\"\"Rule 2: Lower risk to higher risk -> Escalates immediately.\"\"\"
        # Mock supabase to return an active alert with LOWER risk
        mock_supabase.table().select().eq().eq().order().limit().execute.return_value = MagicMock(
            data=[{"id": "1", "risk_level": "medium", "created_at": "2026-06-01T00:00:00Z"}]
        )
        # Mock insert success
        mock_supabase.table().insert().execute.return_value = MagicMock(data=[{"id": "new", "created_at": "2026-06-01T00:01:00Z"}])
        
        await _create_alert(room_id="room1", fusion_result_id="res1", risk_level="critical", fusion_score=0.9)
        
        # Verify insert HAPPENED (Escalation)
        mock_supabase.table().insert.assert_called_once()
        mock_broadcast.assert_called()

    @pytest.mark.asyncio
    @patch("app.services.fusion_service.supabase")
    async def test_rule3_grace_period_enforced(self, mock_supabase):
        \"\"\"Rule 3: After ack, enforce cooldown before sending new alert.\"\"\"
        import time
        from datetime import datetime, timezone
        
        # No unacknowledged alerts
        mock_supabase.table().select().eq().eq().order().limit().execute.return_value = MagicMock(data=[])
        # BUT there is an acknowledged alert just 10 seconds ago
        recent_time = datetime.now(timezone.utc).isoformat()
        mock_supabase.table().select().eq().order().limit().execute.return_value = MagicMock(
            data=[{"id": "1", "risk_level": "high", "created_at": recent_time}]
        )
        
        await _create_alert(room_id="room1", fusion_result_id="res1", risk_level="high", fusion_score=0.8)
        
        # Verify NO new insert because of cooldown
        mock_supabase.table().insert.assert_not_called()


# ═══════════════════════════════════════════════════════════════════════════════
# Firebase Cloud Messaging & Payload
# ═══════════════════════════════════════════════════════════════════════════════

class TestFirebaseCloudMessagingAndPayload:
    
    @pytest.mark.asyncio
    @patch("app.services.fusion_service.send_push")
    @patch("app.services.fusion_service.supabase")
    async def test_image_delivery_payload_contains_svg(self, mock_supabase, mock_send_push):
        \"\"\"TestImageDeliveryPayload: Ensures image_url is propagated down the pipeline.\"\"\"
        mock_supabase.table().select().eq().eq().order().limit().execute.return_value = MagicMock(data=[])
        mock_supabase.table().select().eq().order().limit().execute.return_value = MagicMock(data=[])
        mock_supabase.table().insert().execute.return_value = MagicMock(data=[{"id": "new", "created_at": "2026-06-01T00:01:00Z"}])
        
        test_image_url = "http://example.com/mock_fire.svg"
        
        await _create_alert(
            room_id="room1", 
            fusion_result_id="res1", 
            risk_level="critical", 
            fusion_score=0.9,
            image_url=test_image_url
        )
        
        # Give asyncio tasks a moment to run
        import asyncio
        await asyncio.sleep(0.1)
        
        # 1. Verify it was inserted to Supabase with image_url
        insert_args = mock_supabase.table().insert.call_args[0][0]
        assert insert_args["image_url"] == test_image_url
        
        # 2. Verify FCM push payload contains the image_url
        assert mock_send_push.called
        kwargs = mock_send_push.call_args[1]
        assert kwargs.get("image_url") == test_image_url
        
        # 3. Verify data payload structure
        data_payload = kwargs.get("data")
        assert data_payload["image_url"] == test_image_url
        assert data_payload["type"] == "FIRE_ALERT"
        assert "fusion_score" in data_payload

    @pytest.mark.asyncio
    @patch("app.services.fusion_service.send_push")
    @patch("app.services.fusion_service.supabase")
    async def test_medium_risk_triggers_fcm(self, mock_supabase, mock_send_push):
        \"\"\"Ensure medium risk triggers the alert and sets FCM label to MEDIUM.\"\"\"
        mock_supabase.table().select().eq().eq().order().limit().execute.return_value = MagicMock(data=[])
        mock_supabase.table().select().eq().order().limit().execute.return_value = MagicMock(data=[])
        mock_supabase.table().insert().execute.return_value = MagicMock(data=[{"id": "new", "created_at": "2026-06-01T00:01:00Z"}])
        
        await _create_alert(
            room_id="room1", 
            fusion_result_id="res1", 
            risk_level="medium", 
            fusion_score=0.55
        )
        
        import asyncio
        await asyncio.sleep(0.1)
        
        # FCM should be called
        assert mock_send_push.called
        kwargs = mock_send_push.call_args[1]
        
        # Title and body should indicate MEDIUM
        assert "MEDIUM" in kwargs["title"]
        assert "MEDIUM" in kwargs["body"]
        assert kwargs["data"]["risk_level"] == "medium"


# ═══════════════════════════════════════════════════════════════════════════════
# Image-Only Veto Logic (Regression)
# ═══════════════════════════════════════════════════════════════════════════════

class TestImageOnlyVetoLogic:

    @pytest.mark.asyncio
    @patch("app.services.fusion_service.supabase")
    async def test_image_vetoed_by_safe_sensors(self, mock_supabase):
        \"\"\"If image is 1.0 but sensors are safe (0.0), it should be Medium Risk (vetoed).\"\"\"
        # sensor_snapshot is NOT empty, meaning sensors are active
        snapshot = {"mq2": 150} # Safe value
        
        res = await run_fusion(
            image_score=1.0, 
            room_id=None,
            sensor_snapshot=snapshot
        )
        
        # Image score = 1.0, Sensor score = 0.0, Fusion = 0.55 * 1.0 = 0.55
        assert res["risk_level"] == "medium"
        assert res["fusion_score"] == 0.55

    @pytest.mark.asyncio
    @patch("app.services.fusion_service.supabase")
    async def test_image_only_mode_when_sensors_offline(self, mock_supabase):
        \"\"\"If image is 1.0 and sensors are OFFLINE (empty), it triggers Critical.\"\"\"
        # snapshot is empty
        snapshot = {}
        
        res = await run_fusion(
            image_score=1.0, 
            room_id=None,
            sensor_snapshot=snapshot
        )
        
        # Image score = 1.0, Sensor score = 0.0, sensors offline -> is_image_only mode = True
        # Fusion score = 1.0
        assert res["risk_level"] == "critical"
        assert res["fusion_score"] == 1.0
"""

with open("e:/AgniRakhsa-FireDetection/backend/tests/test_fusion_notification.py", "a", encoding="utf-8") as f:
    f.write("\n" + code + "\n")
