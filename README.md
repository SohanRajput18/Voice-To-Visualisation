# VoxQuery - Voice-to-Visualization Analytics Platform

VoxQuery is an elegant, containerized, speech-driven data analytics platform. It allows users to dictate analytical queries in plain English (e.g. *"Show total sales by product category"*), compiles the speech to SQL using an LLM provider, validates and executes it against a PostgreSQL database, and visualizes the results dynamically using customized Recharts charts.

---

## 🏗️ Architecture & Flow Diagram

The application can operate with local LLMs (Ollama) during development and cloud LLMs (Google Gemini) in production.

1. **Frontend (React + TypeScript)**: Scaffolded with Vite. Incorporates browser Web Speech API for transcription, custom CSS glassmorphism styling, and Recharts.
2. **Backend (Express + TypeScript)**: Orchestrates LLM prompt compiling, selects the LLM provider dynamically, restricts SQL execution to read-only SELECT commands, and automatically recommends visualization charts.
3. **LLM Selector**: Dynamically routes query translations to either a local Ollama server or the Google Gemini API based on environment variables.
4. **Database (PostgreSQL 15)**: Holds user credentials, SQL history logs, and sandbox retail tables.

```mermaid
graph TD
    User([User]) -->|Voice / Text Query| FE[React Frontend]
    FE -->|Speech Recognition| STT[Web Speech API]
    FE -->|Execute Query API| BE[Express Backend]
    BE -->|1. Generate SQL| Selector{LLM Selector}
    Selector -->|LLM_PROVIDER=ollama| Ollama[(Local Ollama Server)]
    Selector -->|LLM_PROVIDER=gemini| Gemini[(Google Gemini API)]
    BE -->|2. Validate SQL| Validator[SQL Validator]
    BE -->|3. Run SQL| DB[(PostgreSQL)]
    DB -->|Result Rows| BE
    BE -->|JSON Response| FE
    FE -->|Auto Chart Gen| Chart[Recharts Visualizer]
```

---

## 🗄️ Database Schema & Sandbox Data

To ensure out-of-the-box utility, the Postgres database is pre-seeded with a retail transaction database containing 3 primary tables:

1. **`products`**: Product catalog details.
   - `id` (INT, Primary Key)
   - `name` (VARCHAR)
   - `category` (VARCHAR)
   - `price` (DECIMAL)
   - `stock` (INT)
2. **`customers`**: Profiles of buyers.
   - `id` (INT, Primary Key)
   - `name` (VARCHAR)
   - `email` (VARCHAR)
   - `city` (VARCHAR)
   - `join_date` (DATE)
3. **`sales`**: Ledger recording purchases.
   - `id` (INT, Primary Key)
   - `product_id` (INT, Foreign Key)
   - `customer_id` (INT, Foreign Key)
   - `quantity` (INT)
   - `sale_date` (DATE)
   - `total_amount` (DECIMAL)

---

## 🔒 Security & SQL Validation Engine

Since the SQL queries are generated dynamically by an AI model, the backend employs a rigorous multi-tier **SQL Validation Engine** before executing queries:

* **SELECT-Only Enforcement**: Rejects any queries containing destructive SQL commands (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `TRUNCATE`, `CREATE`, etc.).
* **Single Statement Check**: Blocks multiple SQL statements separated by semicolons (preventing semicolon injection).
* **Table Whitelisting**: The query is parsed to extract table targets. Only whitelisted sandbox tables (`products`, `customers`, `sales`) are permitted. Access to database catalogs (`information_schema`, `pg_*`) or user tables is strictly blocked.

---

## 🔑 Environment Variables

Create a `.env` file inside the `backend/` directory to configure the environment.

| Variable | Description | Example / Default | Required For |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://postgres:postgres@localhost:5432/vtov_db` | All |
| `LLM_PROVIDER` | Active LLM provider (`ollama` or `gemini`) | `ollama` | All |
| `OLLAMA_BASE_URL` | URL where the local Ollama instance is running | `http://host.docker.internal:11434` | Ollama |
| `OLLAMA_MODEL` | Local LLM model name pulled in Ollama | `llama3` | Ollama |
| `GEMINI_API_KEY` | Google Gemini Developer API key | `AIzaSy...` | Gemini |
| `GEMINI_MODEL` | Google Gemini model name | `gemini-2.5-flash` | Gemini |
| `JWT_SECRET` | Secret key for signing web tokens | `super-secret-key-change-in-prod` | All |
| `PORT` | API server listening port | `5000` | All |

---

## 🚀 Getting Started (Local Development)

### 📋 Prerequisites
* [Docker Desktop](https://www.docker.com/products/docker-desktop/)
* [Ollama](https://ollama.com/) (installed and running locally)

### 1. Configure the LLM (Ollama)
Pull the default model on your host machine:
```bash
ollama pull llama3
```
Ensure Ollama is serving on `http://localhost:11434`.

### 2. Configure Environment Variables
Inside the `backend/` directory, create a `.env` file:
```env
PORT=5000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/vtov_db
JWT_SECRET=dev-secret-key-12345
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3
```
*(Note: If running the backend locally outside Docker, use `OLLAMA_BASE_URL=http://localhost:11434`)*

### 3. Start the Platform using Docker Compose
Navigate to the project root directory and run:
```bash
docker-compose up --build
```
This spins up:
* Pre-seeded PostgreSQL container on port `5432`
* Express Backend container on port `5000`
* React Frontend container on port `5173`

Open **[http://localhost:5173](http://localhost:5173)** in your browser to start querying.

---

## 🛠️ Running Services Manually (Without Compose)

### 1. Start PostgreSQL Database
Keep only the Postgres container active:
```bash
docker-compose up db
```

### 2. Start the Backend
```bash
cd backend
npm install
npm run dev
```
Serves on `http://localhost:5000`.

### 3. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
Serves on `http://localhost:5173`.

---

## ☁️ Production Deployment

### 1. Cloud Database Setup (Neon / Supabase)
1. Provision a serverless Postgres database on [Neon](https://neon.tech) or [Supabase](https://supabase.com).
2. Run the database seed SQL code from `init-db/init.sql` using the SQL editor in your database dashboard.
3. Save the connection string URL. The backend automatically injects SSL settings (`rejectUnauthorized: false`) for all remote database connections.

### 2. Backend Deployment (Render)
1. Log in to [Render](https://render.com) and create a new **Web Service**.
2. Select your GitHub repository.
3. Choose the **Docker** runtime option.
4. Set the **Root Directory** to `backend`.
5. Under **Environment Variables**, define:
   - `LLM_PROVIDER` = `gemini`
   - `GEMINI_API_KEY` = `<your_gemini_api_key>`
   - `GEMINI_MODEL` = `gemini-2.5-flash`
   - `DATABASE_URL` = `<your_neon_or_supabase_postgres_url>`
   - `JWT_SECRET` = `<generate_a_secure_random_string>`
   - `NODE_ENV` = `production`
6. Click **Deploy**.

### 3. Frontend Deployment (Vercel)
1. Log in to [Vercel](https://vercel.com) and click **Add New Project**.
2. Import your repository and set the **Root Directory** to `frontend`.
3. In **Environment Variables**, add:
   - `VITE_API_URL` = `<your_render_backend_webservice_url>`
4. Click **Deploy**.

---

## 🧪 Testing

### Running SQL Validation Unit Tests
To verify that the security validator blocks malicious commands and accepts read-only SELECT queries, run:
```bash
cd backend
npm install
npm run test:sql
```