#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
flow_designer モジュールのインポートテスト - エラー詳細を出力
"""
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

print("\n" + "="*70)
print("flow_designer モジュールインポートテスト")
print("="*70)

# 1. interface.py のインポート
print("\n[1] modules.flow_designer.interface をインポート...")
try:
    from modules.flow_designer import interface
    print(f"  成功: {interface}")
    print(f"  モジュール内容: {dir(interface)}")
except Exception as e:
    print(f"  失敗: {type(e).__name__}: {e}")
    traceback.print_exc()

# 2. ModuleInterface の確認
print("\n[2] ModuleInterface 実装クラスを探索...")
try:
    from modules.flow_designer import interface
    from core.module_interface import ModuleInterface
    
    for attr_name in dir(interface):
        attr = getattr(interface, attr_name)
        if isinstance(attr, type):
            print(f"  クラス: {attr_name} -> {attr}")
            if issubclass(attr, ModuleInterface) and attr != ModuleInterface:
                print(f"    -> ModuleInterface の実装クラス: {attr_name}")
except Exception as e:
    print(f"  失敗: {type(e).__name__}: {e}")
    traceback.print_exc()

# 3. app.py のインポート
print("\n[3] modules.flow_designer.app をインポート...")
try:
    from modules.flow_designer import app as flow_designer_app
    print(f"  成功: {flow_designer_app}")
    print(f"  モジュール内容: {dir(flow_designer_app)}")
except Exception as e:
    print(f"  失敗: {type(e).__name__}: {e}")
    traceback.print_exc()

# 4. module_config.json の確認
print("\n[4] module_config.json を確認...")
try:
    import json
    config_file = Path(__file__).parent / "modules" / "flow_designer" / "module_config.json"
    if config_file.exists():
        with open(config_file) as f:
            config = json.load(f)
        print(f"  config: {config}")
    else:
        print(f"  ファイルがありません: {config_file}")
except Exception as e:
    print(f"  失敗: {type(e).__name__}: {e}")
    traceback.print_exc()

print("\n" + "="*70)
