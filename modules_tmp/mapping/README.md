# Mapping Module

図形マッピングモジュール

## 初回セットアップ

初めて使用する際は、データベースの初期化が必要です：

```bash
cd modules/mapping
python create_default_data.py
```

これにより以下が実行されます：
- データベーステーブルの作成（projects, groups, image_assets, group_elements, element_states）
- デフォルトプロジェクトとグループの作成

## データベース構造

### テーブル一覧
- `projects`: プロジェクト管理
- `groups`: グループ管理（プロジェクトに紐づく）
- `image_assets`: 画像アセット管理
- `group_elements`: グループ内の要素配置
- `element_states`: 要素の表示状態

## 使用方法

1. **初回のみ**: `python create_default_data.py` を実行
2. アプリケーション起動: `python ../../core/app.py`
3. ブラウザで `/mapping/register` にアクセス
4. グループを選択してコメント編集、要素配置を行う

## トラブルシューティング

### グループのコメントが保存できない
- データベースが初期化されているか確認
- `mapping_figure.db` ファイルが存在するか確認
- 権限エラーがないか確認

### データベースをリセットしたい
```bash
cd modules/mapping
rm mapping_figure.db
python create_default_data.py
```
