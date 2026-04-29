from fastapi import APIRouter, HTTPException, Depends
from app.services.nlp_service import NLPService

# Inisialisasi router
router = APIRouter(
    prefix="/nlp",
    tags=["NLP Analysis"]
)

# Inisialisasi service
nlp_service = NLPService()

@router.post("/analyze")
async def analyze_report(payload: dict):
    """
    Endpoint untuk menganalisis teks laporan kebakaran.
    Input: {"text": "isi laporan..."}
    """
    text = payload.get("text")
    if not text:
        raise HTTPException(status_code=400, detail="Teks laporan tidak boleh kosong")
    
    try:
        # Memanggil fungsi predict_sentiment dari nlp_service.py yang sudah kita update
        result = nlp_service.predict_sentiment(text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menganalisis teks: {str(e)}")