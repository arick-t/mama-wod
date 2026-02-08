"""
Remaining 3 scrapers - FIXED
Green Beach, Linchpin, Postal
Only workout content, no fluff
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime


# ========== GREEN BEACH ==========

def fetch_greenbeach(date):
    """CrossFit Green Beach"""
    date_str = date.strftime('%Y-%m-%d')
    url = 'https://www.crossfitgreenbeach.com/en/wod'
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            return None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove images
        for tag in soup.find_all(['img', 'script', 'style']):
            tag.decompose()
        
        # Find WOD content (adapt selectors to actual site)
        wod = soup.find('div', class_='wod-content') or soup.find('article')
        if not wod:
            return None
        
        text = wod.get_text(separator='\n', strip=True)
        lines = [l.strip() for l in text.split('\n') if l.strip() and len(l.strip()) > 2]
        
        # Filter out navigation/footer
        lines = [l for l in lines if not any(skip in l.lower() for skip in ['home', 'contact', 'shop', 'about'])]
        
        if not lines:
            return None
        
        return {
            'date': date_str,
            'source': 'greenbeach',
            'source_name': 'CrossFit Green Beach',
            'url': url,
            'sections': [{'title': 'WORKOUT', 'lines': lines[:30]}]
        }
        
    except Exception as e:
        print(f"Green Beach error: {e}")
        return None


# ========== LINCHPIN ==========

def fetch_linchpin(date):
    """CrossFit Linchpin - today only"""
    if date.date() != datetime.now().date():
        return None
    
    url = 'https://crossfitlinchpin.com/blogs/wod'
    
    try:
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            return None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove images
        for tag in soup.find_all(['img', 'script', 'style']):
            tag.decompose()
        
        # Find blog post
        article = soup.find('article') or soup.find('div', class_='blog-post')
        if not article:
            return None
        
        text = article.get_text(separator='\n', strip=True)
        lines = [l.strip() for l in text.split('\n') if l.strip() and len(l.strip()) > 2]
        
        # Stop at "Private Track" or other marketing
        filtered = []
        for line in lines:
            lower = line.lower()
            if any(stop in lower for stop in ['private track', 'subscribe', 'podcast']):
                break
            filtered.append(line)
        
        if not filtered:
            return None
        
        return {
            'date': date.strftime('%Y-%m-%d'),
            'source': 'linchpin',
            'source_name': 'CrossFit Linchpin',
            'url': url,
            'note': '⚠️ This source provides daily workouts only',
            'sections': [{'title': 'WORKOUT', 'lines': filtered[:40]}]
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
        if response.status_code != 200:
            return None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove images
        for tag in soup.find_all(['img', 'script', 'style']):
            tag.decompose()
        
        # Find WOD
        wod = soup.find('div', class_='wod-content') or soup.find('article')
        if not wod:
            return None
        
        text = wod.get_text(separator='\n', strip=True)
        lines = [l.strip() for l in text.split('\n') if l.strip() and len(l.strip()) > 2]
        
        # Filter noise
        lines = [l for l in lines if not any(skip in l.lower() for skip in ['home', 'shop', 'about', 'contact'])]
        
        if not lines:
            return None
        
        return {
            'date': date.strftime('%Y-%m-%d'),
            'source': 'postal',
            'source_name': 'CrossFit Postal',
            'url': url,
            'sections': [{'title': 'WORKOUT', 'lines': lines[:30]}]
        }
        
    except Exception as e:
        print(f"Postal error: {e}")
        return None
