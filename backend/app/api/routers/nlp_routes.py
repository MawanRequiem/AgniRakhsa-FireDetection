from fastapi import APIRouter, HTTPException, Query
from app.services.x_service import XService
from app.core.db import supabase
from typing import Optional
from datetime import datetime
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


def _normalize_label(raw: str) -> str:
    """Normalisasi label sentimen dari model ke format standar."""
    raw = str(raw).lower().strip()
    if 'neg' in raw:
        return 'negative'
    elif 'pos' in raw:
        return 'positive'
    elif 'neu' in raw:
        return 'netral'
    elif 'con' in raw:
        return 'conflict'
    return 'conflict'


def _save_sentiment(record: dict):
    """Simpan hasil analisis ke tabel sentiment_analyses di Supabase."""
    try:
        supabase.table("sentiment_analyses").insert(record).execute()
    except Exception as e:
        logging.getLogger(__name__).error(f"Gagal menyimpan sentimen: {e}")


@router.post("/analyze")
async def analyze_report(payload: dict):
    """
    Endpoint untuk menganalisis teks laporan manual dari user.
    Hasilnya disimpan ke database.
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
        
        # Normalisasi label
        label = _normalize_label(result.get("label", ""))
        confidence = result.get("confidence", 0)
        if confidence > 1:
            confidence = confidence / 100
        
        # Simpan ke database
        _save_sentiment({
            "source": "manual",
            "original_text": text,
            "sentiment_label": label,
            "confidence": confidence,
            "model_name": "bi-lstm",
        })
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saat analisis: {str(e)}")


@router.get("/analyze-x")
async def analyze_x_reports(
    query: str = "kebakaran",
    count: int = 20,
    product: str = Query("Latest", description="Sorting: 'Latest' atau 'Top'"),
    lang: Optional[str] = Query(None, description="Filter bahasa, contoh: 'id', 'en'"),
    since: Optional[str] = Query(None, description="Tanggal mulai, format: 'YYYY-MM-DD'"),
    until: Optional[str] = Query(None, description="Tanggal akhir, format: 'YYYY-MM-DD'"),
    min_faves: Optional[int] = Query(None, description="Minimum jumlah likes"),
    cursor: Optional[str] = Query(None, description="Cursor untuk paginasi"),
):
    """
    Mengambil data dari X (Twitter) via GetXAPI Advanced Search,
    menganalisisnya menggunakan AI IFRIT (Bi-LSTM),
    dan menyimpan hasilnya ke database.
    
    Mendukung semua advanced search operators dari GetXAPI:
    - product: 'Latest' atau 'Top'
    - lang: Filter bahasa (id, en, dll)
    - since/until: Rentang tanggal
    - min_faves: Minimum likes
    - cursor: Paginasi
    """
    if not NLP_AVAILABLE:
        raise HTTPException(status_code=503, detail="AI Service tidak aktif.")

    # 1. Ambil data dari X (Mendukung Multi-Page jika count > 20)
    all_tweets = []
    current_cursor = cursor
    pages_to_fetch = (count + 19) // 20 # Estimasi jumlah page (GetXAPI ~20 per page)
    
    for page in range(pages_to_fetch):
        api_result = x_service.fetch_tweets(
            query=query,
            count=20, # GetXAPI fix ~20 per call
            product=product,
            lang=lang,
            since=since,
            until=until,
            min_faves=min_faves,
            cursor=current_cursor,
        )
        
        batch = api_result.get("tweets", [])
        if not batch:
            break
            
        all_tweets.extend(batch)
        current_cursor = api_result.get("next_cursor")
        
        # Berhenti jika sudah cukup atau tidak ada cursor lagi
        if len(all_tweets) >= count or not current_cursor:
            break

    if not all_tweets:
        return {
            "status": "info",
            "message": f"Tidak ditemukan tweet untuk kata kunci: {query}",
            "data": [],
            "has_more": False,
            "next_cursor": None,
        }

    results = []
    # 2. Iterasi dan analisis tiap tweet menggunakan model Bi-LSTM
    # Batasi ke jumlah yang diminta (jika fetch berlebih)
    target_tweets = all_tweets[:count]
    
    for i, t in enumerate(target_tweets):
        content = t.get("text", "")
        if not content:
            continue
            
        # Analisis menggunakan otak NLP yang sama dengan laporan manual
        try:
            prediction = nlp_service.predict_sentiment(content)
            
            # Ambil username dengan lebih rapi
            author = "unknown"
            author_data = t.get("author") or t.get("user")
            
            if isinstance(author_data, dict):
                author = author_data.get("userName") or author_data.get("screen_name") or author_data.get("name") or "unknown"
            else:
                author = str(author_data) if author_data else "unknown"

            # Normalisasi label
            label = _normalize_label(prediction.get("label", ""))
            confidence = prediction.get("confidence", 0)
            if confidence > 1:
                confidence = confidence / 100

            # Data engagement dari API GetXAPI
            tweet_likes = t.get("likeCount") or t.get("favorite_count") or 0
            tweet_retweets = t.get("retweetCount") or t.get("retweet_count") or 0
            tweet_views = t.get("viewCount") or 0
            tweet_url = t.get("url") or t.get("twitterUrl") or ""
            tweet_id_str = t.get("id") or t.get("tweet_id") or str(i)
            tweet_lang = t.get("lang") or ""
            
            # Parse created_at dari GetXAPI (format: "Sun Jan 25 13:05:46 +0000 2026")
            tweet_created = t.get("createdAt") or t.get("created_at")
            tweet_created_at = None
            if tweet_created:
                try:
                    tweet_created_at = datetime.strptime(tweet_created, "%a %b %d %H:%M:%S %z %Y").isoformat()
                except:
                    tweet_created_at = None

            # Simpan ke database
            _save_sentiment({
                "source": "x_crawl",
                "original_text": content,
                "search_query": query,
                "sentiment_label": label,
                "confidence": confidence,
                "tweet_id": str(tweet_id_str),
                "tweet_author": author,
                "tweet_url": tweet_url,
                "tweet_likes": tweet_likes,
                "tweet_retweets": tweet_retweets,
                "tweet_views": tweet_views,
                "tweet_created_at": tweet_created_at,
                "tweet_lang": tweet_lang,
                "model_name": "bi-lstm",
            })

            results.append({
                "tweet_id": str(tweet_id_str),
                "author": author,
                "text": content,
                "url": tweet_url,
                "likes": tweet_likes,
                "retweets": tweet_retweets,
                "views": tweet_views,
                "lang": tweet_lang,
                "created_at": tweet_created or "",
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
        "data": results,
        "has_more": api_result.get("has_more", False),
        "next_cursor": api_result.get("next_cursor"),
    }


@router.get("/history")
async def get_sentiment_history(
    source: Optional[str] = Query(None, description="Filter sumber: 'manual' atau 'x_crawl'"),
    label: Optional[str] = Query(None, description="Filter label: 'negative', 'positive', 'netral', 'conflict'"),
    search_query: Optional[str] = Query(None, description="Filter berdasarkan keyword pencarian"),
    limit: int = Query(50, description="Jumlah hasil per halaman"),
    offset: int = Query(0, description="Offset untuk paginasi"),
):
    """
    Endpoint untuk mengambil riwayat hasil analisis sentimen dari database.
    Mendukung filter berdasarkan source, label, dan search_query.
    """
    try:
        query = supabase.table("sentiment_analyses") \
            .select("*") \
            .order("created_at", desc=True) \
            .limit(limit) \
            .offset(offset)
        
        if source:
            query = query.eq("source", source)
        if label:
            query = query.eq("sentiment_label", label)
        if search_query:
            query = query.ilike("search_query", f"%{search_query}%")
        
        result = query.execute()
        
        # Hitung total untuk paginasi
        count_query = supabase.table("sentiment_analyses").select("id", count="exact")
        if source:
            count_query = count_query.eq("source", source)
        if label:
            count_query = count_query.eq("sentiment_label", label)
        if search_query:
            count_query = count_query.ilike("search_query", f"%{search_query}%")
        count_result = count_query.execute()
        
        return {
            "status": "success",
            "data": result.data,
            "total": count_result.count if count_result.count else len(result.data),
            "limit": limit,
            "offset": offset,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error mengambil history: {str(e)}")


@router.get("/stats")
async def get_sentiment_stats():
    """
    Endpoint untuk mengambil statistik ringkasan sentimen dari database.
    """
    try:
        result = supabase.table("sentiment_analyses").select("sentiment_label").execute()
        
        stats = {"negative": 0, "positive": 0, "netral": 0, "conflict": 0, "total": 0}
        
        if result.data:
            for row in result.data:
                label = row.get("sentiment_label", "")
                if label in stats:
                    stats[label] += 1
                stats["total"] += 1
        
        return {
            "status": "success",
            "stats": stats,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error mengambil stats: {str(e)}")