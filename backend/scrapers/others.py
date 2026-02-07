"""
<<<<<<< HEAD
Remaining 3 scrapers - Phase 1
linchpin, postal, crossfit.com
=======
Remaining 3 scrapers - FIXED
Green Beach, Linchpin, Postal
Only workout content, no fluff
>>>>>>> 1d69df1 (Initial commit from new folder)
"""

import requests
from bs4 import BeautifulSoup
from datetime import datetime


<<<<<<< HEAD
=======
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


>>>>>>> 1d69df1 (Initial commit from new folder)
# ========== LINCHPIN ==========

def fetch_linchpin(date):
    """CrossFit Linchpin - today only"""
    if date.date() != datetime.now().date():
<<<<<<< HEAD
        return None  # No archive
=======
        return None
>>>>>>> 1d69df1 (Initial commit from new folder)
    
    url = 'https://crossfitlinchpin.com/blogs/wod'
    
    try:
        response = requests.get(url, timeout=10)
<<<<<<< HEAD
        soup = BeautifulSoup(response.text, 'html.parser')
        
=======
        if response.status_code != 200:
            return None
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove images
        for tag in soup.find_all(['img', 'script', 'style']):
            tag.decompose()
        
        # Find blog post
>>>>>>> 1d69df1 (Initial commit from new folder)
        article = soup.find('article') or soup.find('div', class_='blog-post')
        if not article:
            return None
        
<<<<<<< HEAD
        content = article.get_text(separator='\n', strip=True)
        lines = [l for l in content.split('\n') if l.strip()][:30]
=======
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
>>>>>>> 1d69df1 (Initial commit from new folder)
        
        return {
            'date': date.strftime('%Y-%m-%d'),
            'source': 'linchpin',
            'source_name': 'CrossFit Linchpin',
            'url': url,
            'note': '⚠️ This source provides daily workouts only',
<<<<<<< HEAD
            'sections': [{'title': 'WORKOUT', 'lines': lines}]
        }
=======
            'sections': [{'title': 'WORKOUT', 'lines': filtered[:40]}]
        }
        
>>>>>>> 1d69df1 (Initial commit from new folder)
    except Exception as e:
        print(f"Linchpin error: {e}")
        return None


# ========== POSTAL ==========

def fetch_postal(date):
    """CrossFit Postal"""
    url = 'https://crossfitpostal.com/dailywod'
    
    try:
        response = requests.get(url, timeout=10)
<<<<<<< HEAD
        soup = BeautifulSoup(response.text, 'html.parser')
        
        wod = soup.find('div', class_='wod-content')
        if not wod:
            return None
        
        content = wod.get_text(separator='\n', strip=True)
        lines = [l for l in content.split('\n') if l.strip()]
=======
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
>>>>>>> 1d69df1 (Initial commit from new folder)
        
        return {
            'date': date.strftime('%Y-%m-%d'),
            'source': 'postal',
            'source_name': 'CrossFit Postal',
            'url': url,
<<<<<<< HEAD
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
=======
            'sections': [{'title': 'WORKOUT', 'lines': lines[:30]}]
        }
        
    except Exception as e:
        print(f"Postal error: {e}")
        return None
>>>>>>> 1d69df1 (Initial commit from new folder)
