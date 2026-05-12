from dotenv import load_dotenv
import requests
import logging
import os

# Muat .env dari folder root backend
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
load_dotenv(os.path.join(base_dir, '.env'))

class XService:
    def __init__(self):
        self.api_key = os.getenv("X_API_KEY")
        self.base_url = "https://api.getxapi.com/twitter/tweet/advanced_search"
        
        if self.api_key:
            print(f"DEBUG: API Key terdeteksi ({self.api_key[:10]}...)")

    def fetch_tweets(
        self,
        query: str = "kebakaran",
        count: int = 20,
        product: str = "Latest",
        lang: str = None,
        since: str = None,
        until: str = None,
        min_faves: int = None,
        cursor: str = None,
    ):
        """
        Mengambil tweet dari GetXAPI Advanced Search endpoint.
        
        Args:
            query: Kata kunci pencarian (mendukung advanced operators).
            count: Jumlah tweet yang diambil (max ~20 per panggilan).
            product: 'Latest' atau 'Top' (sorting).
            lang: Filter bahasa (contoh: 'id', 'en').
            since: Tanggal mulai filter (format: 'YYYY-MM-DD').
            until: Tanggal akhir filter (format: 'YYYY-MM-DD').
            min_faves: Minimum jumlah likes.
            cursor: Cursor untuk paginasi.
        """
        if not self.api_key:
            logging.error("X_API_KEY kosong!")
            return {"tweets": [], "has_more": False, "next_cursor": None}

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        # Bangun query string dengan advanced operators dari GetXAPI
        # Referensi: https://docs.getxapi.com/docs/tweets/advanced-search
        q_parts = [query]
        if lang:
            q_parts.append(f"lang:{lang}")
        if since:
            q_parts.append(f"since:{since}")
        if until:
            q_parts.append(f"until:{until}")
        if min_faves and min_faves > 0:
            q_parts.append(f"min_faves:{min_faves}")
        
        full_query = " ".join(q_parts)
        
        params = {
            "q": full_query,
            "product": product,
        }
        
        if cursor:
            params["cursor"] = cursor
        
        try:
            response = requests.get(self.base_url, headers=headers, params=params, timeout=15)
            
            print(f"DEBUG: GetXAPI Status: {response.status_code}, Query: {full_query}")
            
            if response.status_code == 200:
                data = response.json()
                
                tweets = data.get("tweets") or data.get("results") or data.get("data") or []
                
                if isinstance(data, dict) and not tweets:
                    if "data" in data:
                        tweets = data["data"]
                
                has_more = data.get("has_more", False)
                next_cursor = data.get("next_cursor", None)
                
                print(f"DEBUG: Berhasil mengambil {len(tweets)} tweet. Has more: {has_more}")
                return {
                    "tweets": tweets,
                    "has_more": has_more,
                    "next_cursor": next_cursor
                }
            else:
                print(f"DEBUG ERROR: {response.status_code} - {response.text}")
                return {"tweets": [], "has_more": False, "next_cursor": None}
        except Exception as e:
            logging.error(f"X Service Exception: {e}")
            return {"tweets": [], "has_more": False, "next_cursor": None}