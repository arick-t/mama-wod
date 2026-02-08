"""
myleo.de Scraper - FIXED
Extracts ONLY workout content, no images or marketing
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re


def fetch_workout(date):
    """Fetch workout for specific date"""
    date_str = date.strftime('%Y-%m-%d')
    url = f'https://myleo.de/en/wods/{date_str}/'
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            return None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove all noise
        for tag in soup.find_all(['script', 'style', 'nav', 'footer', 'header', 'img', 'figure']):
            tag.decompose()
        
        # Find article
        article = soup.find('article', class_='post')
        if not article:
            return None
        
        # Remove comments, metadata
        for unwanted in article.find_all(class_=['post-navigation', 'comments', 'meta', 'tags', 'share']):
            unwanted.decompose()
        
        # Get entry content
        entry = article.find('div', class_='entry-content')
        if not entry:
            return None
        
        # Parse into sections
        sections = []
        current_section = None
        
        for line in entry.get_text(separator='\n').split('\n'):
            line = line.strip()
            if not line or len(line) < 2:
                continue
            
            # Skip unwanted lines
            lower = line.lower()
            if any(skip in lower for skip in ['weekly overview', 'post your score', 'compare to', 'skill class']):
                continue
            
            # Section header (a), b), c)...)
            match = re.match(r'^([a-z])\)\s*(.+)', line, re.IGNORECASE)
            if match:
                if current_section and current_section['lines']:
                    sections.append(current_section)
                title = match.group(2).strip().upper()
                current_section = {'title': title, 'lines': []}
            elif current_section:
                current_section['lines'].append(line)
            else:
                # No section yet, start "WORKOUT"
                if not sections:
                    current_section = {'title': 'WORKOUT', 'lines': [line]}
        
        if current_section and current_section['lines']:
            sections.append(current_section)
        
        if not sections:
            return None
        
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
