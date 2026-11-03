"""Public NGO Affairs Bureau HTML/PDF registry tables; no account creation."""
from __future__ import annotations

import io
import csv
import json
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlsplit

import pdfplumber
from pdfplumber.utils.exceptions import MalformedPDFException, PdfminerException
import httpx
from bs4 import BeautifulSoup

from .core import OfficerCrawler, clean, emails, phones


@dataclass
class NGO:
    registration_number: str
    name: str
    address: str = ""
    district: str = ""
    country: str = ""
    emails: list[str] = field(default_factory=list)
    phones: list[str] = field(default_factory=list)
    website: str = ""
    registration_date: str = ""
    renewed_on: str = ""
    valid_until: str = ""
    remarks: str = ""
    source_url: str = ""
    retrieved_at: str = ""
    source_conflict: str = ""

    @property
    def ngo_id(self) -> str:
        return "BD-NAB-" + self.registration_number


def ngo_field(value: str) -> str:
    label = clean(value or "").casefold().replace(".", "")
    if "name" in label and ("ngo" in label or "organization" in label) or label in {"name", "এনজিওর নাম", "সংস্থার নাম"}:
        return "name"
    if "reg" in label and any(s in label for s in ("no", "number")) or "নিবন্ধন নম্বর" in label:
        return "registration_number"
    if "address" in label or "ঠিকানা" in label:
        return "address"
    if "district" in label or "জেলা" in label:
        return "district"
    if "country" in label or "দেশ" == label:
        return "country"
    if "valid" in label or "মেয়াদ" in label:
        return "valid_until"
    if "renew" in label or "নবায়ন" in label:
        return "renewed_on"
    if "reg" in label and "date" in label:
        return "registration_date"
    if "remark" in label or "মন্তব্য" in label:
        return "remarks"
    if "email" in label or "e-mail" in label or "ইমেইল" in label:
        return "emails"
    if any(s in label for s in ("phone", "mobile", "telephone", "মোবাইল", "ফোন")):
        return "phones"
    if "website" in label or "ওয়েব" in label:
        return "website"
    return ""


