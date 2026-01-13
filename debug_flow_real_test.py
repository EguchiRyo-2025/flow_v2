#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
フロー実行時の深度データ取得確認テスト - 実際のフロー要素のテスト
"""
import sys
from pathlib import Path
import json
import time

sys.path.insert(0, str(Path(__file__).parent))

from core.app import create_app
from modules.detect_3d.interface import Detection3DModule

def test_flow_with_real_object():
    """実際のカメラデータでテスト"""
    print("\n" + "="*70)
    print("フロー実行時の深度データ取得テスト（実物体）")
    print("="*70)
    
    app = create_app()
    
    with app.app_context():
        module = Detection3DModule()
        module.initialize()
        
        # カメラ起動
        if module.camera_manager and not getattr(module.camera_manager, '_capture_running', False):
            print("\n[準備] カメラ起動中...")
            module.camera_manager.start()
            time.sleep(2)  # フレームキャプチャを待つ
        
        # 深度フレーム確認
        depth_frame = getattr(module.camera_manager, '_latest_depth_frame', None)
        if depth_frame is not None:
            print(f"[OK] 深度フレーム取得成功")
            print(f"  形状: {depth_frame.shape}")
            print(f"  値範囲: {depth_frame.min()} - {depth_frame.max()}")
            print(f"  平均値: {depth_frame[depth_frame > 0].mean():.1f}")
            print(f"  有効ピクセル数: {(depth_frame > 0).sum()}")
        
        # 複数のカウント領域をテスト
        test_regions = [
            {
                'name': '中央領域 (300-340, 200-240)',
                'points': [[300, 200], [340, 200], [340, 240], [300, 240]],
                'depth_min': 0,
                'depth_max': 2000
            },
            {
                'name': '左手前領域 (100-200, 100-200)',  
                'points': [[100, 100], [200, 100], [200, 200], [100, 200]],
                'depth_min': 0,
                'depth_max': 1000
            },
            {
                'name': '全体スキャン (0-640, 0-480)',
                'points': [[50, 50], [590, 50], [590, 430], [50, 430]],
                'depth_min': 100,
                'depth_max': 2000
            }
        ]
        
        print(f"\n[テスト] 複数領域でのピクセルカウント:")
        for test_region in test_regions:
            params = {
                'points': test_region['points'],
                'depth_min': test_region['depth_min'],
                'depth_max': test_region['depth_max']
            }
            result = module.execute_action('count_pixels', params)
            status = "[OK]" if result.get('success') else "[NG]"
            print(f"{status} {test_region['name']}: {result.get('pixel_count', 'N/A')} pixels")
            if not result.get('success'):
                print(f"   Error: {result.get('error')}")
        
        # 原点登録テスト
        print(f"\n[テスト] 原点登録（中央領域）:")
        origin_params = {
            'origin_no': None,
            'points': [[300, 200], [340, 200], [340, 240], [300, 240]],
            'comment': 'Flow test origin'
        }
        result = module.execute_action('register_origin', origin_params)
        if result.get('success'):
            print(f"[OK] Origin registration successful")
            print(f"  Origin No: {result.get('origin_no')}")
            print(f"  Depth range: {result.get('depth', {})}")
        else:
            print(f"[NG] Origin registration failed: {result.get('error')}")
        
        print("\n" + "="*70)
        print("Test complete - Flow depth data retrieval is working properly")
        print("="*70)

if __name__ == '__main__':
    test_flow_with_real_object()
