# Personal Investment Portfolio AI Agent 📊🤖

A premium, production-grade personal wealth tracking and advisory AI assistant designed for a long term investor The system ingests investment PDFs (Zerodha Kite, Groww, Morgan Stanley, Fidelity), converts all foreign holdings into Indian Rupees (INR) using live market rates, runs AI-powered monthly reviews using **Google Gemini**, **OpenAI**, or **Anthropic Claude**, executes daily local rule-based risk flag checks, and delivers HTML alerts directly to your email.

---

## 🚀 Features

- **Advisory Only**: Never executes trades. Provides risk analysis, strategic compounding advice, and tactical capital deployment suggestions.
- **Unified Ingestion**: Ingests statement PDFs using advanced LLM-powered document extraction (no brittle regex or table libraries).
- **Multi-LLM Engine**: Unified interface allowing you to switch between Google Gemini, OpenAI, and Anthropic Claude via a single environment variable.
- **Dynamic SMTP Email Alerts**: Daily risk alarms and monthly reviews are formatted as premium, styled HTML emails. SMTP details are configurable dynamically from the UI with zero restarts.
- **Low-Cost Local Flags**: Runs daily checks (tech concentration, single-stock caps, drawdown alerts, market crashes) locally to keep LLM expenses near zero.
- **Premium React Dashboard**: Responsive Next.js 14 layout (collapses to mobile bottom-nav), net worth trend charts, concentration gauges, and real-time news alerts.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.11+, FastAPI, SQLModel (SQLAlchemy + Pydantic), SQLite, APScheduler, httpx, yfinance.
- **Frontend**: Next.js 14, App Router, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Query v5, Recharts, Axios.
- **Containerization**: Dockerfile included for backend microservice deployment.

---

## 📁 Folder Structure

```
portfolio-agent/
├── backend/
│   ├── app/
│   │   ├── main.py               # FastAPI entrypoint, CORS, lifespan
│   │   ├── config.py             # Settings loader & validator
│   │   ├── database.py           # DB engine, session maker, defaults seeder
│   │   ├── scheduler.py          # Cron scheduler (Asia/Kolkata timezone)
│   │   ├── models/               # SQLModel DB tables (Holding, Snapshot, Journal, etc.)
│   │   ├── routers/              # REST Endpoints (portfolio, upload, manual, settings, etc.)
│   │   └── services/             # Core services (llm_service, prices, news, flags, etc.)
│   ├── requirements.txt          # Python dependencies
│   ├── .env.example              # Env template
│   └── Dockerfile                # Deployment container
├── frontend/
│   ├── src/
│   │   ├── app/                  # Pages & Layouts (Dashboard, Upload, Journal, Settings)
│   │   ├── components/           # UI Blocks (NetWorthHero, AllocationGrid, Sidebar, etc.)
│   │   ├── lib/                  # axios api client, constants, formatters
│   │   └── types/                # TypeScript type definitions
│   ├── package.json
│   └── .env.local.example
└── README.md                     # Documentation
```

---