def ngo_rows(tables, source_url: str) -> list[NGO]:
    """Require a name and registration column; never infer registry IDs."""
    result = []
    headers = []
    timestamp = datetime.now(timezone.utc).isoformat()
    for table in tables:
        for row in table:
            labels = [ngo_field(str(cell or "")) for cell in row]
            if "name" in labels and "registration_number" in labels:
                headers = labels
                continue
            if not headers or len(row) != len(headers):
                continue
            values = {key: clean(str(cell or "")) for key, cell in zip(headers, row) if key}
            number = values.get("registration_number", "").translate(str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789"))
            if not re.fullmatch(r"\d{1,12}", number) or not values.get("name"):
                continue
            address = values.get("address", "")
            # Only labeled telephone text or explicit mobile numbers are contact numbers.
            # Address house/postcode digits and registration dates are not phone numbers.
            labeled = re.findall(r"(?:phone|tel(?:ephone)?|mobile|ফোন|মোবাইল)\s*[:：-]?\s*([+\d০-৯ ()/,;|.-]+)", address, re.I)
            mobile = re.findall(r"(?:\+?88)?01[3-9][\d -]{8,12}", address.translate(str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")))
            contact_text = "; ".join([values.get("phones", ""), *labeled, *mobile])
            sites = re.findall(r"(?:https?://|www\.)[^\s,;]+", values.get("website", "") or address)
            result.append(NGO(
                registration_number=number, name=values["name"], address=address,
                district=values.get("district", ""), country=values.get("country", ""),
                emails=emails(values.get("emails", "") + " " + address), phones=phones(contact_text),
                website=sites[0].rstrip(".") if sites else "",
                registration_date=values.get("registration_date", ""), renewed_on=values.get("renewed_on", ""),
                valid_until=values.get("valid_until", ""), remarks=values.get("remarks", ""),
                source_url=source_url, retrieved_at=timestamp,
            ))
    return merge_ngos(result)


def merge_ngos(records):
    unique = {}
    for record in records:
        existing = unique.get(record.ngo_id)
        if existing:
            comparable = lambda item: {key: value for key, value in asdict(item).items() if key not in {'retrieved_at', 'source_url', 'source_conflict'}}
            if comparable(existing) != comparable(record):
                existing.source_conflict = f'NGOAB registration {record.registration_number} has conflicting entries: {existing.name} / {record.name}'
        else:
            unique[record.ngo_id] = record
    return list(unique.values())


def parse_ngos(html: str, source_url: str) -> list[NGO]:
    soup = BeautifulSoup(html, "html.parser")
    tables = [[[cell.get_text(" ", strip=True) for cell in row.find_all(["th", "td"], recursive=False)]
               for row in table.find_all("tr")] for table in soup.find_all("table") if not table.find("table")]
    return ngo_rows(tables, source_url)


def parse_ngo_pdf(content: bytes, source_url: str) -> list[NGO]:
    tables = []
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        if len(pdf.pages) > 500:
            raise ValueError("NGO registry exceeds the 500-page extraction limit")
        for page in pdf.pages:
            tables.extend(page.extract_tables())
    return ngo_rows(tables, source_url)


def ngo_document_links(html: str, source_url: str) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    result = []
    for tag in soup.select("a[href], iframe[src], embed[src], object[data]"):
        url = urljoin(source_url, tag.get("href") or tag.get("src") or tag.get("data"))
        query = parse_qs(urlsplit(url).query)
        if urlsplit(url).hostname in {"docs.google.com", "drive.google.com"} and query.get("url"):
            url = query["url"][0]
        host = (urlsplit(url).hostname or "").lower()
        official_storage = host == 'objectstorage.ap-dcc-gazipur-1.oraclecloud15.com' and '/office-ngoab/' in urlsplit(url).path
        if (host == "ngoab.gov.bd" or host.endswith(".portal.gov.bd") or official_storage) and urlsplit(url).path.lower().endswith(".pdf") and url not in result:
            result.append(url)
    if len(result) > 8:
        raise ValueError("More than eight PDF links found; configure a specific registry document URL")
    return result


class NGOCrawler(OfficerCrawler):
    def crawl(self, seeds: list[dict[str, str]]) -> list[NGO]:
        records = {}
        self.report = []
        for seed in seeds:
            url = seed.get("url", "")
            found = []
            try:
                content, final_url, content_type = self.fetch_document(url)
                if content.startswith(b"%PDF-") or "application/pdf" in content_type:
                    found = parse_ngo_pdf(content, final_url)
                elif not content_type or "html" in content_type:
                    html = content.decode("utf-8-sig", errors="replace")
                    found = parse_ngos(html, final_url)
                    for document_url in ngo_document_links(html, final_url):
                        document, document_final, _ = self.fetch_document(document_url)
                        if not document.startswith(b"%PDF-"):
                            raise ValueError(f"Expected PDF at {document_final}")
                        extracted = parse_ngo_pdf(document, document_final)
                        if not extracted:
                            raise ValueError(f"No supported NGO tables in {document_final}")
                        found.extend(extracted)
                else:
                    raise ValueError(f"Unsupported registry document type: {content_type}")
                found = merge_ngos(found)
                records = {record.ngo_id: record for record in merge_ngos([*records.values(), *found])}
                self.report.append({"url": url, "status": "ok" if found else "no_records", "records": len(found), "error": ""})
            except (httpx.HTTPError, ValueError, PermissionError, RuntimeError, KeyError, OSError, MalformedPDFException, PdfminerException) as error:
                # Partial extraction must not import an incomplete registry snapshot.
                self.report.append({"url": url, "status": "error", "records": 0, "error": str(error)})
        return list(records.values())


def export_ngos(records: list[NGO], output_dir: str | Path) -> None:
    directory = Path(output_dir)
    directory.mkdir(parents=True, exist_ok=True)
    rows = [{'ngo_id': record.ngo_id, **asdict(record)} for record in records]
    (directory / 'ngos.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
    with (directory / 'ngos.csv').open('w', encoding='utf-8-sig', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=['ngo_id', *NGO.__dataclass_fields__])
        writer.writeheader()
        writer.writerows({key: '; '.join(value) if isinstance(value, list) else value for key, value in row.items()} for row in rows)
