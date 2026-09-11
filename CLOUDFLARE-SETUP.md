# Cloudflare Pages Deployment Setup

Cloudflare Pages is the easiest way to host this static HTML/CSS/JS application for free.

## Option 1: Deploy via GitHub (Recommended)
1. Push all these files (`index.html`, `style.css`, `app.js`, `.gitignore`) to a new GitHub repository.
2. Log into the [Cloudflare Dashboard](https://dash.cloudflare.com/).
3. Navigate to **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**.
4. Select your GitHub repository.
5. Under **Build settings**, leave the Framework preset as `None` and the Build command empty.
6. Set the Build output directory to `/` (the root directory).
7. Click **Save and Deploy**. Your canteen site will be live on a `*.pages.dev` URL.

## Option 2: Deploy via Wrangler CLI (Direct Upload)
If you want to deploy directly from your terminal (perfect for your M5 Mac environment):

1. Install Wrangler globally via npm:
   ```bash
   npm install -g wrangler