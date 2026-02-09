"""
CrossFit Linchpin Scraper - VERIFIED
Handles Shopify blog structure
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime


def fetch_workout(date):
    """CrossFit Linchpin - today only (no archive)"""
    # Linchpin doesn't provide historical WODs
    if date.date() != datetime.now().date():
        return None
    
    date_str = date.strftime('%Y-%m-%d')
    url = 'https://crossfitlinchpin.com/blogs/wod'
    
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
        
        # Find blog article (Shopify structure)
        content = None
        
        # Try: article tag
        article = soup.find('article', class_='article')
        if article:
            content = article
            print(f"    → Found via article.article")
        
        # Try: blog-post div
        if not content:
            blog_post = soup.find('div', class_='blog-post')
            if blog_post:
                content = blog_post
                print(f"    → Found via .blog-post")
        
        # Try: rte (rich text editor) class
        if not content:
            rte = soup.find('div', class_='rte')
            if rte:
                content = rte
                print(f"    → Found via .rte")
        
        # Fallback: first article
        if not content:
            article = soup.find('article')
            if article:
                content = article
                print(f"    → Found via article (fallback)")
        
        if not content:
            print(f"    → No content found")
            return None
        
        # Extract text
        raw_text = content.get_text(separator='\n', strip=True)
        
        if len(raw_text) < 30:
            print(f"    → Content too short ({len(raw_text)} chars)")
            return None
        
        # Parse lines
        lines = []
        for line in raw_text.split('\n'):
            line = line.strip()
            if not line or len(line) < 2:
                continue
            
            # Stop at marketing content
            lower = line.lower()
            if any(stop in lower for stop in ['private track', 'subscribe', 'podcast', 'testimonials', 'shop now']):
                break
            
            # Skip navigation
            if any(skip in lower for skip in ['home', 'about', 'contact', 'search']):
                continue
            
            lines.append(line)
        
        if not lines:
            print(f"    → No lines parsed")
            return None
        
        # Limit to reasonable length
        lines = lines[:50]
        
        print(f"    → SUCCESS: {len(lines)} lines")
        
        return {
            'date': date_str,
            'source': 'linchpin',
            'source_name': 'CrossFit Linchpin',
            'url': url,
            'note': '⚠️ This source provides daily workouts only',
            'sections': [{'title': 'WORKOUT', 'lines': lines}]
        }
        
    except requests.Timeout:
        print(f"    → Timeout")
        return None
    except Exception as e:
        print(f"    → Error: {e}")
        return None


if __name__ == '__main__':
    print("Testing Linchpin scraper...")
    result = fetch_workout(datetime.now())
    if result:
        print(f"✅ Success! {len(result['sections'][0]['lines'])} lines")
    else:
        print("❌ Failed")
