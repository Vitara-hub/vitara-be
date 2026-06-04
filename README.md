# Vitara Backend Gateway

Vitara adalah aplikasi web kesehatan holistik berbasis AI yang membantu pengguna memantau kondisi mental, nutrisi, tidur, dan aktivitas harian. Backend ini berperan sebagai API gateway untuk frontend Vitara, menangani autentikasi, persistensi data, upload gambar makanan, dokumentasi API, serta orkestrasi request ke service `vitara-ai`.

Vitara merupakan alat pendamping kebiasaan sehat, bukan pengganti diagnosis atau konsultasi tenaga medis profesional.

## Fitur Utama

- Autentikasi email/password, Google OAuth, refresh token, logout, dan endpoint profil pengguna berbasis Supabase Auth.
- Endpoint pencatatan jurnal, makanan, tidur, typing stress, health score, dashboard harian, aktivitas terbaru, dan companion chat bersama Vee.
- Integrasi ke `vitara-ai-service` untuk analisis jurnal, estimasi makanan dari gambar, kualitas tidur, stress typing, health score, dan companion response.
- Persistensi data ke Supabase PostgreSQL dengan service-role backend dan migration SQL di folder `supabase/migrations`.
- Upload gambar makanan ke Supabase Storage melalui bucket yang dapat dikonfigurasi.
- Validasi request menggunakan Zod, centralized error handling, request logging, CORS, Helmet, dan Swagger UI di `/api-docs`.

## Arsitektur Singkat

Frontend Vitara mengakses backend ini melalui base path `/api`. Backend memverifikasi Supabase access token dari header `Authorization`, melakukan scoping data berdasarkan `user_id`, menyimpan data ke Supabase, lalu memanggil `vitara-ai-service` untuk kebutuhan prediksi atau rekomendasi AI.

Alur utama:

```text
Vitara Frontend
  -> Vitara Backend Gateway (Express/Bun)
  -> Supabase Auth, Database, Storage
  -> vitara-ai-service
```

Dokumen kontrak API tersedia di [`docs/BACKEND_API_CONTRACT.md`](docs/BACKEND_API_CONTRACT.md) dan Swagger UI tersedia saat server berjalan di `http://localhost:3000/api-docs`.

## Teknologi

- Bun
- TypeScript
- Express
- Supabase JS SDK
- Supabase Auth, PostgreSQL, dan Storage
- Zod
- Swagger UI Express
- ESLint
- Docker dan GitHub Actions untuk deployment ke AWS EC2

## Prasyarat

Pastikan perangkat telah memiliki:

- Git
- Bun `1.2.x` atau lebih baru
- Docker Engine / Docker Desktop
- Akun/project Supabase Cloud
- `vitara-ai-service` yang berjalan dan dapat diakses backend

Secara default backend berjalan di `http://localhost:3000`, memakai Supabase Cloud, dan mengharapkan AI service di `http://localhost:8000`. Frontend perlu mengakses endpoint backend dengan base path `/api`.

## Cara Replikasi Lokal

1. Clone repository:

```bash
git clone git@github.com:Vitara-hub/vitara-be.git
cd vitara-be
```

2. Install dependency:

```bash
bun install
```

3. Siapkan environment:

```bash
cp .env.example .env
```

Isi nilai berikut dari Supabase Cloud dashboard dan environment lokal:

```env
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_FOOD_BUCKET=food-images

AI_SERVICE_BASE_URL=http://localhost:8000
AI_REQUEST_TIMEOUT_MS=8000

GOOGLE_OAUTH_REDIRECT_URL=http://localhost:5173/auth/callback
DATA_ENCRYPTION_KEY=replace-with-stable-secret
```

4. Siapkan Supabase Cloud:

