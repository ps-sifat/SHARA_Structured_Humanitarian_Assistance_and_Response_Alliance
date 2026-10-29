# SHARA — Project Structure and Features

SHARA stands for **Structured Humanitarian Assistance and Response Alliance**. It is a Bangladesh-focused humanitarian assistance interface that connects help requests, volunteers, organizations, small teams, and administrators.

The current project is **Phase 1: Django routing and frontend conversion**. Django serves 34 pages built with HTML5, CSS, vanilla JavaScript, and Django Template Language. The original React application and its frontend tooling have been removed.

## 1. Current implementation status

| Area | What currently works |
| --- | --- |
| Django application | Project configuration, named URLs, class-based page rendering, ASGI and WSGI entry points. |
| Frontend | All 34 page interfaces, responsive layouts, navigation, forms, dialogs, searches, and language switching. |
| Static assets | Local stylesheets, JavaScript, SVG icons, images, and fonts. Page CSS and JavaScript remain beside their templates. |
| Requests and tracking | Browser-local demonstrations of submitting a request, receiving a reference and tracking code, and reviewing its progress. |
| Accounts and portals | A demo account selector and client-side role-specific interfaces. There is no Django authentication or server-side permission enforcement. |
| Organizations, teams, and missions | Interactive demonstrations using seeded data and browser storage. These are not database-backed business features. |
| Persistence | Demo records are saved in the current browser's `localStorage`, where available. They are not shared between different browsers or devices. |
| Database | SQLite is configured, but there are no application business models or business migrations. The current database file has no business data. |

The `/admin/` pages are SHARA's custom administrator interface. They are not Django's built-in admin site.

## 2. Technology stack

- Python 3.
- Django, with the requirement `Django>=5.2,<5.3`.
- Django Template Language for template inheritance, named links, and static asset references.
- HTML5 and native CSS.
- Vanilla JavaScript using native browser DOM APIs.
- SQLite configuration for future Django development.
- Browser `localStorage` for the existing demo workflows.

Running the project does not require Node.js, npm, React, TypeScript, Tailwind, Bootstrap, or jQuery.

## 3. Complete application structure

The tree below includes all application source files and assets. The contents of `.venv/` and `__pycache__/` are summarized because they are installed dependencies and generated Python cache files.

