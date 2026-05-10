from fastapi import APIRouter, HTTPException
from app.services.x_service import XService
import logging

# Inisialisasi router
router = APIRouter(
    prefix="/nlp",
    tags=["NLP Analysis"]
)

# Inisialisasi X Service
x_service = XService()

# ============================================================
# Lazy-load NLP service: untuk mencegah crash jika library
# tensorflow belum terpasang sempurna di server.
# ============================================================
NLP_AVAILABLE = False
nlp_service = None

try:
    from app.services.nlp_service import NLPService
    nlp_service = NLPService()
    NLP_AVAILABLE = True
except (ImportError, Exception) as e:
    logging.getLogger(__name__).warning(f"NLP service unavailable: {str(e)}")

@router.post("/analyze")
async def analyze_report(payload: dict):
    """
    Endpoint untuk menganalisis teks laporan manual dari user.
    """
    if not NLP_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="NLP service belum tersedia di server."
        )

    text = payload.get("text")
    if not text:
        raise HTTPException(status_code=400, detail="Teks laporan tidak boleh kosong")
    
    try:
        # Menggunakan method predict_sentiment dari nlp_service.py
        result = nlp_service.predict_sentiment(text)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saat analisis: {str(e)}")

@router.get("/analyze-x")
async def analyze_x_reports(query: str = "kebakaran", count: int = 10):
    """
    Endpoint baru: Mengambil data dari X (Twitter) via GetXAPI 
    dan menganalisisnya secara massal menggunakan AI IFRIT.
    """
    if not NLP_AVAILABLE:
        raise HTTPException(status_code=503, detail="AI Service tidak aktif.")

    # 1. Ambil data mentah dari X
    tweets = x_service.fetch_tweets(query=query, count=count)
    
    if not tweets:
        return {
            "status": "info",
            "message": f"Tidak ditemukan tweet untuk kata kunci: {query}",
            "data": []
        }

    results = []
    # 2. Iterasi dan analisis tiap tweet menggunakan model Bi-LSTM
    for i, t in enumerate(tweets):
        content = t.get("text", "")
        if not content:
            continue
            
        print(f"DEBUG: Menganalisis tweet ke-{i+1}: {content[:50]}...")
            
        # Analisis menggunakan otak NLP yang sama dengan laporan manual
        try:
            prediction = nlp_service.predict_sentiment(content)
            
            # Ambil username dengan lebih rapi
            author = "unknown"
            author_data = t.get("author") or t.get("user")
            
            if isinstance(author_data, dict):
                # Coba cari 'userName', 'screen_name', atau 'name'
                author = author_data.get("userName") or author_data.get("screen_name") or author_data.get("name") or "unknown"
            else:
                author = str(author_data) if author_data else "unknown"

            results.append({
                "tweet_id": t.get("id") or t.get("tweet_id") or str(i),
                "author": author,
                "text": content,
                "analysis": {
                    "label": prediction.get("label"),
                    "confidence": prediction.get("confidence"),
                    "reason": prediction.get("reason")
                }
            })
        except Exception as e:
            print(f"ERROR: Gagal menganalisis tweet ke-{i+1}: {str(e)}")
            continue
        
    return {
        "status": "success",
        "keyword": query,
        "total_analyzed": len(results),
        "data": results
    }