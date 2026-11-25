# 📸 おめかしした garden

デフォルトの 🌹 Rosé Pine カラーで全ページをめぐるツアー。左が ☀️ ライト、右が 🌙 ダーク。ここに写っているものはすべて架空のもの：「sunbeam-labs」チーム、そのリポジトリ、PR、チケット、タスクは GitHub や Jira、Todoist ではなく [`demo/fixtures.rb`](demo/fixtures.rb) から来ているよ。

[🍔 English](README.md) · [🥐 Français](README.fr.md) · [🌽 Español](README.es.md) · **🍙 日本語**  
🎨 [ほかのカラーパレットで見る全ページ（英語）](palettes.md)

## 💌 PRのお庭

オープンな PR を「マージできる」「手直し」「レビュー待ち」「ドラフト」に分けて表示。左はリポジトリのパネル。
![01-pr-garden](ja/01-pr-garden.jpg)

「マージ済み」で、もう着地したものをながめる。
![02-pr-garden-merged](ja/02-pr-garden-merged.jpg)

## 👀 レビューのお庭

名前指定でレビューを依頼された PR。
![03-review-garden](ja/03-review-garden.jpg)

チームのタブ。パネルでリポジトリをひとつチェックから外した状態。
![04-review-garden-team](ja/04-review-garden-team.jpg)

## 📝 タスクのお庭

左にリストのパネル、「今日」と「期限切れ」をタブで表示。
![05-task-garden](ja/05-task-garden.jpg)

新しいタスクを植える（`c`）。
![06-task-garden-new-task](ja/06-task-garden-new-task.jpg)

キーボードのヘルプ（`?`）。
![07-task-garden-keyboard-help](ja/07-task-garden-keyboard-help.jpg)

## 🌿 ブランチのお庭

パネルのリポジトリごとにタブ。各ブランチの PR の状態、upstream、ワークツリーのバッジ。
![08-branch-garden](ja/08-branch-garden.jpg)

マージ済みのブランチをふたつまとめてお片付け。
![09-branch-garden-tidy](ja/09-branch-garden-tidy.jpg)

## 🏡 ワークツリーのお庭

リポジトリごとのワークツリーのタブ。フォルダが消えたおばけもいるよ。
![10-worktree-garden](ja/10-worktree-garden.jpg)

## 🎟️ チケットのお庭

エピックごとのレーンに並んだ自分のチケット。左はスプリントのパネル。
![11-ticket-garden](ja/11-ticket-garden.jpg)

スプリントのタブ。チーム全員のチケットと、レーンごとの担当者フィルター。
![12-ticket-garden-sprint](ja/12-ticket-garden-sprint.jpg)

パネルで開いたチケット。
![13-ticket-garden-ticket](ja/13-ticket-garden-ticket.jpg)

## ⚙️ 設定

上に色と言語、その下でリポジトリをまとめてどこでも隠す。リポジトリのリストはGitHubから。
![14-settings](ja/14-settings.jpg)

## 撮り直しかた

デモサーバーは本物のページを動かしつつ、すべての API を架空のデータに差し替えているよ。`?scene=` ごとにページを演出（タブ、ダイアログ、保存したフィルター）するんだ。撮影係はヘッドレスの Chrome を操作するので、Google Chrome が必要。そのあと `gallery.rb` がこれらのページを書き直すよ。

```sh
ruby docs/screenshots/demo/demo_garden.rb &                     # http://localhost:4750
ruby docs/screenshots/demo/shoot.rb docs/screenshots            # 全シーン、全言語、全パレット
ruby docs/screenshots/demo/shoot.rb docs/screenshots 12-ticket  # ひとつのシーンだけ
ruby docs/screenshots/demo/gallery.rb                           # ギャラリーを書き直す
```

シーンは [`demo/scenes.rb`](demo/scenes.rb)、キャプションは [`demo/gallery.rb`](demo/gallery.rb) にあるよ。