```text
SHARA/
|-- django/
|   |-- .venv/  # Local Python environment; installed dependencies omitted
|   +-- SHARA/
|       |-- SHARA/
|       |   |-- __pycache__/  # Generated Python cache files omitted
|       |   |-- __init__.py
|       |   |-- asgi.py
|       |   |-- settings.py
|       |   |-- staticfiles.py
|       |   |-- urls.py
|       |   +-- wsgi.py
|       |-- static/
|       |   +-- assets/
|       |       |-- fonts/
|       |       |   |-- bengali-1.ttf
|       |       |   |-- bengali-2.ttf
|       |       |   |-- bengali-3.ttf
|       |       |   |-- bengali-4.ttf
|       |       |   |-- bengali-5.ttf
|       |       |   |-- bengali-6.ttf
|       |       |   |-- bengali-7.ttf
|       |       |   |-- bengali-8.ttf
|       |       |   |-- LICENSE-Hind-Siliguri.txt
|       |       |   +-- LICENSE-Noto-Serif-Bengali.txt
|       |       |-- icons/
|       |       |   |-- favicon.svg
|       |       |   |-- LICENSE
|       |       |   +-- shara.svg
|       |       +-- images/
|       |           +-- flood-response.jpg
|       |-- templates/
|       |   |-- access_denied/
|       |   |   |-- access_denied.css
|       |   |   |-- access_denied.html
|       |   |   +-- access_denied.js
|       |   |-- admin_dashboard/
|       |   |   |-- admin_dashboard.css
|       |   |   |-- admin_dashboard.html
|       |   |   +-- admin_dashboard.js
|       |   |-- admin_mission_detail/
|       |   |   |-- admin_mission_detail.css
|       |   |   |-- admin_mission_detail.html
|       |   |   +-- admin_mission_detail.js
|       |   |-- admin_missions/
|       |   |   |-- admin_missions.css
|       |   |   |-- admin_missions.html
|       |   |   +-- admin_missions.js
|       |   |-- admin_organizations/
|       |   |   |-- admin_organizations.css
|       |   |   |-- admin_organizations.html
|       |   |   +-- admin_organizations.js
|       |   |-- admin_request_detail/
|       |   |   |-- admin_request_detail.css
|       |   |   |-- admin_request_detail.html
|       |   |   +-- admin_request_detail.js
|       |   |-- admin_requests/
|       |   |   |-- admin_requests.css
|       |   |   |-- admin_requests.html
|       |   |   +-- admin_requests.js
|       |   |-- admin_suppliers/
|       |   |   |-- admin_suppliers.css
|       |   |   |-- admin_suppliers.html
|       |   |   +-- admin_suppliers.js
|       |   |-- admin_teams/
|       |   |   |-- admin_teams.css
|       |   |   |-- admin_teams.html
|       |   |   +-- admin_teams.js
|       |   |-- apply/
|       |   |   |-- apply.css
|       |   |   |-- apply.html
|       |   |   +-- apply.js
|       |   |-- home/
|       |   |   |-- home.css
|       |   |   |-- home.html
|       |   |   +-- home.js
|       |   |-- login/
|       |   |   |-- login.css
|       |   |   |-- login.html
|       |   |   +-- login.js
|       |   |-- map/
|       |   |   |-- map.css
|       |   |   |-- map.html
|       |   |   +-- map.js
|       |   |-- org_dashboard/
|       |   |   |-- org_dashboard.css
|       |   |   |-- org_dashboard.html
|       |   |   +-- org_dashboard.js
|       |   |-- org_memberships/
|       |   |   |-- org_memberships.css
|       |   |   |-- org_memberships.html
|       |   |   +-- org_memberships.js
|       |   |-- org_mission_detail/
|       |   |   |-- org_mission_detail.css
|       |   |   |-- org_mission_detail.html
|       |   |   +-- org_mission_detail.js
|       |   |-- org_missions/
|       |   |   |-- org_missions.css
|       |   |   |-- org_missions.html
|       |   |   +-- org_missions.js
|       |   |-- org_profile/
|       |   |   |-- org_profile.css
|       |   |   |-- org_profile.html
|       |   |   +-- org_profile.js
|       |   |-- org_team_edit/
|       |   |   |-- org_team_edit.css
|       |   |   |-- org_team_edit.html
|       |   |   +-- org_team_edit.js
|       |   |-- org_team_new/
|       |   |   |-- org_team_new.css
|       |   |   |-- org_team_new.html
|       |   |   +-- org_team_new.js
|       |   |-- org_teams/
|       |   |   |-- org_teams.css
|       |   |   |-- org_teams.html
|       |   |   +-- org_teams.js
|       |   |-- org_volunteers/
|       |   |   |-- org_volunteers.css
|       |   |   |-- org_volunteers.html
|       |   |   +-- org_volunteers.js
|       |   |-- organization_register/
|       |   |   |-- organization_register.css
|       |   |   |-- organization_register.html
|       |   |   +-- organization_register.js
|       |   |-- privacy/
|       |   |   |-- privacy.css
|       |   |   |-- privacy.html
|       |   |   +-- privacy.js
|       |   |-- track/
|       |   |   |-- track.css
|       |   |   |-- track.html
|       |   |   +-- track.js
|       |   |-- volunteer_dashboard/
|       |   |   |-- volunteer_dashboard.css
|       |   |   |-- volunteer_dashboard.html
|       |   |   +-- volunteer_dashboard.js
|       |   |-- volunteer_mission_detail/
|       |   |   |-- volunteer_mission_detail.css
|       |   |   |-- volunteer_mission_detail.html
|       |   |   +-- volunteer_mission_detail.js
|       |   |-- volunteer_missions/
|       |   |   |-- volunteer_missions.css
|       |   |   |-- volunteer_missions.html
|       |   |   +-- volunteer_missions.js
|       |   |-- volunteer_organization/
|       |   |   |-- volunteer_organization.css
|       |   |   |-- volunteer_organization.html
|       |   |   +-- volunteer_organization.js
|       |   |-- volunteer_organizations/
|       |   |   |-- volunteer_organizations.css
|       |   |   |-- volunteer_organizations.html
|       |   |   +-- volunteer_organizations.js
|       |   |-- volunteer_profile/
|       |   |   |-- volunteer_profile.css
|       |   |   |-- volunteer_profile.html
|       |   |   +-- volunteer_profile.js
|       |   |-- volunteer_register/
|       |   |   |-- volunteer_register.css
|       |   |   |-- volunteer_register.html
|       |   |   +-- volunteer_register.js
|       |   |-- volunteer_requests/
|       |   |   |-- volunteer_requests.css
|       |   |   |-- volunteer_requests.html
|       |   |   +-- volunteer_requests.js
|       |   |-- volunteer_team/
|       |   |   |-- volunteer_team.css
|       |   |   |-- volunteer_team.html
|       |   |   +-- volunteer_team.js
|       |   |-- base.css
|       |   +-- base.html
|       |-- db.sqlite3
|       |-- manage.py
|       +-- requirements.txt
+-- README.md
```

