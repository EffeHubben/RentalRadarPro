#!/usr/bin/env python3
"""
RentScout Source Discovery Audit
Discovers and audits Dutch rental housing sources for potential indexing.

Usage:
    python tools/discover_rental_sources.py --target 500 --country nl

Requirements:
    pip install requests
"""

import argparse
import csv
import json
import logging
import random
import re
import sys
import time
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin, urlparse, unquote
from urllib.robotparser import RobotFileParser

try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
except ImportError:
    print("Install requests first:  pip install requests", file=sys.stderr)
    sys.exit(1)

# ── Paths ─────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
DOCS_DIR = ROOT / "docs"
SEED_FILE = DATA_DIR / "source_seed_queries.json"
OUT_CSV = DATA_DIR / "rental_sources_500.csv"
OUT_JSON = DATA_DIR / "rental_sources_500.json"
OUT_REPORT = DOCS_DIR / "source-discovery-report.md"
CACHE_FILE = DATA_DIR / ".discovery_cache.json"

# ── Constants ─────────────────────────────────────────────────────────────────

UA = "RentScoutSourceAudit/1.0 (+https://rentscout.nl/robots)"
REQUEST_TIMEOUT = 12
MAX_DOMAIN_INTERVAL = 1.0      # ≥1 s between requests to same domain
SEARCH_DELAY_MIN = 3.0         # pause between DDG searches
SEARCH_DELAY_MAX = 6.0

RENTAL_PATHS = [
    "/huur", "/huren", "/huurwoningen", "/woningaanbod", "/aanbod",
    "/te-huur", "/woningen", "/beschikbaar", "/woning-huren",
    "/huurappartement", "/huurappartementen", "/vrijsectorhuur",
    "/vrije-sector", "/verhuur", "/verhuurwoningen",
    "/listings", "/properties", "/wonen",
]

RENTAL_KEYWORDS = [
    "huurwoning", "te huur", "verhuur", "huurprijs", "maandelijkse huur",
    "woningaanbod", "huurappartement", "vrijsector", "sociale huur",
    "vrije sector", "huurwoningen", "huurovereenkomst",
]

LOGIN_INDICATORS = [
    "inloggen", "login", "mijn account", "mijn profiel",
    "aanmelden", "sign in", "log in",
]

PAYWALL_INDICATORS = [
    "premium", "abonnement", "betaald", "pro account",
    "subscription", "upgrade", "lidmaatschap", "betaal",
]

GOOD_DOMAINS_SKIP = {
    # TLDs we never want
    ".gov", ".edu", ".gov.nl",
    # Social / generic sites
    "facebook.com", "instagram.com", "twitter.com", "linkedin.com",
    "youtube.com", "wikipedia.org", "reddit.com", "marktplaats.nl",
    "google.com", "google.nl", "bing.com", "duckduckgo.com",
    "nu.nl", "nos.nl", "ad.nl", "telegraaf.nl", "rtlnieuws.nl",
    "volkskrant.nl", "fd.nl", "nrc.nl", "trouw.nl",
}

# ── Data model ────────────────────────────────────────────────────────────────

@dataclass
class SourceRecord:
    name: str = ""
    domain: str = ""
    url: str = ""
    category: str = ""
    matched_city: str = ""
    source_type: str = ""
    homepage_status: str = ""
    robots_txt_status: str = ""
    sitemap_found: bool = False
    rental_keywords_found: str = ""
    requires_login_guess: bool = False
    paywall_guess: bool = False
    scrape_risk: str = ""
    recommended_mode: str = ""
    notes: str = ""


CSV_FIELDS = [f.name for f in SourceRecord.__dataclass_fields__.values()]

# ── Logging ───────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("discover")


# ── HTTP session ──────────────────────────────────────────────────────────────

def make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": UA, "Accept-Language": "nl-NL,nl;q=0.9"})
    retry = Retry(total=2, backoff_factor=0.8, status_forcelist=[429, 500, 502, 503])
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


# ── Rate limiter ──────────────────────────────────────────────────────────────

class RateLimiter:
    """Ensures ≥ MAX_DOMAIN_INTERVAL seconds between requests to the same domain."""

    def __init__(self):
        self._last: dict[str, float] = defaultdict(float)

    def wait(self, domain: str) -> None:
        elapsed = time.monotonic() - self._last[domain]
        gap = MAX_DOMAIN_INTERVAL - elapsed
        if gap > 0:
            time.sleep(gap)
        self._last[domain] = time.monotonic()


