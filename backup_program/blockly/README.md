# Blockly開発環境

## セットアップ手順

### 1. Pythonパッケージのインストール
```bash
pip install -r requirements.txt
```

### 2. Blocklyのビルド
```bash
cd static/js/blockly
npm install
npm run build
cd ../../..
```

### 3. アプリケーションの起動
```bash
python app.py
```

ブラウザで http://localhost:5000 にアクセスしてください。

## カスタムブロックの作成方法

`static/js/custom_blocks.js` にカスタムブロックを定義できます。

### 基本的な構造：

```javascript
// 1. ブロック定義
Blockly.Blocks['your_block_name'] = {
  init: function() {
    // ブロックの見た目と入出力を定義
  }
};

// 2. コード生成
javascriptGenerator.forBlock['your_block_name'] = function(block, generator) {
  // JavaScriptコードを生成
  return code;
};
```

### サンプルカスタムブロック：
- `custom_my_function` - 独自関数呼び出し
- `custom_api_call` - API呼び出し
- `custom_console_log` - コンソール出力

## 他環境への展開方法

### 方法1：フルビルド（推奨）
1. このディレクトリ全体を他の環境にコピー
2. Node.js/npmがインストールされていることを確認
3. 上記のセットアップ手順を実行

### 方法2：ビルド済み環境
1. セットアップ手順2を実行後、`static/js/blockly/build/` ディレクトリが生成される
2. このディレクトリごとコピーすれば、他環境でnpmは不要
3. Python環境だけで動作可能

## ファイル構成

```
blockly_dev/
├── app.py                          # Flaskアプリケーション
├── requirements.txt                # Python依存パッケージ
├── templates/
│   └── flow.html                  # HTMLテンプレート
├── static/
│   ├── css/
│   │   └── styles.css             # スタイルシート
│   └── js/
│       ├── blockly_init.js        # Blockly初期化
│       ├── custom_blocks.js       # カスタムブロック定義
│       └── blockly/               # Blocklyソース
│           └── build/             # ビルド済みファイル（npm run build後）
```

## 必要要件

- Python 3.8以上
- Node.js 18以上（ビルド時のみ）

## トラブルシューティング

### ビルドエラーの場合
```bash
cd static/js/blockly
rm -rf node_modules
npm install
npm run build
```