### Main files and folders

| Location | Purpose |
| --- | --- |
| `README.md` | This project overview, structure, feature inventory, and running instructions. |
| `django/.venv/` | The local Python virtual environment containing Django and its dependencies. It is specific to the machine where it was created. |
| `django/SHARA/manage.py` | Entry point for Django commands such as `runserver`, `check`, and `collectstatic`. |
| `django/SHARA/requirements.txt` | The project's Python dependency requirement. |
| `django/SHARA/SHARA/__init__.py` | Marks the inner `SHARA` directory as a Python package. |
| `django/SHARA/SHARA/settings.py` | Configures templates, installed components, middleware, database, language, timezone, and static assets. |
| `django/SHARA/SHARA/urls.py` | Defines 34 named page routes and one legacy redirect. |
| `django/SHARA/SHARA/staticfiles.py` | Defines `PageAssetFinder`, which exposes page CSS and JavaScript through Django staticfiles. |
| `django/SHARA/SHARA/asgi.py` | ASGI application entry point. |
| `django/SHARA/SHARA/wsgi.py` | WSGI application entry point. |
| `django/SHARA/templates/base.html` | Shared HTML shell, metadata, favicon, stylesheet loading, template blocks, and the named URL registry used by page JavaScript. |
| `django/SHARA/templates/base.css` | Shared visual foundations, font declarations, global styles, design variables, and animations. |
| `django/SHARA/templates/<page>/` | Each page's initial HTML, CSS, and JavaScript. |
| `django/SHARA/static/assets/` | Shared local images, SVG icons, fonts, and their licenses. |
| `django/SHARA/db.sqlite3` | The default SQLite database location; no business records are currently stored here. |
| `__pycache__/` | Generated Python bytecode caches. These are not application source. |

There are no custom Django business apps, `models.py`, application migration directories, or `tests.py` files in this phase.

## 4. Pages and URL routes

Each page has three files in `templates/<page>/`: `<page>.html`, `<page>.css`, and `<page>.js`. The page folder name also matches its Django URL name.

`<id>` below represents a request, team, or mission identifier. The actual Django patterns use `<str:id>`.

### Public pages — 9 routes

| URL | URL name / template folder | Purpose |
| --- | --- | --- |
| `/` | `home` | Landing page, help-request calls to action, map, summary statistics, process explanation, and registration links. |
| `/apply/` | `apply` | Submit a demo help request for yourself or another person. |
| `/map/` | `map` | Explore the interactive Bangladesh map and area summaries. |
| `/volunteer/register/` | `volunteer_register` | Enter a volunteer profile, location, skills, capabilities, and optional organization membership request. |
| `/organization/register/` | `organization_register` | Enter organization details, administrator information, contact details, operating districts, and locations. |
| `/login/` | `login` | Select an existing demo account and enter its portal. |
| `/track/` | `track` | Look up a demo request using its reference and tracking code. |
| `/privacy/` | `privacy` | Display the existing privacy information. |
| `/access-denied/` | `access_denied` | Display the client-side access-denied interface and a return link. |

