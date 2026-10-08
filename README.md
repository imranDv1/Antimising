# AntiMising

![AntiMising Preview](https://notes.eduvorea.com/_next/image?url=%2FImages%2FScreenshot%202026-10-09%20005536.png&w=3840&q=75)

> Notes, canvas, and passwords — all in one secure workspace, powered by AI. Built with Next.js + TypeScript.

[Live demo](https://rivorea-notes.vercel.app) • **TypeScript** • **Next.js** • **Prisma**

---

## 🎯 What is AntiMising?

AntiMising is a modern, all-in-one workspace built with **Next.js (App Router)** and **TypeScript**. It combines three products in one clean, minimal interface:

* 📝 **Notes** — rich text editor (TipTap) with formatting, images, search, favorites and sharing
* 🎨 **Canvas** — infinite whiteboards (tldraw + Excalidraw) for visual thinking
* 🔑 **Passwords** — AES-encrypted password manager (stored client-side encrypted)

A built-in AI assistant (NoteBuddy, powered by Google Gemini) helps you write, summarize and draft inside your notes.

---

## ✨ Key Features

* ✍️ Create, edit, and delete notes with rich text formatting (TipTap)
* 🎨 Infinite canvas whiteboards (tldraw) for visual thinking
* 🔑 Encrypted password manager (AES, client-side encryption)
* 🤖 NoteBuddy — AI-powered writing assistant for summarizing and drafting
* 🔐 Secure authentication (email/password + Google OAuth via Better Auth)
* ☁️ Cloud image uploads via Cloudinary
* 💳 Pro plan payments via Sifalo Pay (one-time $9 checkout, 30 days)
* 🔗 Share notes and save favorites with smart organization
* 🧩 Drag-and-drop notes, search (title, content, category), dark mode
* 📱 Fully responsive design

### Plan limits

| | Free | Pro |
| --- | --- | --- |
| Characters / note | 3,000 | 10,000 |
| Notes | 10 | Unlimited |
| Images / note | 3 | Unlimited |
| Passwords | 10 | Unlimited |
| Canvases | 3 | Unlimited |

---

## 🧰 Tech Stack

* **Next.js 15 (App Router)** + **React 19** + **TypeScript**
* **Tailwind CSS v4** + **shadcn/ui** (Radix UI, lucide-react)
* **TipTap** rich text editor
* **tldraw** + **Excalidraw** canvas
* **Prisma** ORM + **PostgreSQL** (Neon)
* **Better Auth** for authentication (email + Google OAuth)
* **Google Gemini** (AI assistant), **OpenAI** SDK
* **Cloudinary** for image storage
* **Resend** for transactional email
* **Sifalo Pay** for payments
* **Arcjet** for bot protection
* **Zod** validation, **Zustand** state, **Framer Motion** animations
* **Deployed on Vercel**

---

## 🚀 Quick Start (Local Development)

Requires **Bun** installed. Clone the repository:

```bash
git clone https://github.com/imranDv1/Rivorea-notes.git
cd Rivorea-notes
```

### 1. Install dependencies

```bash
bun install
```

### 2. Set up your `.env` file

Create a `.env` file in the project root. See `.env.example` if present, or copy the structure below and fill in your actual credentials:

```env
# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Database (Neon/Postgres)
DATABASE_URL="postgresql://user:password@host:port/dbname?sslmode=require&channel_binding=require"

# Authentication (Better Auth)
BETTER_AUTH_URL="http://localhost:3000"
BETTER_AUTH_SECRET="your-better-auth-secret"
GOOGLE_CLIENT_ID_WEB="your-google-client-id-web"
GOOGLE_CLIENT_ID_ANDROID="your-google-client-id-android"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# AI
GEMINI_API_KEY="your-gemini-api-key"

# Cloudinary
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# Encryption keys (generate your own)
ENCRYPTION_KEY="hex-64-chars"
NOTE_ENCRYPTION_KEY="base64-key"
PASSWORD_ENCRYPTION_KEY="hex-64-chars"

# Email (Resend)
RESEND_API_KEY="your-resend-key"
RESEND_FROM="AntiMising <no-reply@yourdomain.com>"

# Payments (Sifalo Pay)
SIFALO_USERNAME="your-sifalo-username"
SIFALO_API_KEY="your-sifalo-api-key"
SIFALO_PRICE_USD=9

# Optional: bot protection
ARCJET_KEY="your-arcjet-key"
```

> ⚠️ Make sure to fill in the actual credentials for your environment. Never commit your real `.env`.

### 3. Set up Prisma

```bash
bunx prisma generate
bunx prisma db push
```

### 4. Run the development server

```bash
bun run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the app.

---

## 📦 Build & Production

```bash
bun run build   # runs prisma generate + next build
bun run start
```

Deploy directly to **Vercel** — just connect your GitHub repository, select **Bun** as the install/runtime command (or use `bunx next build --turbopack` as the build command) and add the same environment variables in the Vercel dashboard. PostgreSQL on Neon works with zero config.

---

## 🧹 Quality Checks

```bash
bunx tsc --noEmit   # type checking
bun run lint        # ESLint
```

---

## ♻️ Contributing

Contributions are always welcome!

1. Fork the repo
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request 🎉

---

## 📸 Screenshot

![AntiMising Screenshot](https://notes.eduvorea.com/_next/image?url=%2FImages%2FScreenshot%202026-10-09%20005536.png&w=3840&q=75)

---

## 🙏 Credits

Developed by [Imran Ahmed](https://github.com/imranDv1)

* GitHub: [AntiMising](https://github.com/imranDv1/Rivorea-notes)
* Live Demo: [rivorea-notes.vercel.app](https://rivorea-notes.vercel.app)

---

✨ *"AntiMising — Capture, organize, and think better."*
