"""
CrossFit Green Beach & Postal Scrapers - VERIFIED
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime


# ========== GREEN BEACH ==========

def fetch_greenbeach(date):
    """
    CrossFit Green Beach
    Note: This site may not have date-based archive
    """
    date_str = date.strftime('%Y-%m-%d')
    
    # Try main WOD page
    url = 'https://www.crossfitgreenbeach.com/en/wod'
    
    try:
        print(f"    → Fetching {url}")
        response = requests.get(url, timeout=15, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        if response.status_code != 200:
            print(f"    → Status {response.status_code}")
            return None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove noise
        for tag in soup.find_all(['script', 'style', 'nav', 'footer', 'header', 'img', 'iframe']):
            tag.decompose()
        
        # Try to find WOD content
        content = None
        
        # Method 1: wod-content div
        wod_div = soup.find('div', class_='wod-content')
        if wod_div:
            content = wod_div
            print(f"    → Found via .wod-content")
        
        # Method 2: entry-content
        if not content:
            entry = soup.find('div', class_='entry-content')
            if entry:
                content = entry
                print(f"    → Found via .entry-content")
        
        # Method 3: main content area
        if not content:
            main = soup.find('main') or soup.find('div', class_='main-content')
            if main:
                content = main
                print(f"    → Found via main")
        
        # Method 4: article
        if not content:
            article = soup.find('article')
            if article:
                content = article
                print(f"    → Found via article")
        
        if not content:
            print(f"    → No content container found")
            return None
        
        # Extract text
        raw_text = content.get_text(separator='\n', strip=True)
        
        if len(raw_text) < 30:
            print(f"    → Content too short")
            return None
        
        # Parse lines
        lines = []
        for line in raw_text.split('\n'):
            line = line.strip()
            if not line or len(line) < 2:
                continue
            
            # Skip navigation/footer
            lower = line.lower()
            if any(skip in lower for skip in ['home', 'about', 'contact', 'shop', 'login', 'register']):
                continue
            
            lines.append(line)
        
        if not lines:
            print(f"    → No lines parsed")
            return None
        
        lines = lines[:40]
        
        print(f"    → SUCCESS: {len(lines)} lines")
        
        return {
            'date': date_str,
            'source': 'greenbeach',
            'source_name': 'CrossFit Green Beach',
            'url': url,
            'sections': [{'title': 'WORKOUT', 'lines': lines}]
        }
        
    except requests.Timeout:
        print(f"    → Timeout")
        return None
    except Exception as e:
        print(f"    → Error: {e}")
        return None


# ========== POSTAL ==========

def fetch_postal(date):
    """
    CrossFit Postal
    Likely shows only current day
    """
    date_str = date.strftime('%Y-%m-%d')
    url = 'https://crossfitpostal.com/dailywod'
    
    try:
        print(f"    → Fetching {url}")
        response = requests.get(url, timeout=15, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        if response.status_code != 200:
            print(f"    → Status {response.status_code}")
            return None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove noise
        for tag in soup.find_all(['script', 'style', 'nav', 'footer', 'header', 'img', 'iframe']):
            tag.decompose()
        
        # Find WOD
        content = None
        
        # Method 1: wod-content
        wod_div = soup.find('div', class_='wod-content')
        if wod_div:
            content = wod_div
            print(f"    → Found via .wod-content")
        
        # Method 2: entry-content
        if not content:
            entry = soup.find('div', class_='entry-content')
            if entry:
                content = entry
                print(f"    → Found via .entry-content")
        
        # Method 3: daily-wod
        if not content:
            daily = soup.find('div', class_='daily-wod')
            if daily:
                content = daily
                print(f"    → Found via .daily-wod")
        
        # Method 4: article or main
        if not content:
            article = soup.find('article') or soup.find('main')
            if article:
                content = article
                print(f"    → Found via article/main")
        
        if not content:
            print(f"    → No content found")
            return None
        
        # Extract text
        raw_text = content.get_text(separator='\n', strip=True)
        
        if len(raw_text) < 30:
            print(f"    → Content too short")
            return None
        
        # Parse lines
        lines = []
        for line in raw_text.split('\n'):
            line = line.strip()
            if not line or len(line) < 2:
                continue
            
            # Skip junk
            lower = line.lower()
            if any(skip in lower for skip in ['home', 'shop', 'about', 'contact', 'login']):
                continue
            
            lines.append(line)
        
        if not lines:
            print(f"    → No lines parsed")
            return None
        
        lines = lines[:40]
        
        print(f"    → SUCCESS: {len(lines)} lines")
        
        return {
            'date': date_str,
            'source': 'postal',
            'source_name': 'CrossFit Postal',
            'url': url,
            'sections': [{'title': 'WORKOUT', 'lines': lines}]
        }
        
    except requests.Timeout:
        print(f"    → Timeout")
        return None
    except Exception as e:
        print(f"    → Error: {e}")
        return None


if __name__ == '__main__':
    print("Testing Green Beach...")
    result = fetch_greenbeach(datetime.now())
    if result:
        print(f"✅ Green Beach: {len(result['sections'][0]['lines'])} lines")
    
    print("\nTesting Postal...")
    result = fetch_postal(datetime.now())
    if result:
        print(f"✅ Postal: {len(result['sections'][0]['lines'])} lines")
