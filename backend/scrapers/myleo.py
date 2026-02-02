"""
myleo.de Scraper - Phase 1
Hard-coded, production-ready
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime


def fetch_workout(date):
    """
    Fetch workout for a specific date
    Returns: {date, content, sections} or None
    """
    date_str = date.strftime('%Y-%m-%d')
    url = f'https://myleo.de/en/wods/{date_str}/'
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            return None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove noise
        for tag in soup.find_all(['script', 'style', 'nav', 'footer', 'header']):
            tag.decompose()
        
        # Find workout
        article = soup.find('article')
        if not article:
            return None
        
        # Extract content
        entry = article.find('div', class_='entry-content')
        if not entry:
            return None
        
        # Parse sections
        sections = []
        current_section = None
        
        for line in entry.get_text(separator='\n').split('\n'):
            line = line.strip()
            if not line:
                continue
            
            # Section header (a), b), c)...)
            if line.startswith(tuple('abcdefgh')) and ')' in line[:3]:
                if current_section:
                    sections.append(current_section)
                current_section = {
                    'title': line.split(')', 1)[1].strip().upper(),
                    'lines': []
                }
            elif current_section:
                current_section['lines'].append(line)
        
        if current_section:
            sections.append(current_section)
        
        return {
            'date': date_str,
            'source': 'myleo',
            'source_name': 'myleo CrossFit',
            'url': url,
            'sections': sections
        }
        
    except Exception as e:
        print(f"myleo error ({date_str}): {e}")
        return None