# ── DuckDuckGo search ─────────────────────────────────────────────────────────

class DDGSearch:
    """Minimal DuckDuckGo HTML search client — no API key needed."""

    DDG_URL = "https://html.duckduckgo.com/html/"

    def __init__(self, session: requests.Session, limiter: RateLimiter):
        self.session = session
        self.limiter = limiter

    def search(self, query: str, max_results: int = 15) -> list[str]:
        """Return a list of result URLs for *query*."""
        self.limiter.wait("html.duckduckgo.com")
        try:
            resp = self.session.post(
                self.DDG_URL,
                data={"q": query, "kl": "nl-nl", "kp": "-2"},
                timeout=REQUEST_TIMEOUT,
                allow_redirects=True,
            )
            resp.raise_for_status()
        except Exception as exc:
            log.warning("DDG search failed for %r: %s", query, exc)
            return []

        # DDG HTML encodes result URLs as uddg= query params
        raw = re.findall(r"uddg=([^&\"'\s]+)", resp.text)
        urls: list[str] = []
        for encoded in raw:
            try:
                url = unquote(encoded)
                if url.startswith("http"):
                    urls.append(url)
            except Exception:
                pass

        # Also capture plain result__url anchors as fallback
        plain = re.findall(r'class="result__url"[^>]*>([^<]+)<', resp.text)
        for p in plain:
            cleaned = p.strip()
            if not cleaned.startswith("http"):
                cleaned = "https://" + cleaned
            urls.append(cleaned)

        seen: set[str] = set()
        unique: list[str] = []
        for u in urls:
            domain = _extract_domain(u)
            if domain and domain not in seen:
                seen.add(domain)
                unique.append(u)

        delay = random.uniform(SEARCH_DELAY_MIN, SEARCH_DELAY_MAX)
        time.sleep(delay)
        return unique[:max_results]


# ── Domain helpers ────────────────────────────────────────────────────────────

def _extract_domain(url: str) -> Optional[str]:
    try:
        parsed = urlparse(url if "://" in url else "https://" + url)
        host = parsed.hostname or ""
        return host.lower().removeprefix("www.")
    except Exception:
        return None


def _is_skip_domain(domain: str) -> bool:
    if not domain:
        return True
    for bad in GOOD_DOMAINS_SKIP:
        if domain == bad or domain.endswith("." + bad):
            return True
    return False


def _canonical_url(domain: str) -> str:
    return f"https://www.{domain}/"


# ── Domain auditor ────────────────────────────────────────────────────────────