- Buat project di Supabase Cloud.
- Ambil `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` dari Project Settings.
- Terapkan migration di folder `supabase/migrations` ke project Supabase.
- Pastikan bucket storage sesuai `SUPABASE_FOOD_BUCKET`, default `food-images`.
- Jika memakai Google OAuth, konfigurasi Google provider di Supabase Auth dan set `GOOGLE_OAUTH_REDIRECT_URL`.

Catatan: Supabase CLI tetap bisa dipakai untuk development lokal penuh jika dibutuhkan, tetapi README ini menggunakan Supabase Cloud sebagai jalur utama agar auth, database, dan storage konsisten dengan deployment.

5. Jalankan `vitara-ai-service` pada host yang sama atau sesuaikan `AI_SERVICE_BASE_URL`.

6. Jalankan backend:

```bash
bun run dev
```

7. Cek service:

```bash
curl http://localhost:3000/health
```

Response sukses:

```json
{
  "status": "ok"
}
```

## Build dan Preview Produksi

Build TypeScript:

```bash
bun run build
```

Jalankan hasil build:

```bash
bun run start
```

Build image Docker:

```bash
docker build -t vitara-be .
```

Jalankan container produksi:

```bash
docker run --rm \
  --name vitara-be \
  -p 3000:3000 \
  --env-file .env \
  vitara-be
```

## Replikasi Deployment AWS

Repository ini memiliki workflow GitHub Actions di `.github/workflows/deploy.yml` untuk deployment ke AWS EC2. Alurnya:

- Push ke branch `main` atau jalankan `workflow_dispatch`.
- GitHub Actions build Docker image dari `Dockerfile`.
- Image dipush ke GitHub Container Registry dengan tag `latest` dan `sha-*`.
- Workflow menjalankan secret scan dan Trivy scan.
- EC2 login ke GHCR, pull image terbaru, stop container lama, lalu start container baru bernama `vitara-be`.

### Security Step di CI/CD

Sebelum deployment ke EC2, workflow menjalankan job `security` sebagai gate:

- Secret scanning menggunakan Gitleaks untuk mendeteksi credential atau token yang tidak sengaja masuk repository.
- Filesystem scanning menggunakan Trivy untuk memeriksa vulnerability dan misconfiguration pada source repository.
- Container image scanning menggunakan Trivy untuk memeriksa vulnerability pada image Docker yang sudah dibuild dan dipush ke GHCR.
- Scan difilter pada severity `HIGH` dan `CRITICAL` dengan `ignore-unfixed: true`.
- Jika Trivy menemukan temuan `HIGH` atau `CRITICAL`, workflow gagal dan deployment tidak dilanjutkan.
- Report Trivy disimpan sebagai artifact GitHub Actions untuk kebutuhan review.

Dengan alur ini, deployment hanya berjalan setelah image berhasil dibuild dan lolos pemeriksaan keamanan minimum.

Prasyarat EC2:

- Instance EC2 dapat diakses via SSH dari GitHub Actions.
- Docker sudah terpasang dan user deploy punya akses menjalankan Docker.
- Security group membuka port aplikasi yang dipakai, default `3000`.
- Supabase Cloud atau service eksternal lain dapat diakses dari EC2.
- `vitara-ai-service` sudah tersedia dari EC2 melalui `AI_SERVICE_BASE_URL`.

GitHub repository secrets yang dibutuhkan:

- `EC2_HOST`
- `EC2_USERNAME`
- `EC2_SSH_KEY`
- `FRONTEND_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_FOOD_BUCKET`
- `AI_SERVICE_BASE_URL`
- `AI_REQUEST_TIMEOUT_MS`
- `GOOGLE_OAUTH_REDIRECT_URL`
- `DATA_ENCRYPTION_KEY`

Untuk replikasi manual di EC2:

```bash
docker login ghcr.io
docker pull ghcr.io/<owner>/<repo>:latest
docker stop vitara-be 2>/dev/null || true
docker rm vitara-be 2>/dev/null || true
docker run -d \
  --name vitara-be \
  --restart unless-stopped \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --tmpfs /home/bun/.cache:rw,noexec,nosuid,size=64m \
  --security-opt no-new-privileges:true \
  --cap-drop ALL \
  --pids-limit 256 \
  --env-file .env.production \
  -p 3000:3000 \
  ghcr.io/<owner>/<repo>:latest
```

