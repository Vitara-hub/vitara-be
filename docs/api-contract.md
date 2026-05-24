# 📡 Vitara AI — API Contract

> **Author:** Bagus  
> **Last Updated:** April 2026  
> **Status:** Draft  
> **Base URL:** `https://vitara-ai.onrender.com` (production) / `http://localhost:8000` (local)

---

## Konvensi Umum

- Semua request dan response menggunakan format **JSON**, kecuali endpoint yang menerima file/gambar.
- Semua endpoint menggunakan method **POST**.
- Header wajib untuk setiap request:

```
Content-Type: application/json
```

- Endpoint file upload (food) menggunakan:

```
Content-Type: multipart/form-data
```

**Format error response (semua endpoint):**

```json
{
  "detail": "Pesan error yang menjelaskan masalah"
}
```

---

## Endpoints

### 1. `POST /predict/journal`

Menganalisis teks jurnal pengguna untuk mendeteksi emosi dan tingkat stres.

**Request Body:**

```json
{
  "text": "Hari ini aku merasa sangat lelah dan tertekan karena deadline pekerjaan yang menumpuk.",
  "user_id": "usr_abc123"
}
```

| Field | Type | Required | Keterangan |
|-------|------|----------|-----------|
| `text` | `string` | ✅ | Teks jurnal pengguna. Min 10 karakter. |
| `user_id` | `string` | ❌ | ID unik pengguna untuk menyimpan riwayat kesehatan RAG. |

**Response `200 OK`:**

```json
{
  "emotion": "anxious",
  "stress_level": 0.82,
  "topics": ["deadline", "kerja"]
}
```

| Field | Type | Keterangan |
|-------|------|-----------|
| `emotion` | `string` | Emosi dominan yang terdeteksi (e.g. `happy`, `sad`, `anxious`, `angry`, `neutral`) |
| `stress_level` | `float` | Tingkat stres, skala 0.0 – 1.0 |
| `topics` | `string[]` | Topik-topik yang dideteksi dari teks |

---

### 2. `POST /predict/food`

Mengenali jenis makanan dari gambar dan mengestimasi kalori.

**Request Body:** `multipart/form-data`

| Field | Type | Required | Keterangan |
|-------|------|----------|-----------|
| `image` | `file` | ✅ | File gambar (JPEG/PNG). Max 5MB. |
| `user_id` | `string` | ❌ | ID unik pengguna untuk menyimpan riwayat kesehatan RAG. |

**Response `200 OK`:**

```json
{
  "foods": ["nasi goreng", "telur dadar"],
  "estimated_calories": 520
}
```

| Field | Type | Keterangan |
|-------|------|-----------|
| `foods` | `string[]` | Daftar makanan yang terdeteksi dalam gambar |
| `estimated_calories` | `integer` | Estimasi total kalori (kkal) |

---

### 3. `POST /predict/sleep`

Menghitung skor kualitas tidur pengguna berdasarkan data tidur.

**Request Body:**

```json
{
  "duration_hours": 5.5,
  "bedtime": "00:30",
  "wake_time": "06:00",
  "interruptions": 3,
  "sleep_debt_hours": 2.0,
  "user_id": "usr_abc123"
}
```

| Field | Type | Required | Keterangan |
|-------|------|----------|-----------|
| `duration_hours` | `float` | ✅ | Total durasi tidur dalam jam |
| `bedtime` | `string` | ✅ | Waktu mulai tidur, format `HH:MM` |
| `wake_time` | `string` | ✅ | Waktu bangun, format `HH:MM` |
| `interruptions` | `integer` | ✅ | Jumlah kali terbangun di malam hari |
| `sleep_debt_hours` | `float` | ❌ | Akumulasi utang tidur dalam jam |
| `user_id` | `string` | ❌ | ID unik pengguna untuk menyimpan riwayat kesehatan RAG. |

**Response `200 OK`:**

```json
{
  "quality_score": 72
}
```

| Field | Type | Keterangan |
|-------|------|-----------|
| `quality_score` | `integer` | Skor kualitas tidur, skala 0 – 100 |

---

### 4. `POST /predict/typing`

Mendeteksi tingkat stres berdasarkan pola pengetikan (keystroke dynamics).

**Request Body:**

```json
{
  "wpm": 58.3,
  "backspace_rate": 0.12,
  "inter_key_timings": [120, 98, 145, 87, 203, 110],
  "user_id": "usr_abc123"
}
```

| Field | Type | Required | Keterangan |
|-------|------|----------|-----------|
| `wpm` | `float` | ✅ | Kecepatan mengetik dalam kata per menit |
| `backspace_rate` | `float` | ✅ | Rasio tombol backspace terhadap total penekanan tombol (0.0 – 1.0) |
| `inter_key_timings` | `float[]` | ✅ | Array interval waktu antar tombol dalam milidetik |
| `user_id` | `string` | ❌ | ID unik pengguna untuk menyimpan riwayat kesehatan RAG. |

**Response `200 OK`:**

```json
{
  "stress_score": 0.74
}
```