### Volunteer portal — 8 routes

| URL | URL name / template folder | Purpose |
| --- | --- | --- |
| `/volunteer/` | `volunteer_dashboard` | Display the volunteer's profile summary, membership, team, and next relevant action. |
| `/volunteer/requests/` | `volunteer_requests` | Browse request summaries, filter by location, and open a summary dialog. |
| `/volunteer/profile/edit/` | `volunteer_profile` | Edit profile details, photo, location, skills, availability, and capabilities. |
| `/volunteer/organizations/` | `volunteer_organizations` | Search organizations and send a demo membership request. |
| `/volunteer/organization/` | `volunteer_organization` | Review membership requests and the current organization's membership status. |
| `/volunteer/team/` | `volunteer_team` | View the volunteer's assigned small team and related information. |
| `/volunteer/missions/` | `volunteer_missions` | Browse the team's current and past missions, with status filters. |
| `/volunteer/missions/<id>/` | `volunteer_mission_detail` | View mission details, progress, operational notes, and history; eligible demo team leaders can update progress. |

### Organization portal — 9 routes

| URL | URL name / template folder | Purpose |
| --- | --- | --- |
| `/org/` | `org_dashboard` | Display organization verification status, membership counts, teams, and mission summaries. |
| `/org/memberships/` | `org_memberships` | Review pending membership requests and record demo approval or rejection decisions. |
| `/org/volunteers/` | `org_volunteers` | Browse approved members and manage eligible demo membership removals. |
| `/org/profile/` | `org_profile` | View organization details and edit its profile through a dialog. |
| `/org/teams/` | `org_teams` | Search and browse the organization's small teams. |
| `/org/teams/new/` | `org_team_new` | Create a demo team from approved members, choose its leader, and define its areas and capabilities. |
| `/org/teams/<id>/edit/` | `org_team_edit` | View or edit an existing team; the demo locks editing while the team has an active mission. |
| `/org/missions/` | `org_missions` | Browse missions associated with the organization's teams. |
| `/org/missions/<id>/` | `org_mission_detail` | Review an organization's mission details and progress history. |

### Administrator portal — 8 routes

| URL | URL name / template folder | Purpose |
| --- | --- | --- |
| `/admin/` | `admin_dashboard` | Display request-review, dispatch, mission, and organization-verification summaries. |
| `/admin/requests/` | `admin_requests` | Search and filter requests for review or dispatch. |
| `/admin/requests/<id>/` | `admin_request_detail` | Review a request, reveal its demo contact details, record a review decision, inspect eligible teams, and create a demo mission assignment. |
| `/admin/missions/` | `admin_missions` | Browse and filter missions across organizations. |
| `/admin/missions/<id>/` | `admin_mission_detail` | Inspect mission details and history, and record supported cancellation or failure actions. |
| `/admin/organizations/` | `admin_organizations` | Review organization registration details and record demo verification decisions. |
| `/admin/teams/` | `admin_teams` | Browse teams, their organizations, capabilities, members, and availability. |
| `/admin/suppliers/` | `admin_suppliers` | Browse suppliers and their resources, and add demo supplier or resource records. |

### Legacy URL

`/volunteer/teams/` redirects to `/volunteer/organizations/` through Django's `RedirectView`. Its URL name is `volunteer_teams`. It has no separate page template.

## 5. What the frontend does

### Help requests and tracking

