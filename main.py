import asyncio
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List
from urllib.parse import urlparse, parse_qs

from playwright.async_api import async_playwright

import os

def save_product_json(data):
    os.makedirs("products", exist_ok=True)

    # sanitize filename
    safe_name = (
        data["title"]
        .replace("/", "-")
        .replace("\\", "-")
        .replace(":", "-")
    )

    path = f"products/{safe_name}.json"

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

    print(f"Saved → {path}")

    # regenerate list file
    regenerate_products_list()

def regenerate_products_list():
    products_folder = "products"
    output_file = "products_list.json"

    files = [
        f for f in os.listdir(products_folder)
        if f.endswith(".json")
    ]

    files.sort()

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(files, f, indent=4, ensure_ascii=False)

    print(f"Updated {output_file} (found {len(files)} products)")


def extract_price(raw: str | None) -> float | None:
    """
    Acbuy price HTML looks like:
      <p class="g-price">CNY ¥12 ≈ USD $1.89</p>

    We want the LAST number (USD).
    """
    if not raw:
        return None
    cleaned = raw.replace(",", "")
    matches = re.findall(r"([0-9]+(?:\.[0-9]+)?)", cleaned)
    if not matches:
        return None
    try:
        return float(matches[-1])  # last numeric = USD
    except ValueError:
        return None


def compute_final_price(listed_price: float | None) -> float | None:
    """
    Your formula: ([listed_price] * 2) * 5
    Round to 2 decimals.
    """
    if listed_price is None:
        return None
    final = (listed_price * 2 + 2) * 5
    return round(final, 2)


def get_product_id_from_url(url: str) -> str | None:
    """
    Acbuy URLs look like:
      https://www.acbuy.com/product?id=854799166380&source=AL
    Grab that id as a fallback for filenames.
    """
    parsed = urlparse(url)
    qs = parse_qs(parsed.query)
    ids = qs.get("id")
    if ids:
        return ids[0]
    return None


def slugify_filename(title: str | None, url: str) -> str:
    """
    Turn a product title into a safe filename.
    Fallback to product id if title is missing.
    """
    base = (title or "").strip().lower()
    if not base:
        base = get_product_id_from_url(url) or "product"

    # replace whitespace with dashes
    base = re.sub(r"\s+", "-", base)
    # keep only a-z, 0-9, dash
    base = re.sub(r"[^a-z0-9\-]", "", base)

    # trim length to something reasonable
    if len(base) > 80:
        base = base[:80]

    if not base:
        base = "product"

    return base


async def get_page(url: str):
    """
    Launch Chromium with a real-ish user agent so Acbuy behaves.
    """
    p = await async_playwright().start()
    browser = await p.chromium.launch(headless=True)
    context = await browser.new_context(
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    )
    page = await context.new_page()
    await page.goto(url, wait_until="networkidle")
    return p, browser, context, page