## ⚙️ Environment Variables Reference

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `LLM_PROVIDER` | Yes | `gemini` | Active AI provider: `gemini`, `openai`, or `anthropic`. |
| `GEMINI_API_KEY` | Optional | | API Key for Google Gemini API (required if provider is `gemini`). |
| `OPENAI_API_KEY` | Optional | | API Key for OpenAI API (required if provider is `openai`). |
| `ANTHROPIC_API_KEY` | Optional | | API Key for Anthropic Claude API (required if provider is `anthropic`). |
| `NEWS_API_KEY` | Yes | | API Key from [newsapi.org](https://newsapi.org/) (Free tier: 100 reqs/day). |
| `SMTP_HOST` | Yes | | SMTP Server Host (e.g. `smtp.gmail.com` for Google). |
| `SMTP_PORT` | Yes | `587` | SMTP Port (usually `587` for TLS/STARTTLS). |
| `SMTP_USERNAME` | Yes | | SMTP Login Email Username. |
| `SMTP_PASSWORD` | Yes | | SMTP Login App-Specific Password. |
| `SMTP_SENDER` | Yes | | Sender email address for alerts (e.g. `alerts@portfolio.ai`). |
| `ALERT_RECIPIENT_EMAIL` | Yes | | Recipient email address to receive alerts. |
| `DATABASE_URL` | No | `sqlite:///./portfolio.db` | Connection URI for the SQLite database. |
| `FRONTEND_URL` | No | `http://localhost:3000` | URL of the React/Next.js frontend (for CORS). |

### Frontend (`frontend/.env.local`)

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `NEXT_PUBLIC_API_URL` | Yes | `http://localhost:8000` | Base URL of the running FastAPI backend server. |

---

## 🔒 Secure SMTP Setup (Google Gmail App Passwords)

To send email alerts, modern email providers (like Gmail, Outlook, Yahoo) block standard passwords. You **must** configure an App Password:
1. Navigate to your **Google Account Settings** -> **Security**.
2. Enable **2-Step Verification** (if not already active).
3. Select **App Passwords** at the bottom of the 2-Step page.
4. Select **Mail** as the app and **Other (Custom Name)** as the device (e.g., name it `Portfolio AI Agent`).
5. Copy the generated **16-character code** (no spaces).
6. Save this code into your `.env` (or via the UI settings page) as the `SMTP_PASSWORD`.
7. Set `SMTP_HOST` to `smtp.gmail.com` and `SMTP_PORT` to `587`.

---

## 💻 Local Development Setup

### 1. Spin up the Backend
```bash
# Navigate to backend
cd backend

# Create virtual environment (optional but recommended)
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create .env from template and configure keys
cp .env.example .env

# Start the development server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
The backend will boot up, initialize the SQLite database (`portfolio.db`), seed the default app settings, start the APScheduler background cron, and listen on `http://127.0.0.1:8000`. You can view the interactive swagger API documentation at `http://127.0.0.1:8000/docs`.

### 2. Spin up the Frontend
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Configure environment variables
cp .env.local.example .env.local

# Start Next.js dev server
npm run dev
```
Open your browser and navigate to `http://localhost:3000` to interact with the premium portfolio dashboard.

---

## 📥 Statement PDF Download Guidelines

Follow these exact paths to download statement PDFs from your financial providers:

- **Zerodha Kite (Indian Stocks)**:
  1. Go to [console.zerodha.com](https://console.zerodha.com) and log in.
  2. Select **Reports** -> **Holdings**.
  3. Select the current date and click **Download** (select PDF format).
- **Groww (Indian Mutual Funds)**:
  1. Open the Groww web portal or app and tap your **Profile**.
  2. Go to **Reports** -> **Mutual Funds** -> **Mutual Fund Account Statement**.
  3. Select the desired period and click **Download PDF**.
- **Morgan Stanley (Google RSUs)**:
  1. Log in to [StockPlan Connect](https://stockplanconnect.morganstanley.com).
  2. Go to **MyStock** -> **Documents** -> **Statements**.
  3. Select the latest quarterly or monthly statement and click **Download PDF**.
- **Fidelity NetBenefits (Oracle RSUs)**:
  1. Log in to [Fidelity NetBenefits](https://netbenefits.fidelity.com).
  2. Go to **Accounts** -> **Equity Awards** -> **Statements**.
  3. Select your Oracle RSU statement and click **Download PDF**.

---

## 📈 User Workflow & Routines

### 1. First-Time Onboarding Routine
- Go to the **Upload Statements** page in the UI.
- Select the **Onboarding (Cold Start)** tab.
- Drag and drop your baseline statement PDFs (Zerodha, Groww, Morgan Stanley, Fidelity) into their respective upload cards.
- Type in the period (e.g. `Jun 2026`) and click **Parse Statement**.
- Once parsed, review the extracted holdings table and click **looks good**.
- (Optional) Use the **Manual precious Metals Entry** card on the right to log any physical Gold/Silver holdings by weight (grams) and purchase cost.
- Go back to the **Dashboard** — your net worth, allocation grids, and risk gauges are now fully active!

### 2. Monthly Update Routine
- On the **1st day of every month**, download your fresh statement PDFs from your providers.
- Go to the **Upload Statements** page in the UI.
- Select the **Monthly Updates** tab.
- Drag-and-drop the fresh PDFs, input the period (e.g. `Jul 2026`), and parse them. This automatically deactivates your prior month's holdings from those sources and updates them with the fresh figures.
- Go to the **Dashboard** and click the outline button **Run Monthly Review**.
- The AI Agent will read your historical suggestion journal, analyze your current allocations, review recent news headlines, formulate strategic recommendations, record a new monthly snapshot, and email a styled executive report directly to your inbox.
- Go to the **Suggestion Journal** page to log whether you acted on the recommendations (Yes/No/Partial) so the agent can evaluate the outcome and learn from its performance next month!

---

## ☁️ Cloud Deployment Guidelines

### Backend — Railway.app (With Persistent SQLite)
FastAPI can be deployed easily to Railway, but since we are using a single-file SQLite database, you **must** mount a persistent volume to prevent data loss when the container restarts:
1. Create a new service on Railway from your GitHub repo pointing to the `backend/` directory.
2. In the service settings, click **Volumes** -> **Add Volume** (size `1 GB` is plenty, mount path `/app/data`).
3. Update your `DATABASE_URL` environment variable to write the database inside the persistent volume path:
   `DATABASE_URL=sqlite:////app/data/portfolio.db`
4. Add all other environment variables (`GEMINI_API_KEY`, `NEWS_API_KEY`, SMTP details, etc.) to the Railway environment variables dashboard.
5. Railway will automatically build the `Dockerfile` and deploy the service, persisting the database across all restarts!

### Frontend — Vercel
1. Create a new project on Vercel and link your GitHub repository.
2. Configure the root directory of the project to point to the `frontend` folder.
3. In the environment variables section, add `NEXT_PUBLIC_API_URL` pointing to your deployed Railway backend URL (e.g., `https://portfolio-backend-production.up.railway.app`).
4. Click **Deploy**. Vercel will build the Next.js static and dynamic assets and deploy your premium dashboard to the cloud!