- Supports requests for yourself or on another person's behalf.
- Includes district and upazila selection, number of people, required assistance, contact information, and a situation description.
- Provides additional reporter and relationship fields for requests made on another person's behalf.
- Validates the form in the browser, including Bangladeshi mobile-number formatting and Bengali digits.
- Saves a demo request locally and displays its reference and tracking code.
- Opens tracking with the request reference already filled in.
- Shows progress after the reference and tracking code match a local record.
- Allows additional information to be submitted locally when a demo request needs clarification.

These actions do not send a request to a Django submission endpoint or a real response team.

### Bangladesh map

- Displays an SVG Bangladesh map with district and subdivision geometry.
- Shows seeded request markers and flood-related visual layers.
- Searches areas using Bengali or English names.
- Supports selecting markers or map areas, zooming, and resetting the view.
- Displays area-level request counts, assistance categories, and status summaries.
- Links an area to the application form with district and upazila query parameters.
- Includes existing demonstration controls for normal, loading, error, and empty states.

The map uses embedded demonstration data. It does not fetch live flood conditions or live emergency reports.

### Volunteer and organization membership

- Registers demo volunteer and organization records in browser storage.
- Separates organization membership approval from assignment to a small team.
- Supports organization searches, membership requests, review decisions, and status displays.
- Allows organization administrators to select approved members for a team and choose a leader from those members.
- Tracks operating areas, assistance capabilities, availability, vehicle access, and swimming capability where the relevant form provides them.
- Applies existing client-side checks for pending organizations, team membership, and active missions.

### Mission workflow

The demonstration follows this sequence:

1. A person submits a request.
2. An administrator reviews it and may verify it, request clarification, or reject it.
3. A verified request can be assigned to an eligible team.
4. The assigned team leader acknowledges the mission.
5. The team leader starts the work and records progress.
6. The mission is completed, or a supported problem, cancellation, or failure state is recorded.
7. Local tracking and relevant portal summaries reflect the updated demo state.

The client-side demonstration checks team suitability using organization verification, area coverage, capabilities, availability, and active assignments. It also prevents duplicate dispatches in the supported workflow and retains assignment/progress history.

Mission status values include `assigned`, `acknowledged`, `ongoing`, `problem`, `done`, `cancelled`, and `failed`. Resolving a problem returns the mission to its recorded preceding stage.

### Supplier and resource interfaces

- Lists suppliers and lets the administrator select one to inspect its resources.
- Adds demo suppliers with a name, category, location, and contact details.
- Adds demo resources with a name, category, quantity, and note.
- Displays whether a resource has stock.

### Shared browser interactions

- Responsive public navigation and portal navigation.
- Bengali and English language switching, including persistent language preference.
- Searchable location dropdowns, filters, choice controls, and confirmation dialogs.
- Keyboard-accessible dialogs, Escape handling, and focus return.
- Query-parameter navigation and browser back/forward behavior.
- Loading indicators, empty states, validation feedback, and existing animations.
- Developer controls for switching demo accounts, browsing the page index, and resetting demo records.
- Local storage change handling for supported updates across tabs on the same origin.

### Profile and organization images

- Accepts JPEG, PNG, and WebP files up to 5 MiB.
- Displays previews and supports replacement or removal.
- Resizes and prepares images in the browser using a canvas.
- Stores prepared image data with the local demo profile when saved.
- Preserves cancellation and validation behavior.

Images selected through these forms are not uploaded to the server or stored in a Django media directory.

## 6. Data, accounts, and persistence

The page scripts contain seeded demonstration accounts, requests, volunteers, organizations, memberships, teams, missions, suppliers, and resources.

| Browser storage key | Contents |
| --- | --- |
| `shara-demo-v1` | Versioned demo records and the selected demo account identifier. |
| `shara-language` | The selected presentation language, `bn` or `en`. |

The account selector changes the demo session and directs the browser to the corresponding portal. Client-side checks decide which controls or screens appear. These checks are not a substitute for future Django authentication, authorization, and server-side validation.

The public map, request summaries, and tracking interface omit personal contact details in their presentation. Demo records remain part of the browser-side application data; this phase does not provide server-enforced data privacy or access control.

