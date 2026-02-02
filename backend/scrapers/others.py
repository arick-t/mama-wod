"""
Remaining 3 scrapers - Phase 1
linchpin, postal, crossfit.com
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime


# ========== LINCHPIN ==========

def fetch_linchpin(date):
    """CrossFit Linchpin - today only"""
    if date.date() != datetime.now().date():
        return None  # No archive
    
    url = 'https://crossfitlinchpin.com/blogs/wod'
    
    try:
        response = requests.get(url, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        article = soup.find('article') or soup.find('div', class_='blog-post')
        if not article:
            return None
        
        content = article.get_text(separator='\n', strip=True)
        lines = [l for l in content.split('\n') if l.strip()][:30]
        
        return {
            'date': date.strftime('%Y-%m-%d'),
            'source': 'linchpin',
            'source_name': 'CrossFit Linchpin',
            'url': url,
            'note': '⚠️ This source provides daily workouts only',
            'sections': [{'title': 'WORKOUT', 'lines': lines}]
        }
    except Exception as e:
        print(f"Linchpin error: {e}")
        return None


# ========== POSTAL ==========

def fetch_postal(date):
    """CrossFit Postal"""
    url = 'https://crossfitpostal.com/dailywod'
    
    try:
        response = requests.get(url, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        wod = soup.find('div', class_='wod-content')
        if not wod:
            return None
        
        content = wod.get_text(separator='\n', strip=True)
        lines = [l for l in content.split('\n') if l.strip()]
        
        return {
            'date': date.strftime('%Y-%m-%d'),
            'source': 'postal',
            'source_name': 'CrossFit Postal',
            'url': url,
            'sections': [{'title': 'WORKOUT', 'lines': lines}]
        }
    except Exception as e:
        print(f"Postal error: {e}")
        return None


# ========== CROSSFIT.COM ==========

def fetch_crossfit_com(date):
    """CrossFit.com - official"""
    date_code = date.strftime('%y%m%d')
    url = f'https://www.crossfit.com/{date_code}'
    
    try:
        response = requests.get(url, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        article = soup.find('article')
        if not article:
            return None
        
        # Get text, stop at "Stimulus"
        lines = []
        for line in article.get_text(separator='\n').split('\n'):
            if 'stimulus' in line.lower() or 'scaling' in line.lower():
                break
            if line.strip():
                lines.append(line.strip())
        
        sections = []
        current = {'title': 'WORKOUT', 'lines': []}
        
        for line in lines[:40]:
            if ':' in line and len(line) < 30:
                if current['lines']:
                    sections.append(current)
                current = {'title': line.strip(':').upper(), 'lines': []}
            else:
                current['lines'].append(line)
        
        if current['lines']:
            sections.append(current)
        
        return {
            'date': date.strftime('%Y-%m-%d'),
            'source': 'crossfit_com',
            'source_name': 'CrossFit.com',
            'url': url,
            'sections': sections
        }
    except Exception as e:
        print(f"CrossFit.com error: {e}")
        return None
