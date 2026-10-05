# 数字人狼 - Render公開手順

このフォルダは Render の1つの Web Service で公開できるように調整済みです。

## GitHub

1. GitHubで新しいリポジトリを作成します。
2. このフォルダの中身をリポジトリ直下にアップロードします。
3. `client`、`server`、`package.json`、`render.yaml` が同じ階層にあることを確認します。

`node_modules` と `dist` はアップロード不要です。

## Render

1. Renderにログインします。
2. New > Blueprint を選びます。
3. GitHubのリポジトリを選びます。
4. `render.yaml` が読み込まれたら Apply します。
5. デプロイ完了後、発行された `https://...onrender.com` を開きます。

## 補足

- Free Web Service は一定時間アクセスがないとスピンダウンします。
- ルーム情報はメモリ保存なので、Renderの再起動・再デプロイ・スピンダウンで消えます。