The existing developer-control dialog can reset the local demo data. Clearing site storage also removes saved demo changes. Storage belongs to the browser origin, so `localhost:8000`, `127.0.0.1:8000`, and another port have separate local records.

## 7. Django architecture and page rendering

### Request flow

1. The browser requests a page URL.
2. `SHARA/urls.py` resolves its named route.
3. Django's `TemplateView` renders the corresponding page template.
4. The template extends `base.html` and loads the shared stylesheet, page stylesheet, and page JavaScript.
5. The browser loads local assets through Django staticfiles during development.
6. The page's vanilla JavaScript initializes its interface and browser-local demo behavior.

All 34 normal pages use `TemplateView`. The legacy organization-browser URL uses `RedirectView`. No custom business view classes have been added.

### Template and JavaScript ownership

The HTML templates contain initial page markup. Page JavaScript also contains native DOM rendering functions and updates the interface inside `#shara-app`.

When changing visible page content, keep the initial HTML and the matching JavaScript rendering code consistent. Editing only the HTML can be overwritten when JavaScript redraws the interface. Shared browser helpers and demo logic are currently included in each page's self-contained JavaScript file rather than imported from separate source modules.

`base.html` contains a JSON registry whose URL values are generated with Django's `{% url %}` tag. Page JavaScript uses this registry to resolve existing page destinations to Django URLs. Initial HTML navigation also uses named Django URL tags.

### Page CSS and JavaScript in `templates/`

`PageAssetFinder` provides the requested folder organization without serving the templates directory as an unrestricted public directory:

- `STATICFILES_DIRS` includes the shared `static/` directory.
- The custom finder discovers only `.css` and `.js` files inside `templates/`.
- Resolved page asset paths must remain inside the templates directory.
- Template HTML and Python files are not exposed by this finder.
- Django's normal development `runserver` serves discovered static assets when debug mode is enabled.
- `collectstatic` can copy the shared assets and discovered page assets into `staticfiles/` for a separate production static-file server.

For example:

```django
{% load static %}
<link rel="stylesheet" href="{% static 'apply/apply.css' %}">
<script src="{% static 'apply/apply.js' %}" defer></script>
<a href="{% url 'apply' %}">Apply</a>
```

There is no production URL shortcut that directly serves the templates directory.

## 8. Local assets

| Asset | Purpose |
| --- | --- |
| `static/assets/images/flood-response.jpg` | The original flood-response photograph used on the landing page. |
| `static/assets/icons/shara.svg` | Shared SVG icon symbols used by the interface. |
| `static/assets/icons/favicon.svg` | Browser favicon. |
| `static/assets/icons/LICENSE` | License for the icon assets. |
| `static/assets/fonts/bengali-1.ttf` through `bengali-4.ttf` | Hind Siliguri, weights 400, 500, 600, and 700. |
| `static/assets/fonts/bengali-5.ttf` through `bengali-8.ttf` | Noto Serif Bengali, weights 500, 600, 700, and 800. |
| `static/assets/fonts/LICENSE-Hind-Siliguri.txt` | Hind Siliguri font license. |
| `static/assets/fonts/LICENSE-Noto-Serif-Bengali.txt` | Noto Serif Bengali font license. |

Font declarations are in `templates/base.css`. The application does not need a frontend asset build step to use these files.

## 9. Run the project locally

### Use the existing Windows virtual environment

From the repository root, run:

```powershell
.\django\.venv\Scripts\python.exe .\django\SHARA\manage.py runserver
```

Open **http://127.0.0.1:8000/**. If a development server is already using port 8000, reuse it or stop it before starting another instance.

To use another port:

```powershell
.\django\.venv\Scripts\python.exe .\django\SHARA\manage.py runserver 8001
```

### Recreate the environment on another Windows machine

Install a Python version supported by the project's Django release, then run these commands from the repository root:

```powershell
python -m venv django/.venv
.\django\.venv\Scripts\python.exe -m pip install -r .\django\SHARA\requirements.txt
.\django\.venv\Scripts\python.exe .\django\SHARA\manage.py runserver
```

