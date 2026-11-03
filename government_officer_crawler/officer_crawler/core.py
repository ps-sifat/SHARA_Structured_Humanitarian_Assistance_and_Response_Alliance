from __future__ import annotations

import csv
import hashlib
import json
import re
import ssl
import time
import unicodedata
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser

import httpx
import truststore
from bs4 import BeautifulSoup


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", value)).strip()


def field_name(value: str) -> str:
    label = clean(value).lower().rstrip(":ঃ ")
    if label in {"নাম", "কর্মকর্তার নাম", "name", "officer name"}:
        return "name"
    if any(x in label for x in ("পদবি", "পদবী", "designation")):
        return "designation"
    if any(x in label for x in ("ইমেইল", "ই-মেইল", "ইমেল", "email", "e-mail")):
        return "emails"
    if any(x in label for x in ("মোবাইল", "mobile")):
        return "mobiles"
    if any(x in label for x in ("ফ্যাক্স", "fax", "ইন্টারকম", "intercom")):
        return ""
    if any(x in label for x in ("ফোন", "টেলিফোন", "phone", "telephone")):
        return "phones"
    if label in {"অফিস", "office", "office name", "দপ্তর", "অফিসের নাম"}:
        return "office"
    return ""


def emails(value: str) -> list[str]:
    value = re.sub(r"\s*[\[(]at[\])]\s*", "@", value, flags=re.I)
    value = re.sub(r"\s*[\[(]dot[\])]\s*", ".", value, flags=re.I)
    return sorted(set(re.findall(r"[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}", value)))


