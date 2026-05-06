from fastapi import APIRouter, HTTPException

# Inisialisasi router
router = APIRouter(
    prefix="/nlp",
    tags=["NLP Analysis"]
)

# ============================================================
# Lazy-load NLP service: jangan crash seluruh backend jika
# tensorflow belum terinstall (optional dependency)
# ============================================================
NLP_AVAILABLE = False
nlp_service = None

try:
    from app.services.nlp_service import NLPService
    nlp_service = NLPService()
    NLP_AVAILABLE = True
except (ImportError, Exception):
    import logging
    logging.getLogger(__name__).warning(
        "NLP service unavailable: tensorflow not installed. "
        "Install with: pip install tensorflow-cpu Sastrawi"
    )

@router.post("/analyze")
async def analyze_report(payload: dict):
    """
    Endpoint untuk menganalisis teks laporan kebakaran.
    Input: {"text": "isi laporan..."}
    """
    if not NLP_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="NLP service belum tersedia. Library tensorflow belum terinstall di server."
        )

    text = payload.get("text")
    if not text:
        raise HTTPException(status_code=400, detail="Teks laporan tidak boleh kosong")
    
    try:
        result = nlp_service.predict_sentiment(text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal menganalisis teks: {str(e)}")