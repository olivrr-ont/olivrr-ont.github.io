#!/usr/bin/env python3
import subprocess
import sys
import os

def check_dependencies():
    """Check if required packages are installed"""
    try:
        import flask
        print("✓ Flask is installed")
    except ImportError:
        print("Installing Flask...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "flask"])
    
    try:
        import playwright
        print("✓ Playwright is installed")
    except ImportError:
        print("Installing Playwright...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright"])
        print("Installing browsers...")
        subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])

def main():
    print("=== Store Web Application ===")
    print("1. Checking dependencies...")
    check_dependencies()
    
    print("\n2. Starting server...")
    print("   • Store: http://localhost:5000")
    print("   • Admin: http://localhost:5000/admin.html")
    print("   • Press Ctrl+C to stop\n")
    
    # Start Flask app
    from app import app
    app.run(debug=True, port=5000)

if __name__ == "__main__":
    main()