Ganti `<owner>/<repo>` sesuai nama repository GitHub dalam huruf kecil.

## Struktur Direktori

```text
.
├── .github/workflows/          # CI/CD deployment ke EC2
├── docs/                       # Kontrak API dan catatan teknis
├── scripts/                    # Script utilitas lokal
├── src/
│   ├── core/                   # Error dan logger
│   ├── infrastructure/         # Config, database, DI, HTTP, AI client
│   └── modules/                # Modul domain fitur Vitara
├── supabase/
│   ├── config.toml             # Konfigurasi Supabase CLI
│   └── migrations/             # Migration database dan storage
├── tests/                      # Unit dan integration-style tests
├── Dockerfile                  # Multi-stage production image
├── docker-compose.yml          # Postgres + Adminer opsional untuk validasi SQL lokal
├── package.json                # Script Bun dan dependency
└── tsconfig*.json              # Konfigurasi TypeScript
```

## Troubleshooting

### Server gagal start karena environment invalid

Pastikan `.env` berisi semua key wajib: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY`. Nilai URL harus berupa URL valid.

### Request protected mengembalikan 401

Pastikan frontend mengirim header:

```http
Authorization: Bearer <supabase_access_token>
```

Token harus berasal dari project Supabase yang sama dengan `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY`.

### CORS error dari frontend

Set `FRONTEND_URL` sesuai origin frontend, misalnya:

```env
FRONTEND_URL=http://localhost:5173
```

Restart backend setelah mengubah env.

### AI service timeout atau response fallback

Pastikan `vitara-ai-service` berjalan dan dapat diakses dari backend:

```bash
curl http://localhost:8000
```

Jika AI service berjalan di host/port lain, ubah:

```env
AI_SERVICE_BASE_URL=http://host-ai-service:8000
AI_REQUEST_TIMEOUT_MS=8000
```

### Upload gambar makanan gagal

Pastikan bucket Supabase Storage sesuai `SUPABASE_FOOD_BUCKET` sudah ada dan migration storage sudah diterapkan. Default bucket adalah `food-images`.

### Koneksi ke Supabase Cloud gagal

- Pastikan `SUPABASE_URL` memakai URL project Supabase Cloud yang benar.
- Pastikan `SUPABASE_ANON_KEY` dan `SUPABASE_SERVICE_ROLE_KEY` berasal dari project yang sama.
- Pastikan migration sudah diterapkan ke database Supabase Cloud.
- Pastikan bucket storage `food-images` atau bucket sesuai `SUPABASE_FOOD_BUCKET` sudah tersedia.

### Ingin memakai Supabase lokal

```bash
bun run sb:start
bun run sb:status
```

Jika schema perlu diulang dari awal:

```bash
bun run sb:db:reset
```

### Docker container tidak sehat

Container memakai healthcheck ke `/health`. Cek log:

```bash
docker logs vitara-be
```

Pastikan port, env Supabase, dan koneksi ke AI service sudah benar.

## Script

- `bun run dev`: menjalankan server development dengan watch mode.
- `bun run build`: compile TypeScript ke `dist`.
- `bun run start`: menjalankan build produksi dari `dist/index.js`.
- `bun run lint`: menjalankan ESLint.
- `bun run lint:fix`: menjalankan ESLint dengan autofix.
- `bun run test`: menjalankan test Bun.
- `bun run sb:start`: menjalankan Supabase local stack opsional.
- `bun run sb:stop`: menghentikan Supabase local stack opsional.
- `bun run sb:status`: melihat status Supabase local stack opsional.
- `bun run sb:db:reset`: reset database Supabase lokal opsional dan apply migration.
