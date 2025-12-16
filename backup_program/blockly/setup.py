#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Blockly開発環境のセットアップスクリプト
他環境での展開を簡単にするためのスクリプト
"""
import os
import urllib.request
import sys

# Blocklyの必要なファイルのURL
BLOCKLY_VERSION = "11.1.1"
BLOCKLY_FILES = [
    f"https://unpkg.com/blockly@{BLOCKLY_VERSION}/blockly.min.js",
    f"https://unpkg.com/blockly@{BLOCKLY_VERSION}/blockly_compressed.js",
    f"https://unpkg.com/blockly@{BLOCKLY_VERSION}/blocks_compressed.js",
    f"https://unpkg.com/blockly@{BLOCKLY_VERSION}/javascript_compressed.js",
    f"https://unpkg.com/blockly@{BLOCKLY_VERSION}/python_compressed.js",
    f"https://unpkg.com/blockly@{BLOCKLY_VERSION}/msg/ja.js",
    f"https://unpkg.com/blockly@{BLOCKLY_VERSION}/msg/en.js",
]

def download_blockly_files():
    """Blocklyファイルをダウンロード"""
    target_dir = os.path.join("static", "js", "blockly_compiled")
    msg_dir = os.path.join(target_dir, "msg")
    
    # ディレクトリ作成
    os.makedirs(target_dir, exist_ok=True)
    os.makedirs(msg_dir, exist_ok=True)
    
    print("Blocklyファイルをダウンロード中...")
    
    for url in BLOCKLY_FILES:
        filename = url.split("/")[-1]
        
        # msg/配下のファイルの場合
        if "/msg/" in url:
            filepath = os.path.join(msg_dir, filename)
        else:
            filepath = os.path.join(target_dir, filename)
        
        # 既に存在する場合はスキップ
        if os.path.exists(filepath):
            print(f"  スキップ: {filename} (既に存在)")
            continue
        
        try:
            print(f"  ダウンロード中: {filename}")
            urllib.request.urlretrieve(url, filepath)
            print(f"  完了: {filename}")
        except Exception as e:
            print(f"  エラー: {filename} - {e}")
            return False
    
    print("\nBlocklyファイルのダウンロードが完了しました！")
    return True

def main():
    """メイン処理"""
    print("=" * 60)
    print("Blockly開発環境セットアップ")
    print("=" * 60)
    print()
    
    # カレントディレクトリの確認
    if not os.path.exists("app.py"):
        print("エラー: このスクリプトはプロジェクトのルートディレクトリで実行してください")
        sys.exit(1)
    
    # Blocklyファイルのダウンロード
    if not download_blockly_files():
        print("\nエラー: セットアップに失敗しました")
        sys.exit(1)
    
    print("\n" + "=" * 60)
    print("セットアップ完了！")
    print("=" * 60)
    print("\n次のコマンドでアプリケーションを起動できます:")
    print("  python app.py")
    print("\nブラウザで http://localhost:5000 にアクセスしてください")

if __name__ == "__main__":
    main()
