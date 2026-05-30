# Vitara Backend Gateway API Contract

## Scope

Dokumen ini adalah kontrak **Frontend <-> Backend Gateway** (`vitara-be`).

- Backend base URL local: `http://localhost:3000`
- Backend base path: `/api`
- AI service contract: `/home/alfazari/projects/kuliah/mbkm/codingcamp/capstone/vitara-ai/vitara-ai-service/docs/api-contract.md`
- Backend bertanggung jawab untuk auth verification, persistence ke Supabase, upload storage, dan orchestration ke AI service.

## Conventions

- JSON request wajib memakai `Content-Type: application/json`.
- Endpoint upload food image memakai `multipart/form-data`.
- Endpoint protected wajib memakai `Authorization: Bearer <supabase_access_token>`.
- Date-time memakai ISO 8601.
- Semua response backend memakai envelope berikut.

Success:

```json
{
  "status": "success",
  "data": {}
}
```

Error:

```json
{
  "status": "error",
  "message": "Human readable message"
}
```

## Auth And Middleware

- `authMiddleware` membaca Bearer token dari header `Authorization`.
- Token diverifikasi lewat `supabaseAdmin.auth.getUser(token)`.
- Jika valid, middleware set `req.userId = data.user.id`.
- Jika header hilang, format salah, token invalid, atau token expired, backend mengembalikan `401`.
- Route public: `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/google`, `POST /api/auth/google/callback`, `POST /api/auth/refresh`.
- Route lain protected.

Catatan implementasi: repository/controller saat ini memakai Supabase service-role client di backend dan melakukan scoping data dengan `user_id` dari token. RLS tetap didefinisikan di migration untuk akses client-side/anon flow.

## AI Service Orchestration

Backend mengirim `user_id` ke AI service memakai Supabase Auth user id.

| Backend endpoint | AI endpoint | Status implementasi |
|---|---|---|
| `POST /api/journal/analyze` | `POST /predict/journal` | Memanggil AI service. Jika gagal/non-OK, fallback ke `neutral`, `stressLevel=0.5`, `topics=["general"]`. |
| `POST /api/food/analyze-image` | `POST /predict/food` | Upload image ke Supabase Storage, memanggil AI service, lalu simpan hasil. Jika AI gagal, request gagal `502` dan upload dibersihkan. |
| `POST /api/sleep/analyze` | `POST /predict/sleep` | Memanggil AI service. Jika gagal/non-OK, fallback deterministic local. |
| `POST /api/typing/analyze` | `POST /predict/typing` | Memanggil AI service. Jika gagal/non-OK, fallback deterministic local. |
| `POST /api/health/compute` | `POST /health/score` | Mengumpulkan input harian, memanggil AI service. Jika gagal/non-OK, fallback deterministic local. |
| `POST /api/chat/messages` | `POST /companion/chat` | Memanggil AI companion SSE, membaca event `final.full_response`, lalu simpan sebagai assistant message. Jika gagal/non-OK, fallback local companion. |

Environment terkait AI:

```env
AI_SERVICE_BASE_URL=http://localhost:8000
AI_REQUEST_TIMEOUT_MS=8000
```

## Auth Endpoints

### `POST /api/auth/signup`

Public. Membuat user Supabase Auth dan bootstrap profile.

Request:

```json
{
  "username": "axd",
  "fullName": "Axd",
  "email": "user@mail.com",
  "password": "StrongPassword123!"
}
```

Response `201`:

```json
{
  "status": "success",
  "data": {
    "userId": "uuid",
    "email": "user@mail.com",
    "username": "axd"
  }
}
```

### `POST /api/auth/login`

Public. Login email/password lewat Supabase Auth.

Request:

```json
{
  "email": "user@mail.com",
  "password": "StrongPassword123!"
}
```

Response:

```json
{
  "status": "success",
  "data": {
    "accessToken": "jwt",
    "refreshToken": "refresh-token",
    "expiresIn": 3600
  }
}
```

### `POST /api/auth/google`

Public. Generate URL OAuth Google dari Supabase.

Response:

```json
{
  "status": "success",
  "data": {
    "authUrl": "https://<supabase-project>/auth/v1/authorize?provider=google&..."
  }
}
```

### `POST /api/auth/google/callback`

Public. Selesaikan OAuth Google di server (frontend tidak memanggil Supabase langsung).

Request (PKCE):

```json
{
  "code": "oauth-authorization-code"
}
```

Request (implicit hash fallback):

```json
{
  "accessToken": "jwt",
  "refreshToken": "refresh-token"
}
```

Response: sama seperti `POST /api/auth/login`.

### `POST /api/auth/refresh`

Public. Perpanjang access token.

Request:

```json
{
  "refreshToken": "refresh-token"
}
```

Response: sama seperti `POST /api/auth/login`.

### `POST /api/auth/logout`

Protected. Revoke session token saat ini.

Response:

```json
{
  "status": "success",
  "data": {}
}
```

### `GET /api/auth/me`

Protected. Ambil profile ringkas user.

Response:

