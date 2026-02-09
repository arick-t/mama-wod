"""
myleo.de Scraper - VERIFIED WORKING
Tested against actual site structure
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re


def fetch_workout(date):
    """Fetch workout for specific date from myleo.de"""
    date_str = date.strftime('%Y-%m-%d')
    url = f'https://myleo.de/en/wods/{date_str}/'
    
    try:
        print(f"    → Fetching {url}")
        response = requests.get(url, timeout=15, headers={
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
        
        if response.status_code == 404:
            print(f"    → 404 Not Found (no workout for this date)")
            return None
        
        if response.status_code != 200:
            print(f"    → Status {response.status_code}")
            return None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove noise
        for tag in soup.find_all(['script', 'style', 'nav', 'footer', 'header', 'img', 'figure', 'iframe']):
            tag.decompose()
        
        # Try multiple selectors
        content = None
        
        # Method 1: entry-content div
        entry = soup.find('div', class_='entry-content')
        if entry:
            content = entry
            print(f"    → Found via .entry-content")
        
        # Method 2: article tag
        if not content:
            article = soup.find('article')
            if article:
                # Remove sidebars, meta
                for unwanted in article.find_all(class_=['sidebar', 'meta', 'post-navigation', 'comments']):
                    unwanted.decompose()
                content = article
                print(f"    → Found via article")
        
        # Method 3: main tag
        if not content:
            main = soup.find('main')
            if main:
                content = main
                print(f"    → Found via main")
        
        if not content:
            print(f"    → No content container found")
            return None
        
        # Extract text
        raw_text = content.get_text(separator='\n', strip=True)
        
        if len(raw_text) < 50:
            print(f"    → Content too short ({len(raw_text)} chars)")
            return None
        
        # Parse into sections
        sections = []
        current_section = None
        
        for line in raw_text.split('\n'):
            line = line.strip()
            if not line or len(line) < 2:
                continue
            
            # Skip junk
            lower = line.lower()
            skip_keywords = ['weekly overview', 'post your score', 'compare to', 'skill class', 
                           'cookie', 'privacy', 'login', 'register', 'subscribe']
            if any(skip in lower for skip in skip_keywords):
                continue
            
            # Section header pattern: a), b), c)...
            match = re.match(r'^([a-z])\)\s*(.+)', line, re.IGNORECASE)
            if match:
                if current_section and current_section['lines']:
                    sections.append(current_section)
                title = match.group(2).strip()
                current_section = {'title': title.upper(), 'lines': []}
            elif current_section:
                current_section['lines'].append(line)
            else:
                # No section yet, start default
                if not sections:
                    current_section = {'title': 'WORKOUT', 'lines': [line]}
        
        if current_section and current_section['lines']:
            sections.append(current_section)
        
        if not sections:
            print(f"    → No sections parsed")
            return None
        
        print(f"    → SUCCESS: {len(sections)} sections found")
        
        return {
            'date': date_str,
            'source': 'myleo',
            'source_name': 'myleo CrossFit',
            'url': url,
            'sections': sections
        }
        
    except requests.Timeout:
        print(f"    → Timeout")
        return None
    except requests.RequestException as e:
        print(f"    → Network error: {e}")
        return None
    except Exception as e:
        print(f"    → Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return None


if __name__ == '__main__':
    # Test
    print("Testing myleo scraper...")
    result = fetch_workout(datetime.now())
    if result:
        print(f"✅ Success! {len(result['sections'])} sections")
        for s in result['sections'][:2]:
            print(f"  [{s['title']}] {len(s['lines'])} lines")
    else:
        print("❌ Failed")
