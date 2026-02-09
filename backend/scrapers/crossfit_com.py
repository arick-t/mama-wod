"""
CrossFit.com Scraper - VERIFIED WORKING
This one already works, keeping it as-is
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime


def fetch_workout(date):
    """Fetch workout from CrossFit.com - this scraper works!"""
    date_str = date.strftime('%Y-%m-%d')
    date_code = date.strftime('%y%m%d')
    url = f'https://www.crossfit.com/{date_code}'
    
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
        
        # Find article
        article = soup.find('article')
        if not article:
            print(f"    → No article found")
            return None
        
        # Get text, stop at Stimulus/Scaling
        lines = []
        for line in article.get_text(separator='\n').split('\n'):
            line = line.strip()
            if not line:
                continue
            
            # STOP at these keywords
            lower = line.lower()
            if any(stop in lower for stop in ['stimulus', 'scaling', 'intermediate option', 'beginner option', 'resources']):
                break
            
            # Skip junk
            if any(skip in lower for skip in ['find a gym', 'crossfit games', 'subscribe', 'sign up', 'shop']):
                continue
            
            lines.append(line)
        
        if not lines:
            print(f"    → No lines parsed")
            return None
        
        # Parse into sections
        sections = []
        current_section = {'title': 'WORKOUT', 'lines': []}
        
        for line in lines[:60]:  # Limit
            # Section header (contains ":")
            if ':' in line and len(line) < 50:
                if current_section['lines']:
                    sections.append(current_section)
                current_section = {'title': line.strip(':').upper(), 'lines': []}
            else:
                current_section['lines'].append(line)
        
        if current_section['lines']:
            sections.append(current_section)
        
        if not sections:
            print(f"    → No sections")
            return None
        
        print(f"    → SUCCESS: {len(sections)} sections")
        
        return {
            'date': date_str,
            'source': 'crossfit_com',
            'source_name': 'CrossFit.com',
            'url': url,
            'sections': sections
        }
        
    except requests.Timeout:
        print(f"    → Timeout")
        return None
    except Exception as e:
        print(f"    → Error: {e}")
        return None


if __name__ == '__main__':
    print("Testing CrossFit.com scraper...")
    result = fetch_workout(datetime.now())
    if result:
        print(f"✅ Success! {len(result['sections'])} sections")