class DomainAuditor:
    """Audits a single domain: homepage, robots.txt, sitemap, rental paths."""

    def __init__(self, session: requests.Session, limiter: RateLimiter):
        self.session = session
        self.limiter = limiter

    def _get(self, url: str, domain: str, stream: bool = False) -> Optional[requests.Response]:
        self.limiter.wait(domain)
        try:
            resp = self.session.get(
                url, timeout=REQUEST_TIMEOUT, allow_redirects=True, stream=stream
            )
            return resp
        except Exception as exc:
            log.debug("GET %s failed: %s", url, exc)
            return None

    def audit_homepage(self, domain: str) -> tuple[str, str, bool, bool]:
        """Returns (status_str, body_excerpt, requires_login_guess, paywall_guess)."""
        url = _canonical_url(domain)
        resp = self._get(url, domain)
        if resp is None:
            # Try http fallback
            resp = self._get(f"http://www.{domain}/", domain)
        if resp is None:
            return "unreachable", "", False, False

        status = str(resp.status_code)
        try:
            body = resp.text[:8000].lower()
        except Exception:
            body = ""

        requires_login = any(kw in body for kw in LOGIN_INDICATORS)
        has_paywall = any(kw in body for kw in PAYWALL_INDICATORS)
        return status, body, requires_login, has_paywall

    def audit_robots(self, domain: str) -> str:
        """Returns one of: allows_all | partial_allow | disallows_rental | disallows_all | no_robots_txt | error"""
        url = f"https://www.{domain}/robots.txt"
        resp = self._get(url, domain)
        if resp is None or resp.status_code == 404:
            return "no_robots_txt"
        if resp.status_code != 200:
            return "error"

        try:
            text = resp.text.lower()
        except Exception:
            return "error"

        # Parse with stdlib
        rp = RobotFileParser()
        rp.set_url(url)
        try:
            rp.read()
        except Exception:
            pass

        # Check if our UA is allowed for rental paths
        rental_blocked = 0
        rental_total = 0
        for path in ["/huur", "/huurwoningen", "/aanbod", "/woningaanbod"]:
            rental_total += 1
            if not rp.can_fetch(UA, f"https://www.{domain}{path}"):
                rental_blocked += 1

        # Check Disallow: /  (blanket block)
        if "disallow: /" in text and "user-agent: *" in text:
            # Verify it's not just a comment
            lines = [l.strip() for l in text.splitlines() if not l.strip().startswith("#")]
            star_section = False
            for line in lines:
                if line == "user-agent: *":
                    star_section = True
                elif line.startswith("user-agent:"):
                    star_section = False
                elif star_section and line == "disallow: /":
                    return "disallows_all"

        if rental_blocked == rental_total and rental_total > 0:
            return "disallows_rental"
        if rental_blocked > 0:
            return "partial_allow"
        return "allows_all"

    def audit_sitemap(self, domain: str) -> bool:
        for path in ["/sitemap.xml", "/sitemap_index.xml", "/sitemap.xml.gz"]:
            url = f"https://www.{domain}{path}"
            resp = self._get(url, domain)
            if resp and resp.status_code == 200 and len(resp.content) > 100:
                return True
        return False

    def audit_rental_paths(self, domain: str) -> list[str]:
        """Return subset of RENTAL_PATHS that return HTTP 200."""
        found: list[str] = []
        for path in RENTAL_PATHS:
            url = f"https://www.{domain}{path}"
            resp = self._get(url, domain)
            if resp and resp.status_code == 200:
                found.append(path)
            if len(found) >= 4:
                break  # enough evidence
        return found

    def full_audit(self, record: SourceRecord) -> SourceRecord:
        domain = record.domain
        log.info("  Auditing %s …", domain)

        # 1. Homepage
        status, body, requires_login, has_paywall = self.audit_homepage(domain)
        record.homepage_status = status
        record.requires_login_guess = requires_login
        record.paywall_guess = has_paywall

        if status == "unreachable":
            record.robots_txt_status = "error"
            record.scrape_risk = "high"
            record.recommended_mode = "do_not_scrape"
            record.notes = "Homepage unreachable"
            return record

        # 2. Robots.txt
        record.robots_txt_status = self.audit_robots(domain)

        # 3. Sitemap
        record.sitemap_found = self.audit_sitemap(domain)

        # 4. Rental paths
        found_paths = self.audit_rental_paths(domain)
        record.rental_keywords_found = ",".join(found_paths)

        # Check page body for rental keywords
        body_hits = [kw for kw in RENTAL_KEYWORDS if kw in body]

        # 5. Derive risk + mode
        record.scrape_risk = _derive_risk(record)
        record.recommended_mode = _derive_mode(record, body_hits)

        return record


# ── Scoring helpers ───────────────────────────────────────────────────────────

def _derive_risk(r: SourceRecord) -> str:
    if r.robots_txt_status == "disallows_all":
        return "high"
    if r.requires_login_guess or r.paywall_guess:
        return "high"
    if r.robots_txt_status == "disallows_rental":
        return "high"
    if r.robots_txt_status == "partial_allow":
        return "medium"
    if r.homepage_status not in ("200", ""):
        return "medium"
    return "low"


def _derive_mode(r: SourceRecord, body_hits: list[str]) -> str:
    if r.scrape_risk == "high":
        return "do_not_scrape"
    has_rental_content = bool(r.rental_keywords_found or body_hits)
    if not has_rental_content and r.source_type not in ("corporatie", "verhuurder", "portal"):
        return "manual_external"
    # Check for potential API (common patterns)
    if r.source_type in ("branche", "belegger", "software", "overheid"):
        return "manual_external"
    if r.scrape_risk == "low" and has_rental_content:
        return "scrape_candidate"
    if r.scrape_risk == "medium":
        return "scrape_candidate"  # worth trying
    return "manual_external"


# ── Cache ─────────────────────────────────────────────────────────────────────

def load_cache() -> dict:
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {}


