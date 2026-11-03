# Deploy SHARA from GitHub to Railway

SHARA runs as one Django service, using its existing templates, backend and SQLite database. GitHub Actions retrieves the repository's Git LFS files and uploads the project to Railway; the Railway service does not need a direct GitHub source or a separate database service.

## 1. Prepare the Railway service

1. In Railway, create an **Empty Project**, then add an **Empty Service**. Give it a name such as `shara`.
2. Add a volume, attach it to that service, and set its mount path to `/data`. Keep the service at **one replica**. The application will refuse to start without the volume.
3. In the service's Variables tab, add `DJANGO_SECRET_KEY`. Generate a long, random value locally with `python -c "import secrets; print(secrets.token_urlsafe(64))"`. Keep the value private and use the same value on later deployments.
4. Under Settings → Networking → Public Networking, generate a Railway domain if available. Railway supplies the hostname through `RAILWAY_PUBLIC_DOMAIN`. If you cannot generate it before the first deployment, temporarily add `DJANGO_ALLOWED_HOSTS=localhost` to the service variables. Generate the domain after the first deployment, then redeploy so the automatic hostname is picked up.
5. Apply any staged Railway changes. The included Dockerfile supplies the build and start commands; use the repository root, not `Sara`, as the service root.

## 2. Connect GitHub Actions

1. In Railway **Project Settings → Tokens**, create a project token for the environment you intend to deploy, such as `production`. Copy the token securely.
2. In the GitHub repository, open **Settings → Secrets and variables → Actions → Secrets**, select **New repository secret**, and create `RAILWAY_TOKEN` with the Railway project token as its value.
3. On the same GitHub Actions settings page, select **Variables → New repository variable**. Create `RAILWAY_SERVICE` with the exact Railway service name, for example `shara`.

The workflow `.github/workflows/railway-deploy.yml` deploys pushes to `main` and can also be started from GitHub's **Actions → Deploy to Railway → Run workflow**. It checks out Git LFS content before uploading. Do not also connect the same service to Railway's native GitHub auto-deploy, which would create competing deployments and may not retrieve Git LFS files.

## 3. Push the deployment files

From the project root in PowerShell, review the files and commit the deployment configuration. The database does not need to be staged for these changes:

```powershell
git status --short
git add .gitattributes .dockerignore Dockerfile RAILWAY.md .github/workflows/railway-deploy.yml scripts/check_railway_assets.py scripts/railway_start.py Sara/Sara/railway_settings.py Sara/Sara/railway_urls.py
git diff --cached --stat
git commit -m "Configure GitHub deployment to Railway"
git lfs push origin main
git push origin main
```

The LFS push ensures the media, fonts and images referenced by the commit are available for GitHub Actions. If an LFS object is missing or access fails, resolve that first; the build checks for unresolved LFS pointers rather than serving broken files. Git LFS storage and bandwidth may be billed according to your GitHub plan.

After the push, open the GitHub repository's **Actions** tab and inspect **Deploy to Railway**. When the build finishes, check Railway's deployment logs and open the generated domain. Verify the homepage, login, static files and uploaded images. If you added the domain after deployment, redeploy before opening it.

## Data and backups

The initial deployment seeds an empty volume from the **committed GitHub version** of `Sara/shara.sqlite3` and the committed media files, then runs Django migrations and collects static files. Local changes that have not been committed and pushed are not included. If your local database contains newer data, plan a separate consistent transfer before using the live service; do not overwrite a running database.

The repository already contains a database and uploaded files that may contain private information. Restrict repository and Railway access appropriately. After the first start, the existing volume database and uploads persist across deploys and are not replaced by later GitHub commits. Set up regular [Railway volume backups](https://docs.railway.com/volumes/backups) and verify recovery.

For a custom domain, configure the DNS records shown by Railway, add its hostname to the comma-separated `DJANGO_ALLOWED_HOSTS`, and add its HTTPS origin to `DJANGO_CSRF_TRUSTED_ORIGINS`. For example:

```text
DJANGO_ALLOWED_HOSTS=example.com,www.example.com
DJANGO_CSRF_TRUSTED_ORIGINS=https://example.com,https://www.example.com
```

Apply and deploy the variable changes. See [Railway volumes](https://docs.railway.com/volumes), [Railway project tokens](https://docs.railway.com/integrations/api), and [GitHub Actions secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets).
