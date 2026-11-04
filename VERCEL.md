# Vercel test deployment

This configuration is **only for testing**. Each Vercel function instance uses its own disposable SQLite copy and uploaded media; changes can disappear or differ between requests. The initial database and media come from the committed GitHub revision. They may contain private information; deploy only if you are comfortable exposing the test site and restrict access where possible.

1. Commit and push `vercel.json`, `VERCEL.md`, `Sara/requirements.txt` and `Sara/Sara/vercel_settings.py` to GitHub. Do not include uncommitted database changes unless you intend to publish them.
2. Import the repository root as a Vercel Services project using the root `vercel.json`. It defines the `sara` Django service with root `Sara`. The crawler is a Python library used by a management command, not a separate HTTP service. Enable **Include source files outside of the Root Directory in the Build Step** in project settings so the sibling crawler files are available.
3. Add environment variables `DJANGO_SETTINGS_MODULE=Sara.vercel_settings` and `DJANGO_SECRET_KEY` (generate a random secret with `python -c "import secrets; print(secrets.token_urlsafe(64))"`).
4. Deploy. In Vercel project **Settings > Git**, enable Git LFS and redeploy; images and fonts are LFS files. Make sure the referenced LFS objects have been pushed to GitHub (`git lfs push origin main`).
5. Check the deploy logs and test the home page, login, CSS and images. Function instances do not share data. Vercel's function request limit is 4.5 MB, lower than the app's 5 MB image limit.

Do not use the Vercel test deployment for real users or sensitive data.
