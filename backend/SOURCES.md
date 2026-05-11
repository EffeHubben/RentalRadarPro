# RentScout Sources Documentation

This document describes the rental listing sources integrated into RentScout, including extraction details, compliance behavior, and maintenance instructions.

## Phase 1 Sources (Added/Upgraded)

The following sources were added or upgraded with specialized parsers to ensure high data quality.

| Source | Key | Type | Category | Extraction |
| :--- | :--- | :--- | :--- | :--- |
| **123Wonen** | `123wonen` | Generic HTML (Custom Parser) | Marketplace | Search Results Page |
| **NederWoon** | `nederwoon` | Generic HTML (Custom Parser) | Landlord | Search Results Page |
| **Rotsvast** | `rotsvast` | Generic HTML (Custom Parser) | Marketplace | Search Results Page |
| **HouseHunting** | `househunting` | Generic HTML (Custom Parser) | Marketplace | Search Results Page |
| **Vesteda** | `vesteda` | Generic HTML (Custom Parser) | Landlord | Search Results Page |
| **Huurwoningen.nl** | `huurwoningen` | Generic HTML (Custom Parser) | Marketplace | Search Results Page |
| **Direct Wonen** | `directwonen` | Generic HTML (Custom Parser) | Marketplace | Search Results Page |
| **Huurportaal** | `huurportaal` | Generic HTML (Custom Parser) | Aggregator | Search Results Page |
| **Huurwoningportaal** | `huurwoningportaal` | Generic HTML (Custom Parser) | Aggregator | Search Results Page |
| **Pandomo** | `pandomo` | Generic HTML (Custom Parser) | Marketplace | Search Results Page |
| **Friendly Housing** | `friendly_housing` | Generic HTML (Custom Parser) | Landlord | Search Results Page |
| **Acasa** | `acasa` | Generic HTML (Custom Parser) | Marketplace | Search Results Page |
| **Rent Company** | `rentcompany` | Generic HTML (Custom Parser) | Marketplace | Search Results Page |
| **Domica** | `domica` | Generic HTML (Custom Parser) | Marketplace | Search Results Page |
| **Pararius** | `pararius` | Generic HTML (Facts-Only Parser) | Marketplace | Search Results Page |
| **Kamernet** | `kamernet` | Generic HTML (Facts-Only Parser) | Marketplace | Search Results Page |
| **Interhouse** | `interhouse` | Generic HTML (Custom Parser) | Marketplace | Search Results Page |
| **Huislijn** | `huislijn` | Generic HTML (Custom Parser) | Aggregator | Search Results Page |
| **Heimstaden** | `heimstaden` | Generic HTML (Refined Parser) | Landlord | Search Results Page |
| **LIV Residential** | `liv_residential` | Generic HTML (Custom Parser) | Landlord | Search Results Page |
| **BW Housing** | `bwhousing` | Generic HTML (Custom Parser) | Marketplace | Search Results Page |
| **TVN Real Estate** | `tvn_real_estate` | Generic HTML (Custom Parser) | Marketplace | Search Results Page |
| **Maxx Aanhuur** | `maxx_aanhuur` | Generic HTML (Custom Parser) | Marketplace | Search Results Page |
| **VBT Verhuurmakelaars** | `vbt_verhuurmakelaars` | Generic HTML (Custom Parser) | Marketplace | Search Results Page |
| **Maxx Aanhuur** | `maxx_aanhuur` | Generic HTML (Custom Parser) | Marketplace | Search Results Page |
| **Friendly Housing** | `friendly_housing` | Generic HTML (Custom Parser) | Landlord | Search Results Page |
| **Ymere (huur)** | `ymere_huur` | Generic HTML (Custom Parser) | Housing Corporation | Search Results Page |
| **DUWO** | `duwo` | Generic HTML (Custom Parser) | Housing Corporation | Search Results Page |
| **Xior Student Housing** | `xior` | Generic HTML (Custom Parser) | Landlord | Search Results Page |
| **SSH XL** | `sshxl` | Generic HTML (Custom Parser) | Housing Corporation | Search Results Page |

### Extracted Fields
For all Phase 1 sources, the following factual fields are extracted when publicly visible:
- `title` (Address or descriptive title)
- `url` (Direct link to the original listing)
- `price` (Monthly rent in Euro)
- `city`
- `area_m2` (Living area in square meters)
- `rooms` / `bedrooms`
- `image_url` (Link to the primary listing photo)
- `description` (Brief public summary)
- `availability_status` (Available, Reserved, Rented, etc.)
- `street_name` / `house_number` (Extracted from address/title)
- `source_site` / `source_url`

### Intentional Omissions (Compliance)
To remain a factual aggregator and respect source websites, the following are **NOT** scraped:
- Content behind logins or paywalls.
- Captcha-protected data.
- Private contact details (phone numbers, email addresses).
- Full copyrighted descriptions (only brief summaries are stored).
- Multiple images or rehosted assets (only original links are used).
- Floorplans, videos, or premium-only data.

### Rate Limits & Respectful Scraping
- **Conservative Intervals:** Scanners run with a default interval of 20-30 minutes per city per source.
- **Max Concurrency:** Per-domain concurrency is limited to 1.
- **Browser Fetching:** Uses Playwright with respectful pauses (`3.5s`) between page loads to avoid hammering servers.
- **Bot Protection:** Respects `403 Forbidden` and `429 Too Many Requests`. Sources that show bot protection are automatically backed off or marked as degraded.

## How to Run

### Run Scanner Locally
To run a scan for a specific city and source:
```bash
cd backend
python -m app.services.scanner --city Breda --source 123wonen
```

### Run Tests
To run parser tests (if available):
```bash
cd backend
pytest tests/test_scraper_data_quality.py
```

## Maintenance
If a source stops returning results:
1. Check if the site structure has changed.
2. Update the specialized parser in `backend/app/scrapers/generic_sources.py`.
3. Verify the `search_url_template` in `backend/app/sources/registry.py`.
