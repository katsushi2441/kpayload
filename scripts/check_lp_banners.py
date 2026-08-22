#!/usr/bin/env python3
"""Verify that every self-owned OSS LP renders both shared promotion banners."""

import json
from pathlib import Path

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "oss-catalog.json"
OUTPUTS = ROOT / "outputs"


def main() -> None:
    items = json.loads(CATALOG.read_text(encoding="utf-8"))
    targets = [
        item
        for item in items
        if "github.com/katsushi2441/" in (item.get("githubUrl") or "")
    ]
    failures = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1366, "height": 768})

        for item in targets:
            slug = item["slug"]
            url = item.get("lpUrl") or item["officialUrl"]
            response = page.goto(url, wait_until="domcontentloaded", timeout=30_000)
            try:
                page.wait_for_selector(".xb-oss-promos", timeout=10_000)
            except Exception:
                failures.append(f"{slug}: banner container did not render")
                continue

            catalog_links = page.locator('.xb-oss-promos a[href*="/oss/"]')
            service_links = page.locator('.xb-oss-promos a[href*="/vibe-oss.html"]')
            visible = page.locator(".xb-oss-promo:visible").count()
            status = response.status if response else 0
            if status != 200 or catalog_links.count() != 1 or service_links.count() != 1 or visible != 2:
                failures.append(
                    f"{slug}: HTTP={status}, catalog={catalog_links.count()}, "
                    f"service={service_links.count()}, visible={visible}"
                )
                continue
            print(f"{slug:20} HTTP=200 banners=2")

        OUTPUTS.mkdir(exist_ok=True)
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto("https://kfreqai.exbridge.jp/kfreqai.html", wait_until="domcontentloaded")
        page.wait_for_selector(".xb-oss-promos")
        metrics = page.locator(".xb-oss-promos").evaluate(
            "el => ({right: el.getBoundingClientRect().right, width: el.getBoundingClientRect().width, columns: getComputedStyle(el).gridTemplateColumns})"
        )
        if metrics["right"] > 390 or " " in metrics["columns"].strip():
            failures.append(f"mobile: invalid banner geometry {metrics}")
        page.screenshot(path=str(OUTPUTS / "oss-banners-mobile.png"), full_page=False)

        browser.close()

    if failures:
        raise SystemExit("\n".join(failures))
    print(f"Verified {len(targets)} self-owned OSS landing pages.")


if __name__ == "__main__":
    main()
