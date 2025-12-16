#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Blocklyビルド済みファイルダウンロードスクリプト
npmを使わずにBlocklyをセットアップ
"""
import os
import urllib.request
import sys
import tarfile
import shutil

BLOCKLY_VERSION = "11.1.1"
BLOCKLY_TGZ_URL = f"https://registry.npmjs.org/blockly/-/blockly-{BLOCKLY_VERSION}.tgz"

def download_and_extract():
    """Blocklyをダウンロードして展開"""
    temp_file = "blockly_temp.tgz"
    temp_dir = "temp_blockly"
    target_dir = os.path.join("static", "js", "blockly", "build")
    
    print("=" * 60)
    print("Blocklyビルド済みファイルのダウンロード")
    print("=" * 60)
    print()
    
    try:
        # ダウンロード
        print(f"ダウンロード中: blockly@{BLOCKLY_VERSION}")
        urllib.request.urlretrieve(BLOCKLY_TGZ_URL, temp_file)
        print("✓ ダウンロード完了")
        
        # 展開
        print("展開中...")
        with tarfile.open(temp_file, 'r:gz') as tar:
            tar.extractall(temp_dir)
        print("✓ 展開完了")
        
        # buildディレクトリ作成
        os.makedirs(target_dir, exist_ok=True)
        
        # ファイルをコピー
        print("ファイルをコピー中...")
        package_dir = os.path.join(temp_dir, "package")
        
        # 圧縮ファイルをコピー
        files_to_copy = [
            "blockly_compressed.js",
            "blocks_compressed.js",
            "javascript_compressed.js",
            "python_compressed.js",
        ]
        
        for filename in files_to_copy:
            src = os.path.join(package_dir, filename)
            dst = os.path.join(target_dir, filename)
            if os.path.exists(src):
                shutil.copy2(src, dst)
                print(f"  ✓ {filename}")
        
        # msgディレクトリをコピー
        msg_src = os.path.join(package_dir, "msg")
        msg_dst = os.path.join(target_dir, "msg")
        if os.path.exists(msg_dst):
            shutil.rmtree(msg_dst)
        shutil.copytree(msg_src, msg_dst)
        print(f"  ✓ msg/ (メッセージファイル)")
        
        # ローダーファイルを作成
        print("ローダーファイルを作成中...")
        create_loaders(target_dir)
        print("✓ ローダーファイル作成完了")
        
        # クリーンアップ
        os.remove(temp_file)
        shutil.rmtree(temp_dir)
        
        print()
        print("=" * 60)
        print("セットアップ完了！")
        print("=" * 60)
        return True
        
    except Exception as e:
        print(f"\nエラー: {e}")
        # クリーンアップ
        if os.path.exists(temp_file):
            os.remove(temp_file)
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        return False

def create_loaders(build_dir):
    """ES modulesローダーを作成"""
    
    # blockly.loader.mjs
    blockly_loader = os.path.join(build_dir, "blockly.loader.mjs")
    with open(blockly_loader, 'w', encoding='utf-8') as f:
        f.write('''// Blockly ES module loader
const script = document.createElement('script');
script.src = new URL('./blockly_compressed.js', import.meta.url).pathname.substring(1);
document.head.appendChild(script);

await new Promise(resolve => {
  script.onload = resolve;
});

export default window.Blockly;
export const Blockly = window.Blockly;
''')
    
    # blocks.loader.mjs
    blocks_loader = os.path.join(build_dir, "blocks.loader.mjs")
    with open(blocks_loader, 'w', encoding='utf-8') as f:
        f.write('''// Blocks ES module loader
const script = document.createElement('script');
script.src = new URL('./blocks_compressed.js', import.meta.url).pathname.substring(1);
document.head.appendChild(script);

await new Promise(resolve => {
  script.onload = resolve;
});
''')
    
    # javascript.loader.mjs
    js_loader = os.path.join(build_dir, "javascript.loader.mjs")
    with open(js_loader, 'w', encoding='utf-8') as f:
        f.write('''// JavaScript generator ES module loader
const script = document.createElement('script');
script.src = new URL('./javascript_compressed.js', import.meta.url).pathname.substring(1);
document.head.appendChild(script);

await new Promise(resolve => {
  script.onload = resolve;
});

export const javascriptGenerator = window.Blockly.JavaScript;
''')

def main():
    if not os.path.exists("app.py"):
        print("エラー: プロジェクトルートディレクトリで実行してください")
        sys.exit(1)
    
    if not download_and_extract():
        print("\nセットアップに失敗しました")
        sys.exit(1)
    
    print("\n次のコマンドでアプリを起動:")
    print("  python app.py")
    print("\nブラウザで http://localhost:5000 にアクセスしてください")

if __name__ == "__main__":
    main()
