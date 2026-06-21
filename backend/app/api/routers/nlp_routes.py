from fastapi import APIRouter, HTTPException, Query
from app.services.x_service import XService
from app.core.db import supabase
from typing import Optional
from datetime import datetime, timedelta
import logging
import re

logger = logging.getLogger(__name__)

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
    elif 'neu' in raw or 'net' in raw:
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


def _save_sentiments_batch(records: list):
    """Simpan daftar hasil analisis ke tabel sentiment_analyses di Supabase menggunakan batch insert."""
    if not records:
        return
    try:
        supabase.table("sentiment_analyses").insert(records).execute()
    except Exception as e:
        logging.getLogger(__name__).error(f"Gagal menyimpan batch sentimen: {e}")


def _parse_tweet_date(raw_date) -> Optional[str]:
    """Parse format tanggal tweet dari berbagai variasi format GetXAPI ke ISO format."""
    if not raw_date:
        return None
    
    if isinstance(raw_date, (int, float)):
        try:
            if raw_date > 9999999999:
                raw_date = raw_date / 1000.0
            return datetime.fromtimestamp(raw_date).isoformat()
        except:
            return None

    raw_date_str = str(raw_date).strip()
    if not raw_date_str:
        return None

    raw_date_str = re.sub(r'\s+', ' ', raw_date_str)

    # 1. Standard Twitter format: "Sun Jan 25 13:05:46 +0000 2026"
    try:
        return datetime.strptime(raw_date_str, "%a %b %d %H:%M:%S %z %Y").isoformat()
    except Exception:
        pass

    # 2. Alternative Twitter format without timezone offset
    try:
        clean_tz = re.sub(r'[\+\-]\d{4}\s', '', raw_date_str)
        return datetime.strptime(clean_tz, "%a %b %d %H:%M:%S %Y").isoformat()
    except Exception:
        pass

    # 3. ISO 8601 format
    try:
        iso_str = raw_date_str.replace("Z", "+00:00")
        return datetime.fromisoformat(iso_str).isoformat()
    except Exception:
        pass

    # 4. YYYY-MM-DD HH:MM:SS format
    try:
        return datetime.strptime(raw_date_str, "%Y-%m-%d %H:%M:%S").isoformat()
    except Exception:
        pass

    return None


from pydantic import BaseModel

class AnalyzePayload(BaseModel):
    text: str

@router.post("/analyze")
async def analyze_report(payload: AnalyzePayload):
    """
    Endpoint untuk menganalisis teks laporan manual dari user.
    Hasilnya disimpan ke database.
    """
    if not NLP_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="NLP service belum tersedia di server."
        )

    text = payload.text
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

    # Enforce maximum tweet limit of 100
    if count > 100:
        count = 100
    if count < 1:
        count = 1

    # Date range configuration: max 5 days before now
    today_dt = datetime.now()
    default_since_dt = today_dt - timedelta(days=5)

    user_since_dt = None
    user_until_dt = None
    if since:
        try:
            user_since_dt = datetime.strptime(since, "%Y-%m-%d")
        except:
            pass
    if until:
        try:
            user_until_dt = datetime.strptime(until, "%Y-%m-%d")
        except:
            pass

    if not user_since_dt:
        user_since_dt = default_since_dt
    if not user_until_dt:
        user_until_dt = today_dt

    # Ensure range doesn't exceed 5 days ago
    if user_since_dt < default_since_dt:
        user_since_dt = default_since_dt
    if user_until_dt > today_dt:
        user_until_dt = today_dt
    if user_since_dt > user_until_dt:
        user_since_dt = user_until_dt - timedelta(days=1)

    # Divide the selected range into 4 equal segments
    total_seconds = (user_until_dt - user_since_dt).total_seconds()
    segment_duration = total_seconds / 4
    
    segments = []
    for idx in range(4):
        seg_since = user_since_dt + timedelta(seconds=idx * segment_duration)
        seg_until = user_since_dt + timedelta(seconds=(idx + 1) * segment_duration)
        segments.append((seg_since.strftime("%Y-%m-%d"), seg_until.strftime("%Y-%m-%d")))

    # Calculate tweets to fetch per segment (split into 4 segments)
    tweets_per_segment = max(1, count // 4)
    all_tweets = []
    
    # 1. Fetch tweets for each segment
    for seg_since_str, seg_until_str in segments:
        segment_cursor = None
        # We can fetch tweets_per_segment by calling the API
        api_result = x_service.fetch_tweets(
            query=query,
            count=tweets_per_segment,
            product=product,
            lang=lang,
            since=seg_since_str,
            until=seg_until_str,
            min_faves=min_faves,
            cursor=segment_cursor,
        )
        batch = api_result.get("tweets", [])
        if batch:
            all_tweets.extend(batch)

    if not all_tweets:
        return {
            "status": "info",
            "message": f"Tidak ditemukan tweet untuk kata kunci: {query}",
            "data": [],
            "has_more": False,
            "next_cursor": None,
        }

    results = []
    records_to_save = []
    # 2. Iterasi dan analisis tiap tweet menggunakan model Bi-LSTM
    # Batasi ke jumlah yang diminta (jika fetch berlebih)
    target_tweets = all_tweets[:count]
    
    # Ambil semua teks tweet untuk batch prediction
    contents = [t.get("text", "") for t in target_tweets]
    valid_indices = [idx for idx, text in enumerate(contents) if text.strip()]
    valid_texts = [contents[idx] for idx in valid_indices]
    
    try:
        predictions = nlp_service.predict_sentiment_batch(valid_texts)
    except Exception as e:
        logger.error(f"Failed to batch predict sentiments: {e}")
        predictions = [None] * len(valid_texts)
        
    # Buat lookup map dari index tweet ke hasil prediksi
    prediction_map = {}
    for idx, valid_idx in enumerate(valid_indices):
        prediction_map[valid_idx] = predictions[idx]
    
    for i, t in enumerate(target_tweets):
        content = t.get("text", "")
        if not content:
            continue
            
        prediction = prediction_map.get(i)
        if not prediction:
            continue
            
        # Analisis menggunakan otak NLP yang sama dengan laporan manual
        try:
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
            
            # Parse created_at dari GetXAPI dengan parser tangguh
            tweet_created = t.get("createdAt") or t.get("created_at")
            tweet_created_at = _parse_tweet_date(tweet_created)

            # Siapkan untuk simpan ke database (batch)
            records_to_save.append({
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
            logger.error(f"Failed to analyze tweet #{i+1}: {e}")
            continue

    # Simpan semua data sekaligus ke database (Batch Insert)
    if records_to_save:
        _save_sentiments_batch(records_to_save)
        
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
        
        # Tambahkan dynamic reason jika belum ada
        if result.data:
            for item in result.data:
                lbl = item.get("sentiment_label") or "conflict"
                txt = item.get("original_text") or ""
                if NLP_AVAILABLE:
                    item["reason"] = nlp_service._generate_reason(txt, lbl.upper())
                else:
                    item["reason"] = "Analisis sentimen berbasis teks."
        
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