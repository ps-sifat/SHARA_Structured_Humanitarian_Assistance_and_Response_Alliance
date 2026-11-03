import argparse
import json
from pathlib import Path

from .core import OfficerCrawler, export_records, load_seeds
from .ngos import NGOCrawler, export_ngos


def main():
    parser = argparse.ArgumentParser(description="Collect public government officer or NGOAB listings")
    parser.add_argument('--kind', choices=['officer', 'ngo'], default='officer')
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--url", help="One officer listing URL")
    source.add_argument("--seeds", type=Path, help="CSV with url and optional location columns")
    parser.add_argument("--output", type=Path, default=Path("output"))
    parser.add_argument("--limit", type=int, help="Maximum number of seed pages")
    parser.add_argument("--delay", type=float, default=1.5)
    parser.add_argument("--user-agent", default="BDPublicOfficerCrawler/1.0")
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be positive")
    seeds = [{"url": args.url}] if args.url else load_seeds(args.seeds)
    crawler_class = NGOCrawler if args.kind == 'ngo' else OfficerCrawler
    with crawler_class(delay=args.delay, user_agent=args.user_agent) as crawler:
        records = crawler.crawl(seeds[:args.limit])
        (export_ngos if args.kind == 'ngo' else export_records)(records, args.output)
        (args.output / "crawl_report.json").write_text(
            json.dumps(crawler.report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Saved {len(records)} {args.kind} records to {args.output.resolve()}")
    print(f"Page errors: {sum(r['status'] == 'error' for r in crawler.report)}. See crawl_report.json.")
    return 0 if records else 1


if __name__ == "__main__":
    raise SystemExit(main())
