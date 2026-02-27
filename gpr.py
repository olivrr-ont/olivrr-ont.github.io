import os
import json

PRODUCTS_FOLDER = "products"
OUTPUT_FILE = "products_list.json"

def main():
    files = []

    # scan /products/ folder
    for filename in os.listdir(PRODUCTS_FOLDER):
        if filename.endswith(".json"):
            files.append(filename)

    # sort alphabetically for consistency
    files.sort()

    # write output file
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(files, f, indent=4, ensure_ascii=False)

    print(f"Generated {OUTPUT_FILE} with {len(files)} entries.")
    for f in files:
        print(" -", f)

if __name__ == "__main__":
    main()