```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "username": "axd",
    "email": "user@mail.com",
    "fullName": "Nama User",
    "timezone": "Asia/Jakarta",
    "imageUrl": "https://lh3.googleusercontent.com/..."
  }
}
```

Catatan:

- `imageUrl` berisi URL avatar user bila tersedia (mis. hasil Google OAuth metadata).
- Jika tidak tersedia, nilai `imageUrl` adalah `null`.

## Journal / Mental

### `POST /api/journal/analyze`

Protected. Submit teks jurnal, panggil AI `/predict/journal`, simpan hasil sebagai journal row di `typing_sessions` dengan `duration = 0`.

AI request yang dikirim backend:

```json
{
  "text": "Hari ini aku merasa sangat lelah dan tertekan karena deadline.",
  "user_id": "supabase-user-uuid"
}
```

Frontend request:

```json
{
  "text": "Hari ini aku merasa sangat lelah dan tertekan karena deadline."
}
```

Response:

```json
{
  "status": "success",
  "data": {
    "entryId": "uuid",
    "emotion": "anxious",
    "stressLevel": 0.82,
    "topics": ["deadline", "kerja"],
    "createdAt": "2026-05-08T13:00:00.000Z"
  }
}
```

### `GET /api/journal`

Protected. List journal logs.

Query:

- `limit`: optional, default `20`, max `100`
- `cursor`: optional ISO date-time

Response:

```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "id": "uuid",
        "text": "Journal text",
        "emotion": "neutral",
        "stressLevel": 0.5,
        "topics": ["general"],
        "createdAt": "2026-05-08T13:00:00.000Z"
      }
    ],
    "nextCursor": null
  }
}
```

## Nutrition

### `POST /api/food`

Protected. Create manual food log.

Request:

```json
{
  "name": "Nasi Goreng",
  "calories": 520,
  "protein": 18,
  "carbs": 62,
  "fat": 20,
  "consumedAt": "2026-05-08T12:30:00.000Z"
}
```

Response `201`:

```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "name": "Nasi Goreng",
    "calories": 520,
    "protein": 18,
    "carbs": 62,
    "fat": 20,
    "source": "manual",
    "consumedAt": "2026-05-08T12:30:00.000Z",
    "createdAt": "2026-05-08T12:31:00.000Z",
    "imageUrl": null,
    "imagePath": null
  }
}
```

### `POST /api/food/analyze-image`

Protected. Upload foto makanan, simpan ke Supabase Storage bucket `food-images`, panggil AI `/predict/food`, lalu simpan hasil ke `food_entries`.

Content-Type: `multipart/form-data`

Fields:

- `image`: required file, JPEG/PNG, max 5MB

AI form-data yang dikirim backend:

- `image`: uploaded image
- `user_id`: Supabase user id

Response:

```json
{
  "status": "success",
  "data": {
    "entryId": "uuid",
    "foods": ["nasi goreng", "telur dadar"],
    "estimatedCalories": 520,
    "imageUrl": "https://..."
  }
}
```

### `GET /api/food`

Protected. List food logs.

Query:

- `date`: optional `YYYY-MM-DD`
- `mealType`: optional, currently accepted but not applied by implementation
- `limit`: optional, default `20`, max `100`
- `cursor`: optional ISO date-time

## Sleep

### `POST /api/sleep/analyze`

Protected. Submit sleep form, derive duration/debt, panggil AI `/predict/sleep`, lalu simpan hasil.

AI request yang dikirim backend:

```json
{
  "duration_hours": 7.5,
  "bedtime": "23:00",
  "wake_time": "06:30",
  "interruptions": 0,
  "sleep_debt_hours": 0,
  "user_id": "supabase-user-uuid"
}
```

Frontend request:

```json
{
  "sleepTime": "23:00",
  "wakeTime": "06:30",
  "interruptions": 0,
  "notes": "Bangun segar"
}
```

Response:

```json
{
  "status": "success",
  "data": {
    "entryId": "uuid",
    "durationHours": 7.5,
    "qualityScore": 72
  }
}
```

### `GET /api/sleep`

Protected. List sleep logs.

Query:

- `date`: optional `YYYY-MM-DD`
- `limit`: optional, default `20`, max `100`
- `cursor`: optional ISO date-time

## Typing Stress

### `POST /api/typing/analyze`

Protected. Kirim telemetry typing, panggil AI `/predict/typing`, lalu simpan hasil.

AI request yang dikirim backend:

```json
{
  "wpm": 58.3,
  "backspace_rate": 0.12,
  "inter_key_timings": [120, 98, 145],
  "user_id": "supabase-user-uuid"
}
```

Frontend request:

```json
{
  "wpm": 58.3,
  "duration": 90,
  "textContent": "Aku lagi capek banget",
  "backspaceRate": 0.12,
  "interKeyTimings": [120, 98, 145]
}
```

Response:

```json
{
  "status": "success",
  "data": {
    "sessionId": "uuid",
    "stressScore": 0.74
  }
}
```

### `GET /api/typing`

Protected. List typing sessions.

Query:

- `date`: optional `YYYY-MM-DD`
- `limit`: optional, default `20`, max `100`
- `cursor`: optional ISO date-time