| Field | Type | Keterangan |
|-------|------|-----------|
| `stress_score` | `float` | Tingkat stres dari pola pengetikan, skala 0.0 – 1.0 |

---

### 5. `POST /health/score`

Menghitung skor kesehatan holistik pengguna berdasarkan sub-hasil analisis yang tersedia (Mendukung data aktivitas parsial dengan pembobotan dinamis secara asinkron).

**Request Body (Lengkap):**

```json
{
  "user_id": "usr_abc123",
  "nlp_result": {
    "emotion": "anxious",
    "stress_level": 0.82
  },
  "food_result": {
    "estimated_calories": 520
  },
  "sleep_result": {
    "quality_score": 72
  },
  "typing_result": {
    "stress_score": 0.74
  }
}
```

**Request Body (Parsial - Contoh hanya Mood):**

```json
{
  "user_id": "usr_abc123",
  "nlp_result": {
    "emotion": "happy",
    "stress_level": 0.20
  }
}
```

| Field | Type | Required | Keterangan |
|-------|------|----------|-----------|
| `user_id` | `string` | ✅ | ID unik pengguna |
| `nlp_result` | `object` | ❌ | Output dari `/predict/journal`. Default: `null` |
| `food_result` | `object` | ❌ | Output dari `/predict/food`. Default: `null` |
| `sleep_result` | `object` | ❌ | Output dari `/predict/sleep`. Default: `null` |
| `typing_result` | `object` | ❌ | Output dari `/predict/typing`. Default: `null` |

**Response `200 OK` (Lengkap):**

```json
{
  "health_score": 78,
  "breakdown": {
    "mood": 70,
    "nutrition": 85,
    "stress": 65,
    "sleep": 72
  }
}
```

**Response `200 OK` (Parsial - Berdasarkan Contoh hanya Mood):**

```json
{
  "health_score": 84,
  "breakdown": {
    "mood": 90,
    "nutrition": null,
    "stress": 80,
    "sleep": null
  }
}
```

| Field | Type | Keterangan |
|-------|------|-----------|
| `health_score` | `integer` | Skor kesehatan keseluruhan, skala 0 – 100 |
| `breakdown.mood` | `integer` \| `null` | Skor dimensi suasana hati. `null` jika data tidak dikirim. |
| `breakdown.nutrition` | `integer` \| `null` | Skor dimensi nutrisi. `null` jika data tidak dikirim. |
| `breakdown.stress` | `integer` \| `null` | Skor dimensi bebas stres (100 = tidak stres). `null` jika data tidak dikirim. |
| `breakdown.sleep` | `integer` \| `null` | Skor dimensi tidur. `null` jika data tidak dikirim. |

---

### 6. `POST /companion/chat` (Streaming)

Mengirim pesan ke LLM Companion dan mendapatkan respons yang personal secara real-time melalui streaming.

**Request Body:**

```json
{
  "user_id": "usr_abc123",
  "message": "Aku merasa sangat lelah belakangan ini, apa yang harus aku lakukan?"
}
```

| Field | Type | Required | Keterangan |
|-------|------|----------|-----------|
| `user_id` | `string` | ✅ | ID unik pengguna (digunakan untuk mengambil memori dari ChromaDB) |
| `message` | `string` | ✅ | Pesan teks dari pengguna |

**Response `200 OK`:**

- **Content-Type:** `text/event-stream`

**Stream Structure:**

Respons dikirimkan menggunakan format Server-Sent Events (SSE). Setiap chunk diawali dengan `event: <nama_event>` dan `data: <json_payload>`.

1. **Event: `delta`** (Dikirim berkali-kali selama teks di-generate)

```json
{
  "token": "Sepertinya"
}
```

2. **Event: `final`** (Dikirim satu kali di akhir stream)

```json
{
  "full_response": "Sepertinya kamu cukup lelah hari ini. Berdasarkan data tidurmu, kamu hanya tidur 5.5 jam semalam. Yuk coba istirahat lebih cepat malam ini!",
  "recommendations": [
    "Tidur lebih awal, target 7–8 jam",
    "Kurangi kafein setelah jam 3 sore",
    "Coba teknik pernapasan 4-7-8 sebelum tidur"
  ]
}
```

| Event | Field | Type | Keterangan |
|-------|-------|------|-----------|
| `delta` | `token` | `string` | Potongan teks (token) yang dihasilkan oleh LLM |
| `final` | `full_response` | `string` | Respons lengkap setelah selesai streaming |
| `final` | `recommendations` | `string[]` | Daftar rekomendasi aksi berdasarkan konteks |

---

## HTTP Status Codes

| Status Code | Keterangan |
|-------------|-----------|
| `200 OK` | Request berhasil diproses |
| `422 Unprocessable Entity` | Validasi input gagal (field kurang / tipe salah) |
| `500 Internal Server Error` | Terjadi error pada sisi server / model inferensi |

---

## Swagger UI

Dokumentasi interaktif tersedia di:

```
GET /docs
```

> _Dokumen ini bersifat living document dan akan diperbarui seiring development._
