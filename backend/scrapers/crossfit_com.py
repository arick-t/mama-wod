"""
CrossFit.com Scraper - FIXED
Extracts only workout, stops at Stimulus/Scaling
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime


def fetch_workout(date):
    """Fetch workout from CrossFit.com"""
    date_str = date.strftime('%Y-%m-%d')
    date_code = date.strftime('%y%m%d')
    url = f'https://www.crossfit.com/{date_code}'
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            return None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove noise
        for tag in soup.find_all(['script', 'style', 'nav', 'footer', 'header', 'img']):
            tag.decompose()
        
        # Find article
        article = soup.find('article')
        if not article:
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
            if any(skip in lower for skip in ['find a gym', 'crossfit games', 'subscribe', 'sign up']):
                continue
            
            lines.append(line)
        
        # Parse into sections
        sections = []
        current_section = {'title': 'WORKOUT', 'lines': []}
        
        for line in lines[:50]:  # Limit to first 50 lines
            # Section header (contains ":")
            if ':' in line and len(line) < 40:
                if current_section['lines']:
                    sections.append(current_section)
                current_section = {'title': line.strip(':').upper(), 'lines': []}
            else:
                current_section['lines'].append(line)
        
        if current_section['lines']:
            sections.append(current_section)
        
        if not sections:
            return None
        
        return {
            'date': date_str,
            'source': 'crossfit_com',
            'source_name': 'CrossFit.com',
            'url': url,
            'sections': sections
        }
        
    except Exception as e:
        print(f"CrossFit.com error ({date_str}): {e}")
        return None
