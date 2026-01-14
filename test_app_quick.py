#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Quick app startup test"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

# Test import
from core.app import create_app

print("=" * 60)
print("APP STARTUP TEST")
print("=" * 60)

# Create app
print("\nCreating app...")
app = create_app()

# Get module manager from app
if hasattr(app, 'module_manager'):
    print("[OK] app.module_manager exists")
    
    # Get all modules
    all_modules = app.module_manager.get_all_modules()
    print(f"Loaded modules: {list(all_modules.keys())}")
    for mod_name, mod_instance in all_modules.items():
        status = "[OK]"
        print(f"{status} {mod_name}: loaded")
else:
    print("[NG] app.module_manager not found")

print("\nDone!")



