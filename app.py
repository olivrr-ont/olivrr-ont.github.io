from flask import Flask, request, jsonify, send_from_directory
import subprocess
import json
import os
import sys
import threading
from pathlib import Path

app = Flask(__name__)

# Configuration
PRODUCTS_FOLDER = "products"
ALLOWED_DOMAINS = ["acbuy.com", "www.acbuy.com"]

def run_scraper(url):
    """Run the scraper as a subprocess"""
    try:
        # Call the existing main.py with the URL
        result = subprocess.run(
            [sys.executable, "main.py", url],
            capture_output=True,
            text=True,
            timeout=60  # 60 second timeout
        )
        
        if result.returncode == 0:
            return {"success": True, "output": result.stdout}
        else:
            return {"success": False, "error": result.stderr}
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Scraping timed out after 60 seconds"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/api/scrape', methods=['POST'])
def scrape_product():
    """API endpoint to scrape a product"""
    data = request.json
    url = data.get('url', '').strip()
    
    # Validate URL
    if not url:
        return jsonify({"success": False, "error": "No URL provided"})
    
    # Check if it's an AcBuy URL
    if not any(domain in url for domain in ALLOWED_DOMAINS):
        return jsonify({"success": False, "error": "Only AcBuy URLs are supported"})
    
    # Run scraper in background thread to avoid blocking
    def scrape_in_thread():
        result = run_scraper(url)
        print(f"Scraping result: {result}")
    
    thread = threading.Thread(target=scrape_in_thread)
    thread.start()
    
    return jsonify({
        "success": True, 
        "message": "Scraping started. Product will be added shortly."
    })

@app.route('/api/delete', methods=['POST'])
def delete_product():
    """Delete a product file"""
    data = request.json
    filename = data.get('file', '')
    
    if not filename:
        return jsonify({"success": False, "error": "No filename provided"})
    
    # Security check: only allow .json files in products folder
    if not filename.endswith('.json') or '..' in filename or '/' in filename:
        return jsonify({"success": False, "error": "Invalid filename"})
    
    filepath = os.path.join(PRODUCTS_FOLDER, filename)
    
    if os.path.exists(filepath):
        os.remove(filepath)
        
        # Regenerate products list
        regenerate_products_list()
        
        return jsonify({"success": True, "message": "Product deleted"})
    else:
        return jsonify({"success": False, "error": "File not found"})

@app.route('/api/regenerate', methods=['GET'])
def regenerate():
    """Regenerate the products list"""
    try:
        # Run the existing gpr.py script
        result = subprocess.run(
            [sys.executable, "gpr.py"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            return jsonify({"success": True, "message": "Product list regenerated"})
        else:
            return jsonify({"success": False, "error": result.stderr})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

def regenerate_products_list():
    """Helper function to regenerate products list"""
    files = [f for f in os.listdir(PRODUCTS_FOLDER) if f.endswith('.json')]
    files.sort()
    
    with open("products_list.json", "w", encoding="utf-8") as f:
        json.dump(files, f, indent=4, ensure_ascii=False)
    
    return len(files)

if __name__ == '__main__':
    # Ensure products folder exists
    os.makedirs(PRODUCTS_FOLDER, exist_ok=True)
    
    print("Starting server on http://localhost:5000")
    print("Admin panel: http://localhost:5000/admin.html")
    app.run(debug=True, port=5000)