Virtual environments should be recreated when moving between machines or operating systems. On Linux or macOS, the environment's interpreter is normally `django/.venv/bin/python` instead of the Windows `Scripts/python.exe` path.

No business migrations are required for the current frontend phase.

### Check the Django configuration

```powershell
.\django\.venv\Scripts\python.exe .\django\SHARA\manage.py check
```

### Collect static assets

```powershell
.\django\.venv\Scripts\python.exe .\django\SHARA\manage.py collectstatic --noinput
```

This creates or updates `django/SHARA/staticfiles/`. That directory is generated deployment output and is not part of the source tree shown above. Production static-file hosting must be configured separately; the development server is not the production serving solution.

## 10. Configuration

| Setting / variable | Current behavior |
| --- | --- |
| `DJANGO_DEBUG` | Defaults to `1`. Set to `0` to disable debug mode. |
| `DJANGO_SECRET_KEY` | Uses a local development fallback unless supplied. Startup rejects that fallback when debug mode is disabled. |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated allowed hosts; defaults to `localhost,127.0.0.1,[::1],testserver`. |
| `LANGUAGE_CODE` | `bn`. The browser interface also supports switching to English. |
| `TIME_ZONE` | `Asia/Dhaka`. |
| `STATIC_URL` | `/static/`. |
| `STATIC_ROOT` | `django/SHARA/staticfiles/`. |
| Database backend | SQLite, with the database at `django/SHARA/db.sqlite3`. |
| Installed Django component | `django.contrib.staticfiles`. |

Environment variables are read from the process environment. The project does not automatically load `.env` files.

## 11. What belongs to a later backend phase

The following work has not been implemented in Django:

- Business models, database relationships, and business migrations.
- Real volunteer, organization, and administrator authentication.
- Server-side sessions, permissions, and role enforcement.
- Request submission, tracking, and clarification endpoints backed by a database.
- Organization verification, memberships, team management, and mission processing on the server.
- Server-side validation and permanent audit/history records.
- Server-side file uploads and media storage.
- Live flood-data integrations or external emergency-response integrations.
- Email, SMS, or push notifications.
- Production deployment infrastructure.

Future business functionality can be added through dedicated Django apps when that phase is requested. The current project keeps page routing in the main project package and preserves the frontend interfaces for that integration.

## 12. Verification and maintenance

During conversion and cleanup, the following were checked:

- Django system checks completed without reported issues.
- All 34 page routes rendered successfully.
- The legacy redirect and missing-page handling worked.
- Visible navigation targets and browser back/forward behavior were checked in Chromium.
- Local page assets, fonts, images, and icons loaded.
- Mobile navigation, dialog keyboard behavior, language switching, forms, image previews, and demo workflows were exercised.
- Representative desktop and mobile public screens matched the original frontend in screenshot comparisons.
- Static collection exported assets without copying template HTML or Python source.
- The Django project still ran after the original frontend source and temporary conversion dependencies were removed.

Temporary conversion tools, browser QA scripts, and comparison screenshots were removed during cleanup. There is currently no retained automated browser test suite or `tests.py` file. Re-run relevant checks when modifying the application.

### Where to make changes

| Change | Files to update |
| --- | --- |
| Page markup and browser behavior | The corresponding `templates/<page>/<page>.html` and `.js` files. |
| Page-specific styles | The corresponding `templates/<page>/<page>.css` file. |
| Shared fonts, variables, and global styles | `templates/base.css`. |
| Shared shell, metadata, asset loading, or browser URL registry | `templates/base.html`. |
| Add or change a route | `SHARA/urls.py`, matching template links, and the URL registry in `base.html` where browser navigation needs it. |
| Add shared images, icons, or fonts | `static/assets/`, retaining applicable licenses. |
| Change Django settings | `SHARA/settings.py`. |
| Change template asset discovery | `SHARA/staticfiles.py`. |
| Add future backend features | Introduce appropriate Django apps and replace the relevant browser-local demo behavior when authorized. |