async def scrape_product(url: str) -> Dict[str, Any]:
    p, browser, context, page = await get_page(url)
    try:
        # ===== title (.g-name) =====
        title_el = await page.query_selector(".g-name")
        title = (await title_el.text_content()).strip() if title_el else None

        # ===== base price (.g-price) =====
        price_el = await page.query_selector(".g-price")
        raw_price = (await price_el.text_content()).strip() if price_el else None
        base_listed_price = extract_price(raw_price)
        base_final_price = compute_final_price(base_listed_price)

        # helper to grab images
        async def get_images(
            selectors: List[str],
            filter_domain: str | None = None,
        ) -> List[str]:
            urls: set[str] = set()
            for sel in selectors:
                els = await page.query_selector_all(sel)
                for el in els:
                    src = await el.get_attribute("src")
                    if not src:
                        continue
                    src = src.strip()
                    if not src.startswith("http"):
                        continue
                    if filter_domain and filter_domain not in src:
                        continue
                    urls.add(src)
            return list(urls)

        # initial product images/QC, before clicking variants
        product_images_overall = await get_images(
            [".goods-image .small img", ".goods-image .middle img"],
            filter_domain="cbu01.alicdn.com",
        )
        qc_images = await get_images(
            [".qc-img .small img"],
            filter_domain="oss.acbuy.com",
        )

        # cover image: main middle img or first product image
        cover_image = None
        mid_img = await page.query_selector(".goods-image .middle img")
        if mid_img:
            src = await mid_img.get_attribute("src")
            if src and src.startswith("http"):
                cover_image = src.strip()
        if not cover_image and product_images_overall:
            cover_image = product_images_overall[0]

        # ===== sizes (if any) =====
        sizes: List[str] = []
        type_lists = await page.query_selector_all(".goods-sku .type-list")
        for tl in type_lists:
            title_el2 = await tl.query_selector(".title")
            title_text = (await title_el2.text_content()).strip().lower() if title_el2 else ""
            if "size" in title_text:
                size_els = await tl.query_selector_all(".type-item.size-item")
                for s_el in size_els:
                    txt = await s_el.text_content()
                    if txt:
                        val = txt.strip()
                        if val and val not in sizes:
                            sizes.append(val)
                break  # found size block, no need to keep looping

        # ===== colors: each <div class="type-item size-item-img"> with tooltip text =====
        color_selector = ".type-list .type-item.size-item-img:not(.disabled)"
        color_els = await page.query_selector_all(color_selector)
        colors: List[Dict[str, Any]] = []

        if not color_els:
            # no color options – just one "default" variant using base price
            colors.append(
                {
                    "name": "default",
                    "images": product_images_overall,
                    "sizes": sizes,  # attach sizes here
                    "listed_price": base_listed_price,
                    "final_price": base_final_price,
                }
            )
        else:
            for idx, el in enumerate(color_els):
                # click color to update MAIN IMAGE + PRICE
                try:
                    await el.click()
                    await page.wait_for_timeout(800)
                except Exception:
                    pass

                # tooltip name in .imgPopper; fallback to inner text
                tooltip = await el.query_selector(".imgPopper")
                name_text = None
                if tooltip:
                    tt = await tooltip.text_content()
                    if tt:
                        name_text = tt.strip()
                if not name_text:
                    tt = await el.text_content()
                    if tt:
                        name_text = tt.strip()
                if not name_text:
                    name_text = f"color_{idx + 1}"

                # variant price after clicking this color
                v_price_el = await page.query_selector(".g-price")
                v_raw_price = (await v_price_el.text_content()).strip() if v_price_el else None
                v_listed_price = extract_price(v_raw_price)
                if v_listed_price is None:
                    v_listed_price = base_listed_price
                v_final_price = compute_final_price(v_listed_price)

                # variant-specific main image: .goods-image .middle img AFTER click
                variant_imgs: List[str] = []
                main_img_el = await page.query_selector(".goods-image .middle img")
                if main_img_el:
                    src = await main_img_el.get_attribute("src")
                    if src and src.startswith("http"):
                        src = src.strip()
                        variant_imgs.append(src)
                        # also add to global gallery if not already there
                        if src not in product_images_overall:
                            product_images_overall.append(src)
                else:
                    # fallback: use the thumb image in the color selector
                    img_el = await el.query_selector("img")
                    if img_el:
                        src = await img_el.get_attribute("src")
                        if src and src.startswith("http"):
                            src = src.strip()
                            variant_imgs.append(src)
                            if src not in product_images_overall:
                                product_images_overall.append(src)

                colors.append(
                    {
                        "name": name_text,
                        "images": variant_imgs,
                        "sizes": sizes,  # same size options for all colors
                        "listed_price": v_listed_price,
                        "final_price": v_final_price,
                    }
                )

        # pick top-level price as the cheapest variant (for "from X RON")
        all_variant_listed = [c["listed_price"] for c in colors if c.get("listed_price") is not None]
        if all_variant_listed:
            listed_price = min(all_variant_listed)
            final_price = compute_final_price(listed_price)
        else:
            listed_price = base_listed_price
            final_price = base_final_price

        product_data: Dict[str, Any] = {
            "url": url,
            "title": title,
            "listed_price": listed_price,   # min variant USD
            "final_price": final_price,     # formula applied to that
            "cover_image": cover_image,
            "product_images": product_images_overall,
            "qc_images": qc_images,
            "sizes": sizes,                 # top-level sizes as well
            "colors": colors,               # each color has its own prices + main image + sizes
        }
        return product_data
    finally:
        await context.close()
        await browser.close()
        await p.stop()


async def main():
    if len(sys.argv) < 2:
        print("Usage: python acbuy_ac_scraper.py <url1> [url2 url3 ...]")
        sys.exit(1)

    urls = sys.argv[1:]
    products_dir = Path("products")
    products_dir.mkdir(exist_ok=True)

    results: List[Dict[str, Any]] = []

    for url in urls:
        print(f"Scraping: {url}", file=sys.stderr)
        data = await scrape_product(url)
        results.append(data)

        slug = slugify_filename(data.get("title"), url)
        filename = products_dir / f"{slug}.json"

        # Avoid overwriting by adding a numeric suffix if needed
        counter = 1
        while filename.exists():
            filename = products_dir / f"{slug}-{counter}.json"
            counter += 1

        with open(filename, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"Saved -> {filename}", file=sys.stderr)

    # Still print JSON to stdout if you want to pipe or debug
    if len(results) == 1:
        print(json.dumps(results[0], ensure_ascii=False, indent=2))
    else:
        print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
