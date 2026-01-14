#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Module loading test - verify flow_designer loads"""

import json
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

def test_module_config_json():
    """Test if module_config.json is valid JSON"""
    config_path = Path(__file__).parent / "modules" / "flow_designer" / "module_config.json"
    print(f"\n[TEST] module_config.json path: {config_path}")
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = json.load(f)
        print(f"✅ JSON is valid")
        print(f"   - name: {config.get('name')}")
        print(f"   - display_name: {config.get('display_name')}")
        print(f"   - capabilities: {len(config.get('capabilities', []))} items")
        print(f"   - api_endpoints: {len(config.get('api_endpoints', []))} items")
        return True
    except json.JSONDecodeError as e:
        print(f"❌ JSON decode error: {e}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_flow_designer_import():
    """Test if flow_designer module can be imported"""
    print(f"\n[TEST] Importing flow_designer.interface...")
    try:
        from modules.flow_designer.interface import FlowDesignerModule
        print(f"✅ FlowDesignerModule imported successfully")
        
        # Check if it's a ModuleInterface subclass
        from core.module_interface import ModuleInterface
        if issubclass(FlowDesignerModule, ModuleInterface):
            print(f"✅ FlowDesignerModule is a ModuleInterface subclass")
        else:
            print(f"❌ FlowDesignerModule is NOT a ModuleInterface subclass")
            return False
        
        return True
    except ImportError as e:
        print(f"❌ Import error: {e}")
        return False
    except Exception as e:
        print(f"❌ Error: {e}")
        return False

def test_module_manager():
    """Test if ModuleManager can load flow_designer"""
    print(f"\n[TEST] Testing ModuleManager.load_module()...")
    try:
        from core.module_manager import ModuleManager
        from pathlib import Path
        
        modules_dir = Path(__file__).parent / "modules"
        manager = ModuleManager(str(modules_dir))
        result = manager.load_module("flow_designer")
        
        if result:
            print(f"✅ flow_designer loaded successfully")
            return True
        else:
            print(f"❌ flow_designer failed to load")
            return False
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("MODULE LOADING TEST")
    print("=" * 60)
    
    results = {
        "JSON validation": test_module_config_json(),
        "Interface import": test_flow_designer_import(),
        "ModuleManager loading": test_module_manager(),
    }
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    all_passed = all(results.values())
    print("\n" + ("✅ All tests passed!" if all_passed else "❌ Some tests failed"))
    sys.exit(0 if all_passed else 1)
