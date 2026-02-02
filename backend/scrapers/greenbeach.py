"""
CrossFit Green Beach Scraper - Phase 1
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime


def fetch_workout(date):
    """Fetch workout from Green Beach"""
    date_str = date.strftime('%Y-%m-%d')
    
    # Green Beach likely has a date-based URL or shows recent WODs
    url = 'https://www.crossfitgreenbeach.com/en/wod'
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            return None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find WOD posts (adjust selectors based on actual site)
        wod_posts = soup.find_all('div', class_='wod-post')
        
        for post in wod_posts:
            # Check if this post is for our date
            post_date = post.find('time')
            if post_date and date_str in post_date.get('datetime', ''):
                content = post.get_text(separator='\n', strip=True)
                
                # Simple parsing
                sections = [{
                    'title': 'WORKOUT',
                    'lines': [l.strip() for l in content.split('\n') if l.strip()]
                }]
                
                return {
                    'date': date_str,
                    'source': 'greenbeach',
                    'source_name': 'CrossFit Green Beach',
                    'url': url,
                    'sections': sections
                }
        
        return None
        
    except Exception as e:
        print(f"Green Beach error ({date_str}): {e}")
        return None
