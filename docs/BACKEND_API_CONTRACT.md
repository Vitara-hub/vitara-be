# Vitara Backend Gateway API Contract (Draft v1)

## Scope

Dokumen ini untuk kontrak **Frontend <-> Backend Gateway** (`vitara-be`).

- AI model contract tetap di [api-contract.md](/home/alfazari/projects/kuliah/mbkm/codingcamp/capstone/vitara-be/docs/api-contract.md).
- Backend gateway bertanggung jawab: auth verification, DB persistence, orchestration ke AI service, orchestration ke Gemini.

## Base

- Base path: `/api`
- Version: `/v1`
- Auth: `Authorization: Bearer <supabase_access_token>`
- Content-Type: `application/json` (kecuali upload image pakai `multipart/form-data`)

## Response Envelope

### Success

```json
{
  "status": "success",
  "data": {}
}
```

### Error

```json
{
  "status": "error",
  "message": "Human readable message",
  "code": "SOME_ERROR_CODE"
}
```

## Auth Endpoints

Catatan: backend gateway menyediakan endpoint auth agar frontend punya satu pintu akses API.

### `POST /api/auth/signup`

- Tujuan: daftar user baru (email/password) lalu bootstrap profile.
- Auth: public

Request:

```json
{
  "username": "axd",
  "fullName": "Axd",
  "email": "user@mail.com",
  "password": "StrongPassword123!"
}
```

Response:

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

- Tujuan: login email/password melalui Supabase Auth.
- Auth: public

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

- Tujuan: generate URL OAuth Google dari Supabase.
- Auth: public

Response:

```json
{
  "status": "success",
  "data": {
    "authUrl": "https://<supabase-project>/auth/v1/authorize?provider=google&..."
  }
}
```

### `POST /api/auth/logout`

- Tujuan: logout user dan revoke session.
- Auth: required

### `GET /api/auth/me`

- Tujuan: validasi token + ambil user profile ringkas.
- Auth: required

Response:

```json
{
  "status": "success",
  "data": {
    "id": "uuid",
    "username": "axd",
    "email": "user@mail.com",
    "fullName": "Nama User",
    "timezone": "Asia/Jakarta"
  }
}
```

## Home / Dashboard

### `GET /api/dashboard/today`

- Tujuan: data komposit untuk layar Home/Dashboard.
- Auth: required

Response:

```json
{
  "status": "success",
  "data": {
    "dateLabel": "Senin, 4 Mei",
    "healthScore": 85,
    "statusLabel": "Sehat & Senang",
    "suggestion": "Vee kelihatan sangat sehat hari ini! Terus pertahankan rutinitas baikmu.",
    "breakdown": {
      "moodLabel": "Tenang",
      "stressLabel": "Rendah",
      "nutritionKcal": 520,
      "sleepHours": 7.5
    }
  }
}
```

## Journal / Mental

### `POST /api/journal/analyze`

- Tujuan: submit teks jurnal, simpan hasil, trigger AI `POST /predict/journal`.
- Auth: required

Request:

```json
{
  "text": "Apa yang ngeganjel di pikiranmu hari ini..."
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

- Tujuan: list riwayat jurnal.
- Auth: required
- Query: `limit`, `cursor` (optional)

## Nutrition

### `POST /api/food`

- Tujuan: create manual food log.
- Auth: required

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

### `POST /api/food/analyze-image`

- Tujuan: upload foto makanan lalu gateway panggil AI `POST /predict/food`.
- Auth: required
- Content-Type: `multipart/form-data`
- Field: `image`

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

- Tujuan: list food logs.
- Auth: required
- Query: `date`, `mealType`, `limit`, `cursor` (optional)

## Sleep

### `POST /api/sleep/analyze`

- Tujuan: submit sleep form, trigger AI `POST /predict/sleep`, simpan hasil.
- Auth: required

Request:

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

- Tujuan: list sleep logs.
- Auth: required
- Query: `date`, `limit`, `cursor` (optional)

## Typing Stress

### `POST /api/typing/analyze`

- Tujuan: kirim telemetry typing + trigger AI `POST /predict/typing`.
- Auth: required

Request:

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

- Tujuan: list typing sessions.
- Auth: required
- Query: `date`, `limit`, `cursor` (optional)

## Health Score / Activity

### `POST /api/health/compute`

- Tujuan: hitung skor harian via AI `POST /health/score`, simpan snapshot.
- Auth: required

### `GET /api/health/daily`

- Tujuan: ambil snapshot health harian.
- Auth: required
- Query: `from`, `to`

### `GET /api/activity/summary`

- Tujuan: data rata-rata skor + statistik minggu untuk layar Activity.
- Auth: required
- Query: `period=7d|30d`

### `GET /api/activity/recent`

- Tujuan: list riwayat aktivitas gabungan (journal/sleep/nutrition/stress).
- Auth: required
- Query: `limit`, `cursor`

## Chat Companion

### `POST /api/chat/sessions`

- Tujuan: buat session chat.
- Auth: required

### `GET /api/chat/sessions`

- Tujuan: list session chat user.
- Auth: required

### `POST /api/chat/messages`

- Tujuan: kirim pesan user, gateway panggil Gemini, simpan user+assistant message.
- Auth: required

Request:

```json
{
  "sessionId": "uuid",
  "message": "Aku lagi capek, harus ngapain?"
}
```

Response:

```json
{
  "status": "success",
  "data": {
    "sessionId": "uuid",
    "assistantMessage": "Aku denger kamu lagi capek. Coba tarik napas perlahan..."
  }
}
```

### `GET /api/chat/messages`

- Tujuan: ambil history chat.
- Auth: required
- Query: `sessionId`, `limit`, `cursor`

## Profile

### `GET /api/profile`

- Tujuan: ambil profil user + status ringkas.
- Auth: required

### `POST /api/profile/bootstrap`

- Tujuan: memastikan profile user sudah ada setelah login/register (idempotent).
- Auth: required

### `PATCH /api/profile`

- Tujuan: update profil user.
- Auth: required

Request:

```json
{
  "username": "axd",
  "fullName": "Axd",
  "timezone": "Asia/Jakarta"
}
```

### `POST /api/profile/request-delete`

- Tujuan: ajukan penghapusan data user.
- Auth: required

```json
{
    "requestDelete": true
}
```
