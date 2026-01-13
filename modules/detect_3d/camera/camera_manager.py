import cv2
import numpy as np
from primesense import openni2
from primesense import _openni2 as c_api
import os
import threading
import time
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

MODULE_ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = MODULE_ROOT / '.env'
if ENV_PATH.exists():
    load_dotenv(dotenv_path=str(ENV_PATH))
else:
    load_dotenv()

OPENNI_PATH = os.getenv('OPENNI_PATH')
if not OPENNI_PATH:
    print('OPENNI_PATH is not configured; depth camera features will remain disabled until set.')

# モジュールレベルのシングルトンインスタンス
_module_instance = None
_module_lock = threading.Lock()

class CameraManager:
    """
    カメラリソース管理クラス（デバイス常駐型）
    
    設計原則：
    1. アプリケーション起動時に1回だけ初期化して常駐
    2. 専用スレッドでreadFrame()を連続実行（常に動き続ける）
    3. ページは単にフレームを取得するだけ（UIイベントと非同期）
    4. ページ遷移時は何もしない（初期化しない、停止しない）
    5. アプリケーション終了時のみクリーンアップ（stop → unload）
    6. カメラ抜けた時のみ再初期化（例外処理）
    """
    
    _init_lock = threading.Lock()
    
    def __new__(cls):
        global _module_instance, _module_lock
        if _module_instance is None:
            with _module_lock:
                if _module_instance is None:
                    _module_instance = super(CameraManager, cls).__new__(cls)
                    _module_instance._initialized = False
        return _module_instance
    
    def __init__(self):
        with CameraManager._init_lock:
            if hasattr(self, '_initialized') and self._initialized:
                return
            
            self._device = None
            self._depth_stream = None
            self._rgb_stream = None
            self._camera_initialized = False
            self._stream_lock = threading.Lock()
            self._openni_path = OPENNI_PATH
            
            # フレームバッファ（スレッドセーフ）
            self._frame_lock = threading.Lock()
            self._latest_depth_frame = None
            self._latest_rgb_frame = None
            
            # キャプチャスレッド（常駐）
            self._capture_thread: Optional[threading.Thread] = None
            self._capture_stop_event = threading.Event()
            self._capture_thread_lock = threading.Lock()
            self._capture_running = False
            
            # エラー処理
            self._last_error_time = 0.0
            self._error_cooldown = 1.0  # エラーログの間隔
            
            self._initialized = True
            print(f"[CameraManager] インスタンス初期化完了: インスタンスID={id(self)}")
    
    def start(self):
        """
        カメラを起動して常駐させる（アプリ起動時に1回だけ呼ぶ）
        
        注意: UIイベントと一切同期させない。常に動き続ける。
        """
        # 重複呼び出しを防ぐ（ロック外でチェック）
        if self._capture_running:
            print(f"[CameraManager.start] 既に起動済みです（スキップ）: _capture_running={self._capture_running}")
            return
        
        with self._capture_thread_lock:
            # 二重チェック（ロック取得後に再度確認）
            if self._capture_running:
                print(f"[CameraManager.start] 既に起動済みです（ロック内、スキップ）: _capture_running={self._capture_running}")
                return
            
            print(f"[CameraManager.start] カメラ常駐開始（1回目のみ）")
            
            # 初期化を試みる（非同期、失敗してもスレッドは開始）
            self._initialize_camera_async()
            
            # キャプチャスレッドを開始（常駐）
            self._capture_stop_event.clear()
            thread = threading.Thread(
                target=self._capture_loop,
                name='CameraCaptureThread',
                daemon=True
            )
            self._capture_thread = thread
            self._capture_running = True
            thread.start()
            print(f"[CameraManager.start] カメラ常駐開始完了: スレッド名={thread.name}, スレッドID={thread.ident}, _capture_running={self._capture_running}")
    
    def _initialize_camera_async(self):
        """
        カメラを初期化（非同期、エラーは無視して続行）
        
        注意: このメソッドは失敗しても例外を投げない。
        カメラが接続されていない場合は、_capture_loopで再試行する。
        """
        if not self._openni_path:
            return False
        
        with self._stream_lock:
            # 既に初期化済みの場合は成功
            if self._camera_initialized and self._depth_stream and self._rgb_stream:
                return True
            
            try:
                # OpenNIの初期化
                if not openni2.is_initialized():
                    openni2.initialize(self._openni_path)
                
                # デバイスのオープン
                if self._device is None:
                    self._device = openni2.Device.open_any()
                    print("[CameraManager] デバイスをオープンしました")
                
                # 深度ストリームの初期化
                if self._depth_stream is None:
                    self._depth_stream = self._device.create_depth_stream()
                    self._depth_stream.set_video_mode(c_api.OniVideoMode(
                        pixelFormat=c_api.OniPixelFormat.ONI_PIXEL_FORMAT_DEPTH_100_UM,
                        resolutionX=640,
                        resolutionY=480,
                        fps=30
                    ))
                    self._depth_stream.start()
                    print("[CameraManager] 深度ストリームを開始しました")
                
                # RGBストリームの初期化
                if self._rgb_stream is None:
                    self._rgb_stream = self._device.create_color_stream()
                    self._rgb_stream.set_video_mode(c_api.OniVideoMode(
                        pixelFormat=c_api.OniPixelFormat.ONI_PIXEL_FORMAT_RGB888,
                        resolutionX=640,
                        resolutionY=480,
                        fps=30
                    ))
                    self._rgb_stream.start()
                    print("[CameraManager] RGBストリームを開始しました")
                
                # 初期化成功
                if self._depth_stream and self._rgb_stream:
                    self._camera_initialized = True
                    print("[CameraManager] カメラ初期化完了")
                    return True
                
            except Exception as e:
                # エラーはログに記録するが、例外は投げない
                now = time.time()
                if now - self._last_error_time > self._error_cooldown:
                    print(f"[CameraManager] カメラ初期化エラー（再試行します）: {e}")
                    self._last_error_time = now
                # カメラが接続されていない場合は、後で再試行する
                self._camera_initialized = False
        
        return False
    
    def _capture_loop(self):
        """
        カメラキャプチャループ（常駐スレッド）
        
        このスレッドは常に動き続け、フレームを取得し続ける。
        UIイベントとは一切同期しない。
        """
        print("[CameraManager] キャプチャループ開始（常駐）")
        
        while not self._capture_stop_event.is_set():
            try:
                # カメラが初期化されていない場合は初期化を試みる
                if not self._camera_initialized:
                    self._initialize_camera_async()
                    if not self._camera_initialized:
                        time.sleep(1.0)  # カメラ未接続時は1秒待機
                        continue
                
                # ストリームの参照を取得
                with self._stream_lock:
                    depth_stream = self._depth_stream
                    rgb_stream = self._rgb_stream
                
                # 深度フレームを取得
                if depth_stream:
                    try:
                        depth_frame = depth_stream.read_frame()
                        if depth_frame is not None:
                            depth_data = depth_frame.get_buffer_as_uint16()
                            depth_array = np.frombuffer(depth_data, dtype=np.uint16).reshape((480, 640)).copy()
                            
                            with self._frame_lock:
                                self._latest_depth_frame = depth_array
                    except Exception as e:
                        # カメラが抜けた場合など、再初期化を試みる
                        error_str = str(e)
                        now = time.time()
                        if now - self._last_error_time > self._error_cooldown:
                            print(f"[CameraManager] 深度フレーム取得エラー（再初期化を試みます）: {e}")
                            self._last_error_time = now
                        # カメラが抜けた可能性があるので、再初期化
                        with self._stream_lock:
                            self._camera_initialized = False
                            if 'OUT_OF_FLOW' not in error_str and 'open by other components' not in error_str:
                                # 深刻なエラーの場合はストリームをリセット
                                try:
                                    if self._depth_stream:
                                        self._depth_stream.stop()
                                except:
                                    pass
                                self._depth_stream = None
                        time.sleep(0.5)
                        continue
                
                # RGBフレームを取得
                if rgb_stream:
                    try:
                        rgb_frame = rgb_stream.read_frame()
                        if rgb_frame is not None:
                            rgb_data = rgb_frame.get_buffer_as_uint8()
                            bgr = np.frombuffer(rgb_data, dtype=np.uint8).reshape(480, 640, 3).copy()
                            rgb_array = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                            
                            with self._frame_lock:
                                self._latest_rgb_frame = rgb_array
                    except Exception as e:
                        # カメラが抜けた場合など、再初期化を試みる
                        error_str = str(e)
                        now = time.time()
                        if now - self._last_error_time > self._error_cooldown:
                            print(f"[CameraManager] RGBフレーム取得エラー（再初期化を試みます）: {e}")
                            self._last_error_time = now
                        # カメラが抜けた可能性があるので、再初期化
                        with self._stream_lock:
                            self._camera_initialized = False
                            if 'OUT_OF_FLOW' not in error_str and 'open by other components' not in error_str:
                                # 深刻なエラーの場合はストリームをリセット
                                try:
                                    if self._rgb_stream:
                                        self._rgb_stream.stop()
                                except:
                                    pass
                                self._rgb_stream = None
                        time.sleep(0.5)
                        continue
                
                # 30fpsを上限にする程度の待機
                time.sleep(0.01)
                
            except Exception as e:
                # 予期しないエラー
                now = time.time()
                if now - self._last_error_time > self._error_cooldown:
                    print(f"[CameraManager] キャプチャループエラー: {e}")
                    self._last_error_time = now
                time.sleep(0.5)
        
        print("[CameraManager] キャプチャループ終了")
        self._capture_running = False
    
    def get_depth_frame(self):
        """
        深度フレームを取得（ページから呼ばれる）
        
        注意: UIイベントと一切同期しない。単にバッファから取得するだけ。
        フレームが取得できない場合は、少し待機してから再試行する。
        """
        # フレームが取得できるまで最大0.5秒待機
        deadline = time.time() + 0.5
        while time.time() < deadline:
            with self._frame_lock:
                if self._latest_depth_frame is not None:
                    return self._latest_depth_frame.copy()
            time.sleep(0.05)  # 50ms待機
        return None
    
    def get_rgb_frame(self):
        """
        RGBフレームを取得（ページから呼ばれる）
        
        注意: UIイベントと一切同期しない。単にバッファから取得するだけ。
        フレームが取得できない場合は、少し待機してから再試行する。
        """
        # フレームが取得できるまで最大0.5秒待機
        deadline = time.time() + 0.5
        while time.time() < deadline:
            with self._frame_lock:
                if self._latest_rgb_frame is not None:
                    return self._latest_rgb_frame.copy()
            time.sleep(0.05)  # 50ms待機
        return None
    
    def stop(self):
        """
        カメラを停止（アプリ終了時にのみ呼ぶ）
        
        注意: ページ遷移時は呼ばない。アプリ終了時のみ。
        """
        print("[CameraManager] カメラ停止開始")
        
        # キャプチャスレッドを停止
        self._capture_stop_event.set()
        if self._capture_thread and self._capture_thread.is_alive():
            self._capture_thread.join(timeout=2.0)
        self._capture_thread = None
        self._capture_running = False
        
        # ストリームを停止
        with self._stream_lock:
            if self._depth_stream:
                try:
                    self._depth_stream.stop()
                except:
                    pass
                self._depth_stream = None
            
            if self._rgb_stream:
                try:
                    self._rgb_stream.stop()
                except:
                    pass
                self._rgb_stream = None
        
        print("[CameraManager] カメラ停止完了")
    
    def unload(self):
        """
        OpenNIをアンロード（アプリ終了時にのみ呼ぶ）
        
        注意: stop()の後に呼ぶこと。
        """
        print("[CameraManager] OpenNIアンロード開始")
        
        with self._stream_lock:
            if self._device:
                try:
                    close = getattr(self._device, 'close', None)
                    if callable(close):
                        close()
                except:
                    pass
                self._device = None
            
            if openni2.is_initialized():
                try:
                    openni2.unload()
                except:
                    pass
            
            self._camera_initialized = False
        
        # フレームバッファをクリア
        with self._frame_lock:
            self._latest_depth_frame = None
            self._latest_rgb_frame = None
        
        print("[CameraManager] OpenNIアンロード完了")
    
    def cleanup(self):
        """
        完全なクリーンアップ（アプリ終了時にのみ呼ぶ）
        
        注意: stop() → unload() の順で呼ぶ。
        """
        print("[CameraManager] 完全なクリーンアップ開始")
        self.stop()
        self.unload()
        print("[CameraManager] 完全なクリーンアップ完了")

# グローバルなカメラマネージャーインスタンス（シングルトン）
print(f"[camera_manager.py] モジュールレベルでCameraManager()を呼び出し")
camera_manager = CameraManager()
print(f"[camera_manager.py] インスタンス化完了: インスタンスID={id(camera_manager)}")
