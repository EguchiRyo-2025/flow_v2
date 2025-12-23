import cv2
import numpy as np
from primesense import openni2
from primesense import _openni2 as c_api
import os
import threading
import time
from dotenv import load_dotenv
import asyncio

load_dotenv()
OPENNI_PATH = os.environ['OPENNI_PATH']

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
            self._initialized = True
            self._cleanup_in_progress = False  # クリーンアップ中フラグ
            self._initialize_in_progress = False  # 初期化中フラグ
            self._request_queue = asyncio.Queue()  # 非同期キューを追加
            self._state = "idle"  # カメラの状態: idle, initializing, active, cleaning
    
    async def _initialize_camera(self):
        """非同期でカメラを初期化"""
        if not self._camera_initialized and not self._initialize_in_progress:
            self._initialize_in_progress = True
            try:
                openni2.initialize(OPENNI_PATH)
                self._device = openni2.Device.open_any()
                self._camera_initialized = True
                print("統一カメラシステムを初期化しました")
                return True
            except Exception as e:
                print(f"カメラ初期化エラー: {e}")
                return False
            finally:
                self._initialize_in_progress = False
        return True
    
    def get_depth_frame(self):
        """深度フレームを取得"""
        with self._stream_lock:
            if not self._initialize_camera():
                return None
            
            try:
                if self._depth_stream is None:
                    self._depth_stream = self._device.create_depth_stream()
                    self._depth_stream.set_video_mode(c_api.OniVideoMode(
                        pixelFormat=c_api.OniPixelFormat.ONI_PIXEL_FORMAT_DEPTH_100_UM,
                        resolutionX=640,
                        resolutionY=480,
                        fps=30
                    ))
                    self._depth_stream.start()
                
                frame = self._depth_stream.read_frame()
                frame_data = frame.get_buffer_as_uint16()
                return np.frombuffer(frame_data, dtype=np.uint16).reshape((480, 640))
            
            except Exception as e:
                print(f"深度フレーム取得エラー: {e}")
                return None
    
    def get_rgb_frame(self):
        """RGBフレームを取得"""
        with self._stream_lock:
            if not self._initialize_camera():
                return None
            
            try:
                if self._rgb_stream is None:
                    self._rgb_stream = self._device.create_color_stream()
                    self._rgb_stream.set_video_mode(c_api.OniVideoMode(
                        pixelFormat=c_api.OniPixelFormat.ONI_PIXEL_FORMAT_RGB888,
                        resolutionX=640,
                        resolutionY=480,
                        fps=30
                    ))
                    self._rgb_stream.start()
                
                frame = self._rgb_stream.read_frame()
                frame_data = frame.get_buffer_as_uint8()
                bgr = np.frombuffer(frame_data, dtype=np.uint8).reshape(480, 640, 3)
                return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
            
            except Exception as e:
                print(f"RGBフレーム取得エラー: {e}")
                return None
    
    async def _process_queue(self):
        """非同期キューを処理"""
        while True:
            task = await self._request_queue.get()
            try:
                await task()
            finally:
                self._request_queue.task_done()

    async def initialize_camera(self):
        """カメラを初期化"""
        if self._state != "idle":
            print(f"カメラは現在 {self._state} 状態です。初期化をスキップします。")
            return False

        self._state = "initializing"
        try:
            success = await self._initialize_camera()
            if success:
                self._state = "active"
            else:
                self._state = "idle"
            return success
        finally:
            self._state = "idle"

    async def cleanup(self):
        """カメラリソースをクリーンアップ"""
        if self._state != "active":
            print(f"カメラは現在 {self._state} 状態です。クリーンアップをスキップします。")
            return

        self._state = "cleaning"
        try:
            await self._request_queue.put(self._cleanup_task)
            await self._request_queue.join()  # キューが空になるまで待機
        finally:
            self._state = "idle"

    async def _cleanup_task(self):
        """非同期クリーンアップタスク"""
        with self._stream_lock:
            try:
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
                
                print("統一カメラシステムをクリーンアップしました")
            except Exception as e:
                print(f"カメラクリーンアップエラー: {e}")

# グローバルなカメラマネージャーインスタンス
camera_manager = CameraManager()