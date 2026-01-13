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

class CameraManager:
    """統一されたカメラリソース管理クラス"""
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(CameraManager, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if not hasattr(self, '_initialized') or not self._initialized:
            self._device = None
            self._depth_stream = None
            self._rgb_stream = None
            self._camera_initialized = False
            self._stream_lock = threading.Lock()
            self._missing_path_logged = False
            self._openni_path = OPENNI_PATH
            self._capture_thread: Optional[threading.Thread] = None
            self._capture_stop_event = threading.Event()
            self._capture_thread_lock = threading.Lock()
            self._frame_lock = threading.Lock()
            self._frame_condition = threading.Condition(self._frame_lock)
            self._latest_depth_frame = None
            self._latest_rgb_frame = None
            self._need_depth = False
            self._need_rgb = False
            self._last_capture_error_logged_at = 0.0
            self._stream_in_use_retry_count = 0
            self._max_stream_in_use_retries = 20  # 最大20回（約10秒）待機
            self._streams_shared = False  # ストリームが共有されているかどうか
            self._last_stream_reset_time = 0.0  # 最後にストリームをリセットした時刻
            self._initialized = True
    
    ##前のバージョン(OPENNIマニュアル参照前)###
    def _initialize_camera(self):
        """
        カメラを初期化（ストリーム再利用を優先）
        
        ストリームが既に使用中の場合、待機してから再試行します。
        これは、ページが開いている間のストリームとFlow実行時のストリームを
        同じインスタンスで共有するためです。
        """
        # 既に正しく初期化されている場合は成功
        # ただし、必要なストリームが存在することを確認
        if self._camera_initialized:
            # RGBが必要な場合、RGBストリームが存在することを確認
            if self._need_rgb and self._rgb_stream is None:
                # RGBが必要だがストリームが存在しない場合は再初期化
                self._camera_initialized = False
            # Depthが必要な場合、Depthストリームが存在することを確認
            elif self._need_depth and self._depth_stream is None:
                # Depthが必要だがストリームが存在しない場合は再初期化
                self._camera_initialized = False
            # 両方のストリームが存在する場合は成功
            elif self._depth_stream is not None and self._rgb_stream is not None:
                self._stream_in_use_retry_count = 0  # リトライカウントをリセット
                return True
            # Depthのみが必要で、Depthストリームが存在する場合は成功
            elif not self._need_rgb and self._need_depth and self._depth_stream is not None:
                self._stream_in_use_retry_count = 0
                return True
        
        # _camera_initializedがFalseでも、必要なストリームが存在する場合は初期化済みとみなす
        # これは、ストリームが既に存在するが、フラグがリセットされた場合に対応するため
            if not self._camera_initialized:
                # Depthのみが必要で、Depthストリームが存在する場合
                if not self._need_rgb and self._need_depth and self._depth_stream is not None:
                    self._camera_initialized = True
                    self._stream_in_use_retry_count = 0
                    print("[カメラ再接続成功] 深度ストリームが既に存在するため、初期化フラグを立てました（Depthのみ）")
                    print(f"[カメラ状態] _depth_stream={self._depth_stream is not None}, "
                          f"_rgb_stream={self._rgb_stream is not None}, "
                          f"_need_depth={self._need_depth}, _need_rgb={self._need_rgb}")
                    return True
                # 両方のストリームが存在する場合
                elif self._depth_stream is not None and self._rgb_stream is not None:
                    self._camera_initialized = True
                    self._stream_in_use_retry_count = 0
                    print("[カメラ再接続成功] ストリームが既に存在するため、初期化フラグを立てました")
                    print(f"[カメラ状態] _depth_stream={self._depth_stream is not None}, "
                          f"_rgb_stream={self._rgb_stream is not None}, "
                          f"_need_depth={self._need_depth}, _need_rgb={self._need_rgb}")
                    return True

        with self._stream_lock:
            # 二重チェック
            if self._camera_initialized:
                # RGBが必要な場合、RGBストリームが存在することを確認
                if self._need_rgb and self._rgb_stream is None:
                    self._camera_initialized = False
                # Depthが必要な場合、Depthストリームが存在することを確認
                elif self._need_depth and self._depth_stream is None:
                    self._camera_initialized = False
                # 両方のストリームが存在する場合は成功
                elif self._depth_stream is not None and self._rgb_stream is not None:
                    self._stream_in_use_retry_count = 0
                    return True
                # Depthのみが必要で、Depthストリームが存在する場合は成功
                elif not self._need_rgb and self._need_depth and self._depth_stream is not None:
                    self._stream_in_use_retry_count = 0
                    return True
            
            # _camera_initializedがFalseでも、必要なストリームが存在する場合は初期化済みとみなす
            if not self._camera_initialized:
                # Depthのみが必要で、Depthストリームが存在する場合
                if not self._need_rgb and self._need_depth and self._depth_stream is not None:
                    self._camera_initialized = True
                    self._stream_in_use_retry_count = 0
                    print("[カメラ再接続成功] 深度ストリームが既に存在するため、初期化フラグを立てました（Depthのみ、ロック内）")
                    print(f"[カメラ状態] _depth_stream={self._depth_stream is not None}, "
                          f"_rgb_stream={self._rgb_stream is not None}, "
                          f"_need_depth={self._need_depth}, _need_rgb={self._need_rgb}")
                    return True
                # 両方のストリームが存在する場合
                elif self._depth_stream is not None and self._rgb_stream is not None:
                    self._camera_initialized = True
                    self._stream_in_use_retry_count = 0
                    print("[カメラ再接続成功] ストリームが既に存在するため、初期化フラグを立てました（ロック内）")
                    print(f"[カメラ状態] _depth_stream={self._depth_stream is not None}, "
                          f"_rgb_stream={self._rgb_stream is not None}, "
                          f"_need_depth={self._need_depth}, _need_rgb={self._need_rgb}")
                    return True

            if not self._openni_path:
                if not self._missing_path_logged:
                    print('カメラ初期化をスキップしました: OPENNI_PATH が未設定です')
                    self._missing_path_logged = True
                return False
            
            # デバイスの初期化
            if self._device is None:
                try:
                    if not openni2.is_initialized():
                        openni2.initialize(self._openni_path)
                    self._device = openni2.Device.open_any()
                except Exception as e:
                    print(f"デバイスオープンエラー: {e}")
                    return False
            
            # ストリームの初期化を試みる
            try:
                # 深度ストリームの初期化
                if self._depth_stream is None:
                    try:
                        self._depth_stream = self._device.create_depth_stream()
                        self._depth_stream.set_video_mode(c_api.OniVideoMode(
                            pixelFormat=c_api.OniPixelFormat.ONI_PIXEL_FORMAT_DEPTH_100_UM,
                            resolutionX=640,
                            resolutionY=480,
                            fps=30
                        ))
                        self._depth_stream.start()
                        print("[カメラ初期化成功] 深度ストリームを開始しました")
                        self._stream_in_use_retry_count = 0  # 成功したらリトライカウントをリセット
                    except Exception as e:
                        error_str = str(e)
                        if 'open by other components' in error_str or 'OUT_OF_FLOW' in error_str:
                            # ストリームが既に使用中の場合、既存のストリームを共有する
                            print(f"深度ストリームが既に使用中です。既存のストリームを共有します: {e}")
                            # ストリームが使用中の場合、既存のストリームを使用することを想定
                            self._streams_shared = True
                            # ストリームの作成をスキップ（既存のストリームを使用）
                            pass
                        else:
                            raise
                else:
                    print("深度ストリームは既に開始されています")
                
                # RGBストリームの初期化
                if self._rgb_stream is None:
                    try:
                        self._rgb_stream = self._device.create_color_stream()
                        self._rgb_stream.set_video_mode(c_api.OniVideoMode(
                            pixelFormat=c_api.OniPixelFormat.ONI_PIXEL_FORMAT_RGB888,
                            resolutionX=640,
                            resolutionY=480,
                            fps=30
                        ))
                        self._rgb_stream.start()
                        print("[カメラ初期化成功] RGBストリームを開始しました")
                        self._stream_in_use_retry_count = 0  # 成功したらリトライカウントをリセット
                    except Exception as e:
                        error_str = str(e)
                        if 'open by other components' in error_str or 'OUT_OF_FLOW' in error_str:
                            # ストリームが既に使用中の場合、既存のストリームを共有する
                            print(f"RGBストリームが既に使用中です。既存のストリームを共有します: {e}")
                            # ストリームが使用中の場合、既存のストリームを使用することを想定
                            self._streams_shared = True
                            # ストリームの作成をスキップ（既存のストリームを使用）
                            pass
                        else:
                            raise
                else:
                    print("RGBストリームは既に開始されています")
                
                # ストリームが共有されている場合、既存のストリームを使用する
                # ただし、実際にストリームが存在し、読み取れることを確認する必要がある
                if self._streams_shared:
                    # ストリームが使用中の場合、既存のストリームを使用することを想定
                    # ただし、必要なストリームが存在することを確認
                    if (self._need_rgb and self._rgb_stream is None) or (self._need_depth and self._depth_stream is None):
                        # 必要なストリームが存在しない場合は失敗
                        print("ストリーム共有フラグがTrueだが、必要なストリームが存在しないため、共有を解除します")
                        self._streams_shared = False
                        return False
                    # ストリームが存在する場合でも、実際に読み取れるかは_capture_loopで確認される
                    # ここでは、ストリームが存在することを確認するだけ
                    self._camera_initialized = True
                    self._stream_in_use_retry_count = 0
                    print("[カメラ初期化成功] 統一カメラシステムを初期化しました（既存のストリームを共有）")
                    print(f"[カメラ状態] _depth_stream={self._depth_stream is not None}, "
                          f"_rgb_stream={self._rgb_stream is not None}, "
                          f"_need_depth={self._need_depth}, _need_rgb={self._need_rgb}")
                    return True
                
                # 必要なストリームが正しく初期化された場合のみ成功
                # RGBが必要な場合、RGBストリームが存在することを確認
                if self._need_rgb and self._rgb_stream is None:
                    return False
                # Depthが必要な場合、Depthストリームが存在することを確認
                if self._need_depth and self._depth_stream is None:
                    return False
                
                # 両方のストリームが正しく初期化された場合
                if self._depth_stream is not None and self._rgb_stream is not None:
                    self._camera_initialized = True
                    self._stream_in_use_retry_count = 0  # リトライカウントをリセット
                    print("[カメラ初期化成功] 統一カメラシステムを初期化しました（RGB+Depth）")
                    print(f"[カメラ状態] _depth_stream={self._depth_stream is not None}, "
                          f"_rgb_stream={self._rgb_stream is not None}, "
                          f"_need_depth={self._need_depth}, _need_rgb={self._need_rgb}")
                    return True
                # Depthのみが必要で、Depthストリームが存在する場合
                elif not self._need_rgb and self._need_depth and self._depth_stream is not None:
                    self._camera_initialized = True
                    self._stream_in_use_retry_count = 0
                    print("[カメラ初期化成功] 統一カメラシステムを初期化しました（Depthのみ）")
                    print(f"[カメラ状態] _depth_stream={self._depth_stream is not None}, "
                          f"_rgb_stream={self._rgb_stream is not None}, "
                          f"_need_depth={self._need_depth}, _need_rgb={self._need_rgb}")
                    return True
                else:
                    return False
                    
            except Exception as e:
                error_str = str(e)
                print(f"カメラ初期化エラー: {e}")
                # ストリームが使用中の場合、後で再試行
                if 'open by other components' in error_str or 'OUT_OF_FLOW' in error_str:
                    self._stream_in_use_retry_count += 1
                    if self._stream_in_use_retry_count >= self._max_stream_in_use_retries:
                        print(f"ストリーム初期化を諦めます（{self._max_stream_in_use_retries}回試行）")
                    return False
                else:
                    return False


 
    ###OPENNIマニュアルを参考にgeminiで書いたコード
    # def _initialize_camera(self):
    #     """
    #     カメラとデバイス設定を初期化（マニュアル推奨設定の統合）
    #     """
    #     with self._stream_lock:
    #         # すでに初期化済みでストリームが生存しているか確認
    #         if self._camera_initialized and self._device:
    #             streams_ready = True
    #             if self._need_depth and self._depth_stream is None: streams_ready = False
    #             if self._need_rgb and self._rgb_stream is None: streams_ready = False
    #             if streams_ready:
    #                 return True

    #         if not self._openni_path:
    #             return False

    #         try:
    #             # 1. OpenNIの初期化 [cite: 31, 33]
    #             if not openni2.is_initialized():
    #                 openni2.initialize(self._openni_path)

    #             # 2. デバイスのオープン [cite: 82, 86]
    #             if self._device is None:
    #                 self._device = openni2.Device.open_any()

    #             # 3. 深度ストリームの設定 [cite: 198, 204, 205]
    #             if self._depth_stream is None:
    #                 self._depth_stream = self._device.create_depth_stream()
    #                 self._depth_stream.set_video_mode(c_api.OniVideoMode(
    #                     pixelFormat=c_api.OniPixelFormat.ONI_PIXEL_FORMAT_DEPTH_100_UM,
    #                     resolutionX=640, resolutionY=480, fps=30
    #                 ))
    #                 self._depth_stream.start()

    #             # 4. RGBストリームの設定 [cite: 108, 204, 205]
    #             if self._rgb_stream is None:
    #                 self._rgb_stream = self._device.create_color_stream()
    #                 self._rgb_stream.set_video_mode(c_api.OniVideoMode(
    #                     pixelFormat=c_api.OniPixelFormat.ONI_PIXEL_FORMAT_RGB888,
    #                     resolutionX=640, resolutionY=480, fps=30
    #                 ))
    #                 self._rgb_stream.start()

    #             # --- マニュアル推奨の同期・補正設定 ---
    #             # 注意: Pythonラッパーでは、一部のAPIが利用できない可能性があります

    #             # 5. 画像登録（Registration）の設定
    #             # 深度マップをRGBの視点に合わせ、データの整合性を高める
    #             try:
    #                 # Pythonラッパーでの画像登録設定（利用可能な場合）
    #                 if hasattr(self._device, 'is_image_registration_mode_supported'):
    #                     if self._device.is_image_registration_mode_supported(c_api.OniImageRegistrationMode.ONI_IMAGE_REGISTRATION_DEPTH_TO_IMAGE):
    #                         if hasattr(self._device, 'set_image_registration_mode'):
    #                             self._device.set_image_registration_mode(c_api.OniImageRegistrationMode.ONI_IMAGE_REGISTRATION_DEPTH_TO_IMAGE)
    #                             print("[カメラ初期化成功] Image registration (Depth to RGB) enabled.")
    #             except Exception as e:
    #                 print(f"[カメラ初期化] 画像登録設定をスキップしました: {e}")

    #             # 6. フレーム同期（FrameSync）の設定
    #             # RGBとDepthのフレーム到着タイミングをハードウェアレベルで一致させる
    #             try:
    #                 # Pythonラッパーでのフレーム同期設定（利用可能な場合）
    #                 if hasattr(self._device, 'set_depth_color_sync_enabled'):
    #                     self._device.set_depth_color_sync_enabled(True)
    #                     print("[カメラ初期化成功] Hardware FrameSync enabled.")
    #             except Exception as e:
    #                 print(f"[カメラ初期化] フレーム同期設定をスキップしました: {e}")

    #             self._camera_initialized = True
    #             return True

    #         except Exception as e:
    #             # Pythonラッパーでは、get_extended_error()は利用できない可能性がある
    #             # 例外メッセージから詳細を取得
    #             error_str = str(e)
    #             print(f"[カメラ初期化エラー] {error_str}")
    #             # ストリームが使用中の場合の詳細情報
    #             if 'open by other components' in error_str or 'OUT_OF_FLOW' in error_str:
    #                 print(f"[カメラ初期化エラー] ストリームが既に使用中です。既存のストリームを共有します")
    #                 self._streams_shared = True
    #                 # ストリームが使用中でも、既存のストリームを使用することを想定
    #                 if (self._need_depth and self._depth_stream is not None) or (self._need_rgb and self._rgb_stream is not None):
    #                     self._camera_initialized = True
    #                     print("[カメラ初期化成功] 既存のストリームを使用します")
    #                     return True
    #             return False
                    
    def _reset_streams_locked(self):
        """ストリームを停止して破棄"""
        if self._depth_stream:
            try:
                self._depth_stream.stop()
            except Exception:
                pass
            self._depth_stream = None

        if self._rgb_stream:
            try:
                self._rgb_stream.stop()
            except Exception:
                pass
            self._rgb_stream = None

    def _reset_device(self):
        """デバイスを完全にリセット"""
        with self._frame_condition:
            self._latest_depth_frame = None
            self._latest_rgb_frame = None

        with self._stream_lock:
            self._reset_streams_locked()

            if self._device:
                try:
                    close = getattr(self._device, 'close', None)
                    if callable(close):
                        close()
                except Exception:
                    pass
                self._device = None

            if self._camera_initialized:
                self._camera_initialized = False
                self._missing_path_logged = False

        time.sleep(0.1)

    def _handle_capture_failure(self, capture_error: Exception):
        """
        キャプチャエラーの処理
        
        ストリームが使用中の場合、リセットせずに再試行します。
        これは、ストリームを再利用するためです。
        """
        now = time.time()
        error_str = str(capture_error)
        
        # OUT_OF_FLOWエラーはストリーム競合
        # ストリームを再利用するため、リセットせずに再初期化を試みる
        if 'OUT_OF_FLOW' in error_str or 'open by other components' in error_str:
            if now - self._last_capture_error_logged_at > 5.0:
                print(f"カメラストリーム競合検知（再試行します）: {capture_error}")
                self._last_capture_error_logged_at = now
            # ストリームがNoneの場合のみリセット（既存のストリームを破壊しない）
            with self._stream_lock:
                if self._depth_stream is None or self._rgb_stream is None:
                    # ストリームが正しく初期化されていない場合のみリセット
                    print("ストリームがNoneのため、再初期化します")
                    self._reset_streams_locked()
                    self._camera_initialized = False
                else:
                    # ストリームが存在する場合は、単に再初期化フラグを立てる
                    # （既存のストリームはそのまま使用）
                    print("ストリームが存在するため、再初期化フラグを立てます")
                    self._camera_initialized = False
            return
        
        # その他の深刻なエラーの場合のみログとリセット
        if now - self._last_capture_error_logged_at > 1.0:
            print(f"カメラキャプチャエラー: {capture_error}")
            self._last_capture_error_logged_at = now
        
        # 深刻なエラーの場合のみリセット（AttributeErrorなど、ストリームがNoneの場合を除く）
        if 'NoneType' not in error_str and 'AttributeError' not in error_str:
            self._reset_device()
        else:
            # ストリームがNoneの場合は、単に再初期化を試みる
            with self._stream_lock:
                self._camera_initialized = False

    def _ensure_capture_thread(self):
        if self._capture_thread and self._capture_thread.is_alive():
            return True

        with self._capture_thread_lock:
            if self._capture_thread and self._capture_thread.is_alive():
                return True

            self._capture_stop_event.clear()
            thread = threading.Thread(
                target=self._capture_loop,
                name='CameraCaptureThread',
                daemon=True
            )
            self._capture_thread = thread
            thread.start()
            return True

    ###前前のバージョン(OPENNIマニュアル参照前)###
    def _capture_loop(self):
        """
        OpenNI へアクセスする専用スレッド
        
        ストリームを再利用し、ページが開いている間のストリームと
        Flow実行時のストリームを同じインスタンスで共有します。
        """
        while not self._capture_stop_event.is_set():
            if not self._initialize_camera():
                # 初期化に失敗した場合、ストリームが使用中かもしれないので待機
                # ストリームが使用中の場合、0.5秒待機してから再試行
                time.sleep(0.5)
                continue

            try:
                with self._stream_lock:
                    # 常に両方のストリームを使用（再利用）
                    depth_stream = self._depth_stream
                    rgb_stream = self._rgb_stream
                    
                    # ストリームが存在するが、初期化フラグが立っていない場合は立てる
                    if not self._camera_initialized:
                        # Depthのみが必要で、Depthストリームが存在する場合
                        if not self._need_rgb and self._need_depth and depth_stream is not None:
                            self._camera_initialized = True
                            print("[カメラ再接続成功] _capture_loop: 深度ストリームが存在するため、初期化フラグを立てました")
                            print(f"[カメラ状態] depth_stream={depth_stream is not None}, "
                                  f"rgb_stream={rgb_stream is not None}, "
                                  f"_need_depth={self._need_depth}, _need_rgb={self._need_rgb}")
                        # 両方のストリームが存在する場合
                        elif depth_stream is not None and rgb_stream is not None:
                            self._camera_initialized = True
                            print("[カメラ再接続成功] _capture_loop: ストリームが存在するため、初期化フラグを立てました")
                            print(f"[カメラ状態] depth_stream={depth_stream is not None}, "
                                  f"rgb_stream={rgb_stream is not None}, "
                                  f"_need_depth={self._need_depth}, _need_rgb={self._need_rgb}")

                # ストリームがNoneの場合の処理
                # 必要なストリームが存在することを確認
                need_depth_stream = self._need_depth and depth_stream is None
                need_rgb_stream = self._need_rgb and rgb_stream is None
                
                if need_depth_stream or need_rgb_stream:
                    # 必要なストリームが存在しない場合、再初期化を試みる
                    print(f"ストリームがNoneのため、再初期化を試みます (need_depth={self._need_depth}, need_rgb={self._need_rgb})")
                    self._camera_initialized = False
                    self._streams_shared = False
                    # 初期化を試みる
                    if not self._initialize_camera():
                        time.sleep(0.5)
                        continue
                    # 初期化が成功したら、ストリームを再取得
                    with self._stream_lock:
                        depth_stream = self._depth_stream
                        rgb_stream = self._rgb_stream
                    print(f"[カメラ再接続成功] ストリームの再初期化が完了しました "
                          f"(depth_stream={depth_stream is not None}, rgb_stream={rgb_stream is not None})")
                    continue
                
                # ストリームがNoneだが、必要ない場合はスキップ
                if depth_stream is None and rgb_stream is None:
                    # 両方のストリームがNoneで、どちらも必要ない場合は待機
                    if not self._need_depth and not self._need_rgb:
                        time.sleep(0.5)
                        continue
                    # どちらかが必要な場合は再初期化
                    print("ストリームがNoneのため、再初期化を試みます")
                    self._camera_initialized = False
                    self._streams_shared = False
                    # 初期化を試みる
                    if not self._initialize_camera():
                        time.sleep(0.5)
                        continue
                    # 初期化が成功したら、ストリームを再取得
                    with self._stream_lock:
                        depth_stream = self._depth_stream
                        rgb_stream = self._rgb_stream
                    print(f"[カメラ再接続成功] ストリームの再初期化が完了しました "
                          f"(depth_stream={depth_stream is not None}, rgb_stream={rgb_stream is not None})")
                    continue

                # ストリームのロックを解放してからフレームを読む
                if depth_stream and self._need_depth:
                    try:
                        depth_frame = depth_stream.read_frame()
                        if depth_frame is not None:
                            depth_data = depth_frame.get_buffer_as_uint16()
                            depth_array = np.frombuffer(depth_data, dtype=np.uint16).reshape((480, 640)).copy()
                            with self._frame_condition:
                                # フレームが更新されたことを記録（再接続成功の確認）
                                was_none = self._latest_depth_frame is None
                                self._latest_depth_frame = depth_array
                                self._frame_condition.notify_all()
                                # 再接続成功をログに記録
                                if was_none:
                                    print("[カメラ再接続成功] 深度フレームの取得を再開しました")
                        else:
                            # フレームが取得できなかった場合もエラー扱い
                            raise Exception("Depth frame read failed: frame is None")
                    except Exception as e:
                        error_str = str(e)
                        # OUT_OF_FLOWエラーの場合、ストリームをリセットせずに再試行
                        if 'OUT_OF_FLOW' in error_str or 'open by other components' in error_str:
                            print(f"[カメラエラー] 深度ストリーム読み取りエラー（再試行）: {e}")
                            print(f"[カメラ状態] _camera_initialized={self._camera_initialized}, "
                                  f"_depth_stream={depth_stream is not None}, "
                                  f"_streams_shared={self._streams_shared}, "
                                  f"_need_depth={self._need_depth}")
                            # ストリーム共有フラグをリセット（ストリームが実際には使用できない可能性がある）
                            if self._streams_shared:
                                print("[カメラ状態変更] ストリーム共有フラグをリセットします（ストリームが使用できないため）")
                                self._streams_shared = False
                                self._camera_initialized = False
                            time.sleep(0.3)
                            continue
                        else:
                            print(f"[カメラエラー] 深度ストリーム読み取りエラー（深刻）: {e}")
                            raise

                if rgb_stream and self._need_rgb:
                    try:
                        rgb_frame = rgb_stream.read_frame()
                        if rgb_frame is not None:
                            rgb_data = rgb_frame.get_buffer_as_uint8()
                            bgr = np.frombuffer(rgb_data, dtype=np.uint8).reshape(480, 640, 3).copy()
                            rgb_array = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                            with self._frame_condition:
                                # フレームが更新されたことを記録（再接続成功の確認）
                                was_none = self._latest_rgb_frame is None
                                self._latest_rgb_frame = rgb_array
                                self._frame_condition.notify_all()
                                # 再接続成功をログに記録
                                if was_none:
                                    print("[カメラ再接続成功] RGBフレームの取得を再開しました")
                        else:
                            # フレームが取得できなかった場合もエラー扱い
                            raise Exception("RGB frame read failed: frame is None")
                    except Exception as e:
                        error_str = str(e)
                        # OUT_OF_FLOWエラーの場合、ストリームをリセットせずに再試行
                        if 'OUT_OF_FLOW' in error_str or 'open by other components' in error_str:
                            print(f"[カメラエラー] RGBストリーム読み取りエラー（再試行）: {e}")
                            print(f"[カメラ状態] _camera_initialized={self._camera_initialized}, "
                                  f"_rgb_stream={rgb_stream is not None}, "
                                  f"_streams_shared={self._streams_shared}, "
                                  f"_need_rgb={self._need_rgb}")
                            time.sleep(0.3)
                            continue
                        else:
                            print(f"[カメラエラー] RGBストリーム読み取りエラー（深刻）: {e}")
                            raise

                # 30fps を上限にする程度の待機
                time.sleep(0.01)

            except Exception as capture_error:
                self._handle_capture_failure(capture_error)
                time.sleep(0.3)
    
# _capture_loop メソッドを以下のように刷新することをお勧めします

    ###OPENNIマニュアルを参考にgeminiで書いたコード
    # def _capture_loop(self):
    #     """
    #     OpenNI へアクセスする専用スレッド (改善版)
        
    #     Pythonラッパーでは、wait_for_any_stream()は利用できないため、
    #     各ストリームから直接read_frame()を呼び出します。
    #     """
    #     while not self._capture_stop_event.is_set():
    #         if not self._initialize_camera():
    #             time.sleep(0.5)
    #             continue

    #         try:
    #             with self._stream_lock:
    #                 # ストリームの参照を取得
    #                 depth_stream = self._depth_stream
    #                 rgb_stream = self._rgb_stream

    #             # ストリームが存在しない場合は待機
    #             if depth_stream is None and rgb_stream is None:
    #                 time.sleep(0.5)
    #                 continue

    #             # 深度データの処理（必要な場合）
    #             if depth_stream and self._need_depth:
    #                 try:
    #                     depth_frame = depth_stream.read_frame()
    #                     if depth_frame is not None:
    #                         depth_data = depth_frame.get_buffer_as_uint16()
    #                         depth_array = np.frombuffer(depth_data, dtype=np.uint16).reshape((480, 640)).copy()
    #                         with self._frame_condition:
    #                             # フレームが更新されたことを記録（再接続成功の確認）
    #                             was_none = self._latest_depth_frame is None
    #                             self._latest_depth_frame = depth_array
    #                             self._frame_condition.notify_all()
    #                             # 再接続成功をログに記録
    #                             if was_none:
    #                                 print("[カメラ再接続成功] 深度フレームの取得を再開しました")
    #                     else:
    #                         raise Exception("Depth frame read failed: frame is None")
    #                 except Exception as e:
    #                     error_str = str(e)
    #                     # OUT_OF_FLOWエラーの場合、ストリームをリセットせずに再試行
    #                     if 'OUT_OF_FLOW' in error_str or 'open by other components' in error_str:
    #                         print(f"[カメラエラー] 深度ストリーム読み取りエラー（再試行）: {e}")
    #                         print(f"[カメラ状態] _camera_initialized={self._camera_initialized}, "
    #                               f"_depth_stream={depth_stream is not None}, "
    #                               f"_streams_shared={self._streams_shared}, "
    #                               f"_need_depth={self._need_depth}")
    #                         # ストリーム共有フラグをリセット（ストリームが実際には使用できない可能性がある）
    #                         if self._streams_shared:
    #                             print("[カメラ状態変更] ストリーム共有フラグをリセットします（ストリームが使用できないため）")
    #                             self._streams_shared = False
    #                             self._camera_initialized = False
    #                         time.sleep(0.3)
    #                         continue
    #                     else:
    #                         print(f"[カメラエラー] 深度ストリーム読み取りエラー（深刻）: {e}")
    #                         raise

    #             # RGBデータの処理（必要な場合）
    #             if rgb_stream and self._need_rgb:
    #                 try:
    #                     rgb_frame = rgb_stream.read_frame()
    #                     if rgb_frame is not None:
    #                         rgb_data = rgb_frame.get_buffer_as_uint8()
    #                         bgr = np.frombuffer(rgb_data, dtype=np.uint8).reshape(480, 640, 3).copy()
    #                         rgb_array = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    #                         with self._frame_condition:
    #                             # フレームが更新されたことを記録（再接続成功の確認）
    #                             was_none = self._latest_rgb_frame is None
    #                             self._latest_rgb_frame = rgb_array
    #                             self._frame_condition.notify_all()
    #                             # 再接続成功をログに記録
    #                             if was_none:
    #                                 print("[カメラ再接続成功] RGBフレームの取得を再開しました")
    #                     else:
    #                         raise Exception("RGB frame read failed: frame is None")
    #                 except Exception as e:
    #                     error_str = str(e)
    #                     # OUT_OF_FLOWエラーの場合、ストリームをリセットせずに再試行
    #                     if 'OUT_OF_FLOW' in error_str or 'open by other components' in error_str:
    #                         print(f"[カメラエラー] RGBストリーム読み取りエラー（再試行）: {e}")
    #                         print(f"[カメラ状態] _camera_initialized={self._camera_initialized}, "
    #                               f"_rgb_stream={rgb_stream is not None}, "
    #                               f"_streams_shared={self._streams_shared}, "
    #                               f"_need_rgb={self._need_rgb}")
    #                         time.sleep(0.3)
    #                         continue
    #                     else:
    #                         print(f"[カメラエラー] RGBストリーム読み取りエラー（深刻）: {e}")
    #                         raise

    #             # 30fps を上限にする程度の待機
    #             time.sleep(0.01)

    #         except Exception as capture_error:
    #             # Pythonラッパーでは、get_extended_error()は利用できない可能性がある
    #             # 例外メッセージから詳細を取得
    #             error_str = str(capture_error)
    #             print(f"[カメラエラー] キャプチャエラー: {error_str}")
    #             self._handle_capture_failure(capture_error)
    #             time.sleep(0.3)
                
    ##ここおかしいかも　need_depthがtrueにならない。カメラ状態を監督して実行する運用になっていない
    def get_depth_frame(self):
        """
        深度フレームを取得（Flow実行時用）
        
        Flow実行時は、既存のストリームを共有しようとしますが、
        ストリームが存在しない場合や、フレームが取得できない場合は、
        新しくストリームを初期化します。
        """
        self._need_depth = True
        
        # キャプチャスレッドを開始（ストリームの初期化も行う）
        if not self._ensure_capture_thread():
            print("深度フレーム取得: キャプチャスレッドの開始に失敗しました")
            return None
        
        # ストリームが初期化されるまで少し待機（最大3秒）
        init_deadline = time.time() + 3.0
        while not self._camera_initialized and time.time() < init_deadline:
            time.sleep(0.1)
        
        # ストリームが初期化されていない場合、ストリーム共有フラグをリセットして再試行
        if not self._camera_initialized:
            print("深度フレーム取得: カメラの初期化が完了しませんでした。ストリーム共有フラグをリセットして再試行します")
            self._streams_shared = False
            # 再初期化を試みる
            init_deadline = time.time() + 3.0
            while not self._camera_initialized and time.time() < init_deadline:
                time.sleep(0.1)
            
            if not self._camera_initialized:
                print("深度フレーム取得: 再初期化も失敗しました")
                return None

        # 既存のストリームからフレームを取得（最大5秒待機）
        deadline = time.time() + 5.0
        with self._frame_condition:
            while self._latest_depth_frame is None:
                remaining = deadline - time.time()
                if remaining <= 0:
                    print("深度フレーム取得タイムアウト（ストリームが使用中かもしれません）")
                    # デバッグ情報を出力
                    with self._stream_lock:
                        print(f"デバッグ情報: _camera_initialized={self._camera_initialized}, "
                              f"_depth_stream={self._depth_stream is not None}, "
                              f"_need_depth={self._need_depth}, "
                              f"_streams_shared={self._streams_shared}, "
                              f"_latest_depth_frame={self._latest_depth_frame is not None}")
                    
                    # ストリームが共有されているが、フレームが取得できない場合、
                    # ストリーム共有フラグをリセットして再初期化を試みる
                    if self._streams_shared:
                        print("ストリーム共有フラグがTrueだが、フレームが取得できないため、共有を解除して再初期化を試みます")
                        self._streams_shared = False
                        self._camera_initialized = False
                        # 少し待機してから再試行
                        time.sleep(0.5)
                        # 再初期化を試みる（_capture_loopが自動的に再初期化する）
                        # ここでは、フレームが取得できるまで待機
                        deadline = time.time() + 5.0
                        continue
                    
                    break
                # 0.5秒ごとにチェック（ストリームが使用中の場合、フレームが更新される可能性がある）
                self._frame_condition.wait(timeout=min(remaining, 0.5))
            if self._latest_depth_frame is None:
                return None
            return self._latest_depth_frame.copy()
    
    def get_rgb_frame(self):
        """RGBフレームを取得"""
        self._need_rgb = True
        if not self._ensure_capture_thread():
            return None

        deadline = time.time() + 1.0
        with self._frame_condition:
            while self._latest_rgb_frame is None:
                remaining = deadline - time.time()
                if remaining <= 0:
                    break
                self._frame_condition.wait(timeout=remaining)
            if self._latest_rgb_frame is None:
                return None
            return self._latest_rgb_frame.copy()
    
    def cleanup(self):
        """
        カメラリソースを完全にクリーンアップ
        
        注意: このメソッドはアプリケーション終了時（atexit）にのみ呼ばれるべきです。
        ページ遷移時は、このメソッドを呼ばず、ニーズフラグのみをリセットしてください。
        """
        try:
            print("カメラ完全クリーンアップ開始（アプリケーション終了時）")
            self._need_depth = False
            self._need_rgb = False
            self._capture_stop_event.set()
            if self._capture_thread and self._capture_thread.is_alive():
                self._capture_thread.join(timeout=1.0)
            self._capture_thread = None
            self._capture_stop_event = threading.Event()

            with self._frame_condition:
                self._latest_depth_frame = None
                self._latest_rgb_frame = None

            with self._stream_lock:
                if self._depth_stream:
                    self._depth_stream.stop()
                    self._depth_stream = None

                if self._rgb_stream:
                    self._rgb_stream.stop()
                    self._rgb_stream = None

                if self._camera_initialized:
                    openni2.unload()
                    self._camera_initialized = False
                    self._device = None
                    self._missing_path_logged = False

            print("統一カメラシステムをクリーンアップしました")
        except Exception as e:
            print(f"カメラクリーンアップエラー: {e}")

# グローバルなカメラマネージャーインスタンス
camera_manager = CameraManager()