## Health Score / Activity

### `POST /api/health/compute`

Protected. Ambil input harian dari DB, panggil AI `/health/score`, simpan/upsert snapshot hari ini.

AI request yang dikirim backend:

```json
{
  "user_id": "supabase-user-uuid",
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

Response:

```json
{
  "status": "success",
  "data": {
    "snapshotDate": "2026-05-24",
    "healthScore": 78,
    "breakdown": {
      "mood": 70,
      "nutrition": 85,
      "sleep": 72,
      "stress": 65
    },
    "insightSummary": "Pertahankan rutinitas baikmu."
  }
}
```

### `GET /api/health/daily`

Protected. Ambil snapshot health harian.

Query:

- `from`: optional `YYYY-MM-DD`, default 6 hari sebelum hari ini
- `to`: optional `YYYY-MM-DD`, default hari ini

### `GET /api/dashboard/today`

Protected. Data komposit untuk Home/Dashboard. Jika snapshot hari ini belum ada, backend akan compute dulu.

Response:

```json
{
  "status": "success",
  "data": {
    "dateLabel": "Minggu, 24 Mei",
    "healthScore": 85,
    "statusLabel": "Sehat & Senang",
    "suggestion": "Pertahankan rutinitas baikmu.",
    "breakdown": {
      "moodLabel": "Tenang",
      "stressLabel": "Rendah",
      "nutritionKcal": 520,
      "sleepHours": 7.5
    }
  }
}
```

### `GET /api/activity/summary`

Protected. Rata-rata skor dan statistik ringkas.

Query:

- `period`: optional `7d` atau `30d`, default `7d`

### `GET /api/activity/recent`

Protected. Gabungan riwayat food, sleep, typing, journal.

Query:

- `limit`: optional, default `20`, max `100`
- `cursor`: optional ISO date-time

## Chat Companion

### `POST /api/chat/sessions`

Protected. Buat session chat.

Request:

```json
{
  "title": "Evening check-in"
}
```

Response `201`:

```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "title": "Evening check-in",
    "summary": null,
    "lastMessageAt": null,
    "createdAt": "2026-05-08T13:00:00.000Z"
  }
}
```

### `GET /api/chat/sessions`

Protected. List chat sessions.

Query:

- `limit`: optional, default `20`, max `100`
- `cursor`: optional ISO date-time

### `POST /api/chat/messages`

Protected. Kirim pesan user, gateway memanggil AI service `POST /companion/chat`, meneruskan stream ke frontend (SSE), lalu simpan user + assistant message. Jika AI companion gagal, backend memakai fallback local companion.

AI request yang dikirim backend:

```json
{
  "user_id": "supabase-user-uuid",
  "message": "Aku lagi capek, harus ngapain?"
}
```

AI response yang diproses backend:

- Token stream: `data: {"token":"..."}`
- Final stream: `data: {"full_response":"...","recommendations":[...]}`
- Jika `full_response` berisi JSON (langsung atau markdown fenced) dengan struktur `{ "response": "...", "recommendations": [...] }`, backend akan unwrap `response` sebagai teks final dan mengambil `recommendations` dari payload tersebut bila field top-level belum ada.

Request:

```json
{
  "sessionId": "uuid",
  "message": "Aku lagi capek, harus ngapain?"
}
```

Response `200`:

- `Content-Type: text/event-stream`

Contoh chunk SSE yang diterima frontend:

```text
data: {"token":"Aku dengar kamu lagi capek"}

data: {"full_response":"Aku dengar kamu lagi capek...","recommendations":["Istirahat 10 menit","Minum air putih"]}
```

Catatan:

- Tidak ada envelope JSON `status/data` untuk endpoint ini karena response bersifat streaming.
- Setelah stream selesai, backend tetap menyimpan assistant message ke database.

### `GET /api/chat/messages`

Protected. Ambil history chat.

Query:

- `sessionId`: required UUID
- `limit`: optional, default `20`, max `100`
- `cursor`: optional ISO date-time

Response:

```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "id": "uuid",
        "sessionId": "uuid",
        "role": "assistant",
        "content": "Aku dengar kamu lagi capek...",
        "recommendations": [
          "Minum air putih",
          "Istirahat 10 menit"
        ],
        "model": "vitara-ai-companion",
        "createdAt": "2026-05-08T13:00:00.000Z"
      }
    ],
    "nextCursor": null
  }
}
```

Catatan:

- `recommendations` hanya terisi untuk pesan role `assistant`; untuk role lain bernilai `null`.
- `content` pada pesan assistant adalah jawaban utama tanpa daftar rekomendasi.

## Profile

### `GET /api/profile`

Protected. Ambil profil user.

### `POST /api/profile/bootstrap`

Protected. Memastikan profile user sudah ada setelah login/register. Idempotent.

### `PATCH /api/profile`

Protected. Update profile.

Request:

```json
{
  "username": "axd",
  "fullName": "Axd",
  "timezone": "Asia/Jakarta"
}
```

### `POST /api/profile/request-delete`

Protected. Ajukan penghapusan data user.

Request:

```json
{
  "requestDelete": true
}
```