def phones(value: str) -> list[str]:
    value = value.translate(str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789"))
    result = []
    for match in re.findall(r"\+?\d[\d ()-]{5,}\d", value):
        digits = re.sub(r"\D", "", match)
        if digits.startswith("00880"):
            digits = digits[2:]
        if re.fullmatch(r"01[3-9]\d{8}", digits):
            digits = "88" + digits
        if digits.startswith("880"):
            digits = "+" + digits
        if digits not in result:
            result.append(digits)
    return result


@dataclass
class Officer:
    name: str
    designation: str = ""
    office: str = ""
    emails: list[str] = field(default_factory=list)
    mobiles: list[str] = field(default_factory=list)
    phones: list[str] = field(default_factory=list)
    level: str = ""
    division: str = ""
    district: str = ""
    upazila: str = ""
    source_url: str = ""
    retrieved_at: str = ""
    officer_id: str = ""


def parse_officers(html: str, source_url: str, **metadata: str) -> list[Officer]:
    """Parse paired key/value tables and tables with labeled header columns.

    Only explicitly labeled fields are extracted. No names or contact data are
    inferred from arbitrary page text. Unsupported layouts return an empty list.
    """
    soup = BeautifulSoup(html, "html.parser")
    for element in soup.find_all("wbr"):
        element.decompose()
    timestamp = datetime.now(timezone.utc).isoformat()
    result: list[Officer] = []
    pending: dict[str, str] = {}

    def emit(values: dict[str, str]) -> None:
        name = clean(values.get("name", ""))
        if not name or field_name(name) == "name":
            return
        kwargs = {k: metadata.get(k, "") for k in ("level", "division", "district", "upazila")}
        record = Officer(
            name=name, designation=values.get("designation", ""),
            office=values.get("office", metadata.get("office_name", "")),
            emails=emails(values.get("emails", "")),
            mobiles=phones(values.get("mobiles", "")),
            phones=phones(values.get("phones", "")),
            source_url=source_url, retrieved_at=timestamp, **kwargs,
        )
        key = json.dumps([source_url, name, record.designation, record.office], ensure_ascii=False)
        record.officer_id = hashlib.sha256(key.encode()).hexdigest()[:24]
        result.append(record)

    for table in soup.find_all("table"):
        # Process each leaf table once, avoiding enclosing layout tables.
        if table.find("table"):
            continue
        rows = [row.find_all(["td", "th"], recursive=False) for row in table.find_all("tr")]
        rows = [row for row in rows if row]
        if not rows:
            continue
        header_index = next((i for i, row in enumerate(rows)
                             if "name" in [field_name(c.get_text(" ", strip=True)) for c in row]
                             and sum(bool(field_name(c.get_text(" ", strip=True))) for c in row) >= 2), None)
        if header_index is not None:
            if pending:
                emit(pending)
                pending = {}
            headers = [field_name(c.get_text(" ", strip=True)) for c in rows[header_index]]
            for row in rows[header_index + 1:]:
                values = {key: clean(cell.get_text("" if key == "emails" else " ", strip=True))
                          for key, cell in zip(headers, row) if key}
                emit(values)
            continue
        for row in rows:
            if len(row) != 2:
                continue
            key = field_name(row[0].get_text(" ", strip=True))
            if not key:
                continue
            if key == "name" and pending.get("name"):
                emit(pending)
                pending = {}
            value = clean(row[1].get_text("" if key == "emails" else " ", strip=True))
            # Lists in a single cell retain separators for number extraction.
            pending[key] = (pending.get(key, "") + "; " + value).strip("; ")
    if pending:
        emit(pending)
    return list({r.officer_id: r for r in result}.values())


def load_seeds(path: str | Path) -> list[dict[str, str]]:
    with Path(path).open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    if any(not row.get("url") for row in rows):
        raise ValueError("Every seed must have a nonempty url column")
    return rows


class OfficerCrawler:
    """Sequential HTTP crawler; reuse one instance for an entire crawl.

    TLS verification stays enabled. robots.txt is checked for every origin;
    failed robots requests fail closed. Close with a context manager.
    """
    def __init__(self, delay: float = 1.5, timeout: float = 30,
                 user_agent: str = "BDPublicOfficerCrawler/1.0"):
        self.delay = max(0, delay)
        self.timeout = timeout
        self.user_agent = user_agent
        # The Django application also has a package called requests. Use HTTPX
        # so loading the crawler cannot shadow or replace that domain app.
        self.session = httpx.Client(
            headers={"User-Agent": user_agent},
            verify=truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT),
            follow_redirects=False, timeout=timeout,
        )
        self._robots: dict[str, RobotFileParser] = {}
        self._last_request = 0.0
        self.report: list[dict] = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.session.close()

    def _request(self, url: str, interval: float | None = None):
        wait = max(self.delay, interval or 0) - (time.monotonic() - self._last_request)
        if wait > 0:
            time.sleep(wait)
        for attempt in range(4):
            try:
                response = self.session.get(url)
            except httpx.RequestError:
                if attempt == 3:
                    raise
                time.sleep(max(self.delay, 2 ** attempt))
                continue
            finally:
                self._last_request = time.monotonic()
            if response.status_code not in {429, 500, 502, 503, 504} or attempt == 3:
                return response
            retry_after = response.headers.get('Retry-After', '')
            try:
                retry_wait = float(retry_after) if retry_after.isdigit() else (parsedate_to_datetime(retry_after) - datetime.now(timezone.utc)).total_seconds()
            except (TypeError, ValueError, OverflowError):
                retry_wait = 0
            if retry_wait > 300:
                raise RuntimeError(f'Source requested a long Retry-After delay; retry on the next scheduled check: {url}')
            time.sleep(max(self.delay, 2 ** attempt, retry_wait))

    def _fetch_response(self, url: str):
        for _ in range(6):
            parts = urlsplit(url)
            if parts.scheme not in {"http", "https"} or not parts.hostname or parts.username:
                raise ValueError(f"Invalid HTTP URL: {url}")
            origin = f"{parts.scheme}://{parts.netloc}"
            if origin not in self._robots:
                response = self._request(origin + "/robots.txt")
                parser = RobotFileParser()
                if response.status_code == 404:
                    parser.parse([])
                else:
                    response.raise_for_status()
                    if response.status_code != 200:
                        raise RuntimeError(f"Cannot verify robots.txt at {origin}")
                    parser.parse(response.text.splitlines())
                self._robots[origin] = parser
            parser = self._robots[origin]
            if not parser.can_fetch(self.user_agent, url):
                raise PermissionError(f"robots.txt disallows {url}")
            response = self._request(url, parser.crawl_delay(self.user_agent))
            if response.status_code in {301, 302, 303, 307, 308}:
                url = urljoin(url, response.headers["Location"])
                continue
            response.raise_for_status()
            return response
        raise RuntimeError(f"Too many redirects: {url}")

    def fetch(self, url: str) -> tuple[str, str]:
        response = self._fetch_response(url)
        content_type = response.headers.get("Content-Type", "").lower()
        if content_type and "html" not in content_type:
            raise ValueError(f"Expected HTML, received {content_type}")
        # Some public portal pages omit or mislabel their Unicode charset.
        if not response.encoding or response.encoding.lower() == "iso-8859-1":
            response.encoding = "utf-8"
        return response.text, str(response.url)

    def fetch_document(self, url: str) -> tuple[bytes, str, str]:
        """Fetch an HTML/PDF document using the same robots/redirect checks."""
        response = self._fetch_response(url)
        if len(response.content) > 30 * 1024 * 1024:
            raise ValueError("Document exceeds the 30 MB download limit")
        return response.content, str(response.url), response.headers.get("Content-Type", "").lower()

    def crawl(self, seeds: list[dict[str, str]]) -> list[Officer]:
        records: dict[str, Officer] = {}
        self.report = []
        for seed in seeds:
            url = seed.get("url", "")
            try:
                html, final_url = self.fetch(url)
                found = parse_officers(html, final_url, **{k: v for k, v in seed.items() if k != "url"})
                records.update({r.officer_id: r for r in found})
                self.report.append({"url": url, "status": "ok" if found else "no_records",
                                    "records": len(found), "error": ""})
            except (httpx.HTTPError, ValueError, PermissionError, RuntimeError, KeyError) as error:
                self.report.append({"url": url, "status": "error", "records": 0, "error": str(error)})
        return list(records.values())


def export_records(records: list[Officer], output_dir: str | Path) -> None:
    directory = Path(output_dir)
    directory.mkdir(parents=True, exist_ok=True)
    rows = [asdict(record) for record in records]
    (directory / "officers.json").write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    with (directory / "officers.csv").open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(Officer.__dataclass_fields__))
        writer.writeheader()
        writer.writerows({k: "; ".join(v) if isinstance(v, list) else v for k, v in row.items()} for row in rows)
    root = ET.Element("Officers")
    for row in rows:
        node = ET.SubElement(root, "Officer", officer_id=row["officer_id"])
        for key, value in row.items():
            if key == "officer_id":
                continue
            child = ET.SubElement(node, key)
            if isinstance(value, list):
                for item in value:
                    ET.SubElement(child, "item").text = item
            else:
                child.text = value
    ET.indent(root)
    ET.ElementTree(root).write(directory / "officers.xml", encoding="utf-8", xml_declaration=True)
