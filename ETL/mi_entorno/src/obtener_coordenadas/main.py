import time
import requests
import pandas as pd
import psycopg2

# =========================
# CONFIG
# =========================
DB_CONFIG = {
    "host": "localhost",
    "port": 5433,
    "dbname": "inmuebles",
    "user": "admin",
    "password": "admin123"
}

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
HEADERS = {
    "User-Agent": "fotocasa-geo/1.0 (contact@local.com)"
}

SLEEP = 1  # obligatorio

# =========================
# DB
# =========================
conn = psycopg2.connect(**DB_CONFIG)
conn.autocommit = True

# =========================
# 1️⃣ MUNICIPIOS SIN GEO
# =========================
df = pd.read_sql("""
    SELECT id, nombre
    FROM pipeline.ubicacion
    WHERE lat IS NULL
      AND nombre IS NOT NULL
""", conn)

if df.empty:
    print("✅ No hay municipios pendientes")
    exit()

# =========================
# 2️⃣ NORMALIZACIÓN
# =========================
df["nombre_norm"] = (
    df["nombre"]
      .str.lower()
      .str.replace(" capital", "", regex=False)
      .str.strip()
      .str.title()
)

# =========================
# 3️⃣ GEOCODING
# =========================
def geocode(municipio):
    params = {
        "q": f"{municipio}, España",
        "format": "json",
        "limit": 1,
        "countrycodes": "es"
    }

    r = requests.get(NOMINATIM_URL, params=params, headers=HEADERS, timeout=15)
    r.raise_for_status()
    data = r.json()

    if not data:
        return None

    return float(data[0]["lat"]), float(data[0]["lon"])

# =========================
# 4️⃣ UPDATE
# =========================
with conn.cursor() as cur:
    for _, row in df.iterrows():
        print(f"🌍 Geocodificando: {row['nombre_norm']}")

        try:
            geo = geocode(row["nombre_norm"])
            time.sleep(SLEEP)

            if not geo:
                print("  ⚠️ No encontrado")
                continue

            lat, lon = geo

            cur.execute("""
                UPDATE pipeline.ubicacion
                SET lat = %s,
                    lon = %s
                WHERE id = %s
            """, (lat, lon, row["id"]))

            print(f"  ✅ OK ({lat}, {lon})")

        except Exception as e:
            print(f"  ❌ Error: {e}")

conn.close()