def save_cache(cache: dict) -> None:
    CACHE_FILE.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8")


# ── Main discoverer ───────────────────────────────────────────────────────────

class SourceDiscoverer:
    def __init__(self, target: int = 500, audit: bool = True,
                 no_search: bool = False, max_queries: int = 0):
        self.target = target
        self.do_audit = audit
        self.no_search = no_search
        self.max_queries = max_queries  # 0 = unlimited
        self.session = make_session()
        self.limiter = RateLimiter()
        self.searcher = DDGSearch(self.session, self.limiter)
        self.auditor = DomainAuditor(self.session, self.limiter)
        self.cache = load_cache()
        self.records: dict[str, SourceRecord] = {}  # domain → record
        self.seed = self._load_seed()

    def _load_seed(self) -> dict:
        if not SEED_FILE.exists():
            log.error("Seed file not found: %s", SEED_FILE)
            sys.exit(1)
        return json.loads(SEED_FILE.read_text(encoding="utf-8"))

    # ── Seeding ───────────────────────────────────────────────────────────────

    def _seed_known_sources(self) -> None:
        log.info("Seeding %d known sources …", len(self.seed["known_sources"]))
        for entry in self.seed["known_sources"]:
            domain = _extract_domain(entry.get("url", "") or entry.get("domain", ""))
            if not domain:
                domain = entry.get("domain", "").lower().removeprefix("www.")
            if not domain or _is_skip_domain(domain):
                continue
            if domain not in self.records:
                self.records[domain] = SourceRecord(
                    name=entry.get("name", ""),
                    domain=domain,
                    url=entry.get("url", _canonical_url(domain)),
                    category=entry.get("category", ""),
                    source_type=entry.get("source_type", ""),
                )

    # ── Search ────────────────────────────────────────────────────────────────

    def _run_searches(self) -> None:
        cities = self.seed.get("cities", [])
        templates = self.seed.get("query_templates", {})
        cat_queries = self.seed.get("category_queries", {})
        municipalities = self.seed.get("municipalities", cities)

        search_pairs: list[tuple[str, str, str]] = []  # (query, city, category)

        # City × template queries
        for city in cities:
            for tmpl_key, tmpl in templates.items():
                query = tmpl.replace("{stad}", city)
                category = _category_from_template(tmpl_key)
                search_pairs.append((query, city, category))

        # Category-specific queries with cities / municipalities
        for cat, tmpl_list in cat_queries.items():
            for tmpl in tmpl_list:
                if "{stad}" in tmpl or "{gemeente}" in tmpl:
                    for city in cities[:20]:  # first 20 cities for cat queries
                        q = tmpl.replace("{stad}", city).replace("{gemeente}", city)
                        search_pairs.append((q, city, cat))
                else:
                    search_pairs.append((tmpl, "", cat))

        random.shuffle(search_pairs)
        limit = self.max_queries if self.max_queries > 0 else len(search_pairs)
        search_pairs = search_pairs[:limit]
        log.info("Running %d search queries …", len(search_pairs))

        for i, (query, city, category) in enumerate(search_pairs, 1):
            current = len(self.records)
            if current >= self.target * 1.3:  # 30% buffer above target
                log.info("Reached discovery buffer (%d domains), stopping search.", current)
                break

            log.info("[%d/%d] Searching: %r (have %d domains)", i, len(search_pairs), query, current)
            cache_key = f"search:{query}"
            if cache_key in self.cache:
                urls = self.cache[cache_key]
            else:
                urls = self.searcher.search(query, max_results=12)
                self.cache[cache_key] = urls
                save_cache(self.cache)

            for url in urls:
                domain = _extract_domain(url)
                if not domain or _is_skip_domain(domain) or domain in self.records:
                    continue
                # Derive a rough name from domain
                name = _name_from_domain(domain)
                self.records[domain] = SourceRecord(
                    name=name,
                    domain=domain,
                    url=url,
                    category=category,
                    matched_city=city,
                    source_type=_guess_source_type(domain, category),
                )

    # ── Auditing ──────────────────────────────────────────────────────────────

    def _audit_all(self) -> None:
        to_audit = [
            r for r in self.records.values() if not r.homepage_status
        ]
        log.info("Auditing %d domains …", len(to_audit))
        for i, record in enumerate(to_audit, 1):
            log.info("[%d/%d] %s", i, len(to_audit), record.domain)
            cache_key = f"audit:{record.domain}"
            if cache_key in self.cache:
                cached = self.cache[cache_key]
                record.homepage_status = cached.get("homepage_status", "")
                record.robots_txt_status = cached.get("robots_txt_status", "")
                record.sitemap_found = cached.get("sitemap_found", False)
                record.rental_keywords_found = cached.get("rental_keywords_found", "")
                record.requires_login_guess = cached.get("requires_login_guess", False)
                record.paywall_guess = cached.get("paywall_guess", False)
                record.scrape_risk = cached.get("scrape_risk", "")
                record.recommended_mode = cached.get("recommended_mode", "")
                record.notes = cached.get("notes", "")
            else:
                record = self.auditor.full_audit(record)
                self.records[record.domain] = record
                self.cache[cache_key] = {
                    k: v for k, v in asdict(record).items()
                    if k not in ("name", "domain", "url", "category", "matched_city", "source_type")
                }
                save_cache(self.cache)

    def _apply_heuristic_defaults(self) -> None:
        """Assign risk + mode without HTTP auditing, based on source_type/category."""
        no_scrape_types = {"branche", "belegger", "overheid", "software", "association"}
        scrape_types = {"portal", "corporatie", "verhuurder", "makelaar", "beheerder", "aggregator"}
        for r in self.records.values():
            if r.homepage_status:
                continue  # already audited (from cache)
            r.homepage_status = "not_checked"
            r.robots_txt_status = "not_checked"
            if r.source_type in no_scrape_types:
                r.scrape_risk = "medium"
                r.recommended_mode = "manual_external"
            elif r.source_type in scrape_types:
                r.scrape_risk = "medium"
                r.recommended_mode = "scrape_candidate"
            else:
                r.scrape_risk = "medium"
                r.recommended_mode = "scrape_candidate"

    # ── Output ────────────────────────────────────────────────────────────────

    def _write_csv(self, records: list[SourceRecord]) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with OUT_CSV.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
            writer.writeheader()
            for r in records:
                writer.writerow(asdict(r))
        log.info("CSV written: %s (%d rows)", OUT_CSV, len(records))

    def _write_json(self, records: list[SourceRecord]) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        OUT_JSON.write_text(
            json.dumps([asdict(r) for r in records], indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        log.info("JSON written: %s (%d entries)", OUT_JSON, len(records))

    def _write_report(self, records: list[SourceRecord]) -> None:
        DOCS_DIR.mkdir(parents=True, exist_ok=True)

        total = len(records)
        scrape_candidates = [r for r in records if r.recommended_mode == "scrape_candidate"]
        manual_external = [r for r in records if r.recommended_mode == "manual_external"]
        do_not_scrape = [r for r in records if r.recommended_mode == "do_not_scrape"]
        api_candidates = [r for r in records if r.recommended_mode == "api_candidate"]

        by_cat: dict[str, list[SourceRecord]] = defaultdict(list)
        for r in records:
            by_cat[r.category or "overig"].append(r)

        # Risk counts
        low_risk = [r for r in records if r.scrape_risk == "low"]
        med_risk = [r for r in records if r.scrape_risk == "medium"]
        high_risk = [r for r in records if r.scrape_risk == "high"]

        # Top 100 candidates: low risk + scrape_candidate, sorted by rental content
        top100 = sorted(
            [r for r in records if r.recommended_mode == "scrape_candidate"],
            key=lambda r: (
                -(len(r.rental_keywords_found.split(",")) if r.rental_keywords_found else 0),
                r.scrape_risk != "low",
                r.domain,
            ),
        )[:100]

        # Top 25 high-volume: prefer portals + corporaties with rental content
        high_vol = sorted(
            [r for r in records if r.source_type in ("portal", "corporatie", "aggregator", "verhuurder")
             and r.recommended_mode != "do_not_scrape"],
            key=lambda r: (
                -(len(r.rental_keywords_found.split(",")) if r.rental_keywords_found else 0),
                r.scrape_risk != "low",
            ),
        )[:25]

        # Risky sources
        risky = [r for r in records if r.scrape_risk == "high" or r.recommended_mode == "do_not_scrape"]

        lines: list[str] = []
        lines.append("# RentScout Source Discovery Report")
        lines.append("")
        lines.append(f"Generated: {time.strftime('%Y-%m-%d %H:%M')}")
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append("## Samenvatting")
        lines.append("")
        lines.append(f"| Statistiek | Waarde |")
        lines.append(f"|---|---|")
        lines.append(f"| Gevonden domeinen | **{total}** |")
        lines.append(f"| Scrape-kandidaten | **{len(scrape_candidates)}** |")
        lines.append(f"| API-kandidaten | **{len(api_candidates)}** |")
        lines.append(f"| Manual external | **{len(manual_external)}** |")
        lines.append(f"| Do not scrape | **{len(do_not_scrape)}** |")
        lines.append(f"| Laag risico | {len(low_risk)} |")
        lines.append(f"| Middel risico | {len(med_risk)} |")
        lines.append(f"| Hoog risico | {len(high_risk)} |")
        lines.append("")

        lines.append("## Bronnen per categorie")
        lines.append("")
        lines.append("| Categorie | Aantal |")
        lines.append("|---|---|")
        for cat, recs in sorted(by_cat.items(), key=lambda x: -len(x[1])):
            lines.append(f"| {cat} | {len(recs)} |")
        lines.append("")

        lines.append("## Top 100 scrape-kandidaten")
        lines.append("")
        lines.append("*Gesorteerd op: meeste gevonden huurpaden → laagste risico*")
        lines.append("")
        lines.append("| # | Naam | Domein | Categorie | Risico | Robots | Sitemap | Huurpaden |")
        lines.append("|---|---|---|---|---|---|---|---|")
        for i, r in enumerate(top100, 1):
            paths = len(r.rental_keywords_found.split(",")) if r.rental_keywords_found else 0
            lines.append(
                f"| {i} | {r.name or r.domain} | `{r.domain}` | {r.category} "
                f"| {r.scrape_risk} | {r.robots_txt_status} "
                f"| {'✓' if r.sitemap_found else '✗'} | {paths} paden |"
            )
        lines.append("")

        lines.append("## Top 25 bronnen met waarschijnlijk veel aanbod")
        lines.append("")
        lines.append("| # | Naam | Domein | Type | Categorie | Aanbevelng |")
        lines.append("|---|---|---|---|---|---|")
        for i, r in enumerate(high_vol, 1):
            lines.append(
                f"| {i} | {r.name or r.domain} | `{r.domain}` | {r.source_type} "
                f"| {r.category} | {r.recommended_mode} |"
            )
        lines.append("")

        lines.append("## Juridisch / technisch risicovolle bronnen")
        lines.append("")
        lines.append(
            "De onderstaande bronnen blokkeren scrapers expliciet via robots.txt, "
            "vereisen een login, of waren niet bereikbaar. Niet aanbevolen voor automatische indexering."
        )
        lines.append("")
        lines.append("| Domein | Risico | Robots | Login | Paywall | Reden |")
        lines.append("|---|---|---|---|---|---|")
        for r in sorted(risky, key=lambda r: r.domain)[:60]:
            login = "ja" if r.requires_login_guess else "nee"
            paywall = "ja" if r.paywall_guess else "nee"
            lines.append(
                f"| `{r.domain}` | {r.scrape_risk} | {r.robots_txt_status} "
                f"| {login} | {paywall} | {r.notes or '-'} |"
            )
        lines.append("")

        lines.append("## Alle gevonden bronnen (volledig overzicht)")
        lines.append("")
        lines.append(
            f"Zie [`data/rental_sources_500.csv`](../data/rental_sources_500.csv) "
            f"en [`data/rental_sources_500.json`](../data/rental_sources_500.json) "
            f"voor het volledige gestructureerde overzicht."
        )
        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append(
            "*Dit rapport is alleen een audit en candidate registry. "
            "Er zijn geen automatische scrapers toegevoegd. "
            "Gebruik de kandidatenlijst als input voor handmatige beoordeling "
            "en eventuele integratie in de RentScout bronregistratie.*"
        )

        OUT_REPORT.write_text("\n".join(lines), encoding="utf-8")
        log.info("Report written: %s", OUT_REPORT)

    # ── Run ───────────────────────────────────────────────────────────────────

    def run(self) -> None:
        log.info("=== RentScout Source Discovery Audit ===")
        log.info("Target: %d domains", self.target)

        # Step 1: Seed from known sources
        self._seed_known_sources()
        log.info("After seeding: %d unique domains", len(self.records))

        # Step 2: Discover via search (skipped when --no-search)
        if not self.no_search and len(self.records) < self.target:
            self._run_searches()
        log.info("After search discovery: %d unique domains", len(self.records))

        # Step 3: Audit all domains (or apply heuristic defaults if skipped)
        if self.do_audit:
            self._audit_all()
        else:
            self._apply_heuristic_defaults()

        # Step 4: Sort and write output
        records = sorted(self.records.values(), key=lambda r: (
            r.recommended_mode == "do_not_scrape",
            r.scrape_risk != "low",
            r.domain,
        ))

        self._write_csv(records)
        self._write_json(records)
        self._write_report(records)

        # Final summary
        scrape = sum(1 for r in records if r.recommended_mode == "scrape_candidate")
        manual = sum(1 for r in records if r.recommended_mode == "manual_external")
        skip = sum(1 for r in records if r.recommended_mode == "do_not_scrape")
        print("\n" + "=" * 60)
        print(f"  Total unique domains : {len(records)}")
        print(f"  Scrape candidates    : {scrape}")
        print(f"  Manual / external    : {manual}")
        print(f"  Do not scrape        : {skip}")
        print(f"\n  Output files:")
        print(f"    {OUT_CSV}")
        print(f"    {OUT_JSON}")
        print(f"    {OUT_REPORT}")
        print("=" * 60)


# ── Utility ───────────────────────────────────────────────────────────────────

def _category_from_template(tmpl_key: str) -> str:
    mapping = {
        "huurwoningen_stad": "verhuurmakelaars",
        "woning_huren_stad": "verhuurmakelaars",
        "verhuurmakelaar_stad": "verhuurmakelaars",
        "woningaanbod_huur_stad": "landelijke_platforms",
        "te_huur_appartement_stad": "landelijke_platforms",
        "vrije_sector_stad": "institutionele_verhuurders",
        "nieuwbouw_huur_stad": "nieuwbouw_huurprojecten",
        "vastgoedbeheer_stad": "vastgoedbeheerders",
        "kamerverhuur_stad": "studenten_kamers",
    }
    return mapping.get(tmpl_key, "overig")


def _guess_source_type(domain: str, category: str) -> str:
    cat_map = {
        "woningcorporaties": "corporatie",
        "institutionele_verhuurders": "verhuurder",
        "vastgoedbeheerders": "beheerder",
        "studenten_kamers": "portal",
        "landelijke_platforms": "portal",
        "verhuurmakelaars": "makelaar",
        "nieuwbouw_huurprojecten": "portal",
        "sociale_huur": "portal",
    }
    return cat_map.get(category, "overig")


def _name_from_domain(domain: str) -> str:
    """Best-effort human name from domain."""
    name = domain.split(".")[0]
    # Convert hyphens and capitalize
    parts = name.replace("-", " ").split()
    return " ".join(p.capitalize() for p in parts)


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="RentScout Source Discovery Audit — finds Dutch rental housing sources"
    )
    parser.add_argument(
        "--target", type=int, default=500,
        help="Minimum number of unique domains to discover (default: 500)"
    )
    parser.add_argument(
        "--country", type=str, default="nl",
        help="Country code (default: nl)"
    )
    parser.add_argument(
        "--no-audit", action="store_true",
        help="Skip HTTP auditing (just collect domain names)"
    )
    parser.add_argument(
        "--no-search", action="store_true",
        help="Skip DuckDuckGo searches; use only pre-seeded sources"
    )
    parser.add_argument(
        "--max-queries", type=int, default=0, metavar="N",
        help="Limit DuckDuckGo searches to N queries (0 = unlimited)"
    )
    parser.add_argument(
        "--clear-cache", action="store_true",
        help="Clear the discovery cache and start fresh"
    )
    parser.add_argument(
        "--verbose", action="store_true",
        help="Enable debug logging"
    )
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    if args.country != "nl":
        log.warning("Only 'nl' is currently supported. Continuing with nl.")

    if args.clear_cache and CACHE_FILE.exists():
        CACHE_FILE.unlink()
        log.info("Cache cleared.")

    discoverer = SourceDiscoverer(
        target=args.target,
        audit=not args.no_audit,
        no_search=args.no_search,
        max_queries=args.max_queries,
    )
    discoverer.run()


if __name__ == "__main__":
    main()
