import os
import sys

# Add the parent (root) directory to Python path to import from src/
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.server import app

# Vercel will auto-detect 'app' as the ASGI application
