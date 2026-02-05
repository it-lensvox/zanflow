# apps/chat/utils.py
import requests
from bs4 import BeautifulSoup
import logging

logger = logging.getLogger(__name__)

def fetch_link_preview(url):
    """
    Fetches OpenGraph (OG) tags from a URL to generate a preview.
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        # 2-second timeout to prevent hanging the chat
        response = requests.get(url, headers=headers, timeout=2)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Try to find OpenGraph tags, fall back to standard tags
        title = soup.find("meta", property="og:title")
        description = soup.find("meta", property="og:description")
        image = soup.find("meta", property="og:image")
        
        data = {
            "url": url,
            "title": title["content"] if title else (soup.title.string if soup.title else url),
            "description": description["content"] if description else "",
            "image": image["content"] if image else "",
            "site_name": soup.find("meta", property="og:site_name")["content"] if soup.find("meta", property="og:site_name") else ""
        }
        return data

    except Exception as e:
        logger.warning(f"Failed to fetch link preview for {url}: {str(e)}")
        # Return basic data if fetching fails
        return {"url": url, "title": url, "description": "", "image": ""}