# 🧠 こころチェックシステム for School (GAS + Spreadsheet)

Google Apps Script と Google スプレッドシートを用いた、生徒の「心の状態」を記録・可視化・支援する教育向け Web アプリケーションです。

## 🌟 概要

このプロジェクトは、生徒が毎日記録する「心のエネルギー」「感情」「目標」などのデータを蓄積・可視化し、個別の振り返りや教員からのフォローを支援します。OpenAI API を利用した励ましメッセージ生成機能も搭載しています。

---

## 🛠 技術スタック

- Google Apps Script (V8)
- HTML / CSS / JavaScript
- Chart.js / Wordcloud2.js
- Google Spreadsheet
- OpenAI GPT-3.5 API

---

## 🧩 機能一覧

### ✍️ 1. こころチェックフォーム（`form.html`）

- 午前・午後で記録内容を切り替え可能
- ドロップダウン選択 + 自由記述（AIが応援メッセージ生成）
- 送信内容は `responses` シートに記録

### 👤 2. 個人ビュー（`individual.html`）

- ログインアカウントに応じたデータ表示
- 折れ線グラフ：心のエネルギーの推移
- 棒グラフ：感情（ゾーン）ごとの頻度
- ワードクラウド：自由記述（ココログ）からの頻出語表示
- 記録一覧の時系列表示

### 🧑‍🏫 3. 管理者ビュー（`admin.html`）

- 管理者のみアクセス可（ドメイン認証）
- 生徒ごとの記録確認と「先生コメント」の追記機能
- 今日のゾーン分布グラフ表示
- 各生徒の直近投稿をまとめて閲覧可能

---

## 📁 主なスクリプトファイル（`コード.js`）

| 関数名 | 概要 |
|--------|------|
| `doGet(e)` | URLパラメータにより表示画面を切り替え |
| `submitForm(data)` | 生徒の記録をスプレッドシートに保存 |
| `getLLMReply(text)` | GPT-3.5 を使用し応援メッセージ生成 |
| `getResponsesByName(name)` | 指定氏名の記録を全取得 |
| `getTodayZoneSummary()` | 今日の感情ゾーン分布を集計 |
| `saveTeacherComment()` | タイムスタンプに基づきコメント保存 |
| `getPersonalStatsByPeriod(name, period)` | 日/週/月単位で記録を集計 |

---

## 🔐 実行・デプロイ

- Google Apps Script から Web アプリとしてデプロイ
- `appsscript.json` によりドメイン内ユーザー限定アクセス設定済

```json
"webapp": {
  "executeAs": "USER_DEPLOYING",
  "access": "DOMAIN"
}
