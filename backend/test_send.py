import httpx
import asyncio
import sys

async def run_tests():
    # Daftar nomor tes dari Pak Mawan
    targets = [
        "+62 812-1267-8789",
        "+62 877-7771-4068",
        "+62 821-1941-4131",
        "+62 895-7070-30905",
        "+62 821-2470-0252"
    ]
    
    BASE_URL = "http://localhost:8000/api/v1"
    
    print("🚀 [TEST SCRIPT] Mulai mencoba mengirimkan pesan ke 5 nomor target...")
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            print("1. Melakukan autentikasi ke backend FastAPI...")
            auth_response = await client.post(
                f"{BASE_URL}/auth/token",
                data={"username": "testuser", "password": "testpass"}
            )
            
            if auth_response.status_code != 200:
                print(f"❌ [GAGAL LOGIN] Status: {auth_response.status_code}")
                print(f"Response: {auth_response.text}")
                print("\n⚠️ PASTIKAN Server FastAPI sedang berjalan di port 8000 !!")
                sys.exit(1)
                
            token = auth_response.json().get("access_token")
            print("✅ Berhasil login dan mendapatkan Access Token JWT!\n")
            
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json"
            }
            
            # Pesan alert yang akan dikirim
            msg_text = "🔥 [TESTING Wir Jawir] Sistem deteksi berfungsi dan ini adalah pesan otomatis dari backend FastAPI menuju WhatsApp Gateway anda. Maaf yh nomornya jadi korban"
            
            print("2. Mengirimkan pesan melalui endpoint notifikasi...\n")
            
            for number in targets:
                payload = {
                    "phone": number,
                    "message": msg_text
                }
                
                print(f"   -> Mengirim ke {number} ...")
                res = await client.post(f"{BASE_URL}/notifications/whatsapp", json=payload, headers=headers)
                
                if res.status_code == 200:
                    print(f"      ✅ Berhasil ({res.status_code})")
                else:
                    print(f"      ❌ Gagal memanggil API ({res.status_code}) -> {res.text}")
                    if res.status_code == 500:
                         print("          (Periksa apakah WhatsApp Gateway (Express) sudah direstart dan berjalan di port 3001!)")

    except httpx.ConnectError:
        print("❌ [KONEKSI GAGAL] Tidak bisa terhubung ke http://localhost:8000.")
        print("⚠️ PASTIKAN Server FastAPI sedang menyala sebelum mengeksekusi script ini!")

if __name__ == "__main__":
    asyncio.run(run_tests())
