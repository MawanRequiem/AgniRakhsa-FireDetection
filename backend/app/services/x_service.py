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
        # Pastikan URL menggunakan /twitter/search
        self.base_url = "https://api.getxapi.com/twitter/tweet/advanced_search"
        
        if self.api_key:
            print(f"DEBUG: API Key terdeteksi ({self.api_key[:10]}...)")

    def fetch_tweets(self, query: str = "kebakaran", count: int = 10):
        if not self.api_key:
            logging.error("X_API_KEY kosong!")
            return []

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        
        params = {
            "q": query,
            "product": "Latest" 
        }
        
        try:
            response = requests.get(self.base_url, headers=headers, params=params, timeout=10)
            
            # LOG UNTUK DEBUG DATA ASLI
            print(f"DEBUG: GetXAPI Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                # Debug data jika perlu: print(f"DEBUG: Respon API Penuh: {data}")
                
                # GetXAPI advanced_search biasanya mengembalikan data dalam key 'tweets' atau 'instructions'
                # Kita coba ambil dari list 'tweets' yang biasanya ada di root atau di dalam data
                tweets = data.get("tweets") or data.get("results") or data.get("data") or []
                
                # Jika data dalam format X v2 (data: [...])
                if isinstance(data, dict) and not tweets:
                    if "data" in data:
                        tweets = data["data"]
                
                print(f"DEBUG: Berhasil mengambil {len(tweets)} tweet asli.")
                return tweets
            else:
                print(f"DEBUG ERROR: {response.status_code} - {response.text}")
                return []
        except Exception as e:
            logging.error(f"X Service Exception: {e}")
            return []