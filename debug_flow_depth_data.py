#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
フロー実行時の深度データ取得テスト
"""
import sys
from pathlib import Path
import json
import time

# プロジェクトルートをパスに追加
sys.path.insert(0, str(Path(__file__).parent))

# 必要なモジュールをインポート
from core.app import create_app
from modules.detect_3d.interface import Detection3DModule
from modules.detect_3d.camera.camera_manager import camera_manager

def test_flow_depth_data():
    """フロー実行時の深度データ取得をテストする"""
    print("\n" + "="*60)
    print("フロー実行時の深度データ取得テスト")
    print("="*60)
    
    # アプリの作成
    app = create_app()
    
    with app.app_context():
        # モジュールの初期化
        print("\n[1] モジュール初期化")
        module = Detection3DModule()
        init_result = module.initialize()
        print(f"  初期化結果: {init_result}")
        print(f"  camera_manager: {module.camera_manager}")
        print(f"  インスタンスID: {id(module.camera_manager)}")
        
        # カメラの状態確認
        if module.camera_manager:
            print(f"\n[2] カメラ状態確認")
            print(f"  _capture_running: {getattr(module.camera_manager, '_capture_running', 'unknown')}")
            print(f"  _camera_initialized: {getattr(module.camera_manager, '_camera_initialized', 'unknown')}")
            print(f"  _latest_depth_frame: {type(getattr(module.camera_manager, '_latest_depth_frame', None))}")
            print(f"  _latest_rgb_frame: {type(getattr(module.camera_manager, '_latest_rgb_frame', None))}")
        
        # カメラが起動していなければ起動
        if module.camera_manager and not getattr(module.camera_manager, '_capture_running', False):
            print(f"\n[3] カメラ起動")
            try:
                module.camera_manager.start()
                print(f"  カメラ起動完了")
                time.sleep(1)  # フレームキャプチャを待つ
            except Exception as e:
                print(f"  カメラ起動エラー: {e}")
        
        # count_pixels アクションをテスト
        print(f"\n[4] count_pixels アクション実行")
        count_pixels_params = {
            'points': [[100, 100], [200, 100], [200, 200], [100, 200]],
            'depth_min': 0,
            'depth_max': 1000
        }
        result = module.execute_action('count_pixels', count_pixels_params)
        print(f"  結果: {result}")
        
        # 深度フレーム直接確認
        print(f"\n[5] 深度フレーム直接確認")
        if module.camera_manager:
            depth_frame = getattr(module.camera_manager, '_latest_depth_frame', None)
            print(f"  深度フレーム: {type(depth_frame)}")
            if depth_frame is not None:
                print(f"  フレーム形状: {depth_frame.shape}")
                print(f"  フレーム値範囲: {depth_frame.min()} - {depth_frame.max()}")
            else:
                print(f"  警告: 深度フレームがNoneです")
        
        # detect_touch アクションをテスト（ファイルから原点データを読み込む）
        print(f"\n[6] detect_touch アクション実行")
        detect_touch_params = {
            'origin_no': 1,
            'judge_no': 1,
            'timeout': 5
        }
        result = module.execute_action('detect_touch', detect_touch_params)
        print(f"  結果: {result}")

if __name__ == '__main__':
    test_flow_depth_data()
