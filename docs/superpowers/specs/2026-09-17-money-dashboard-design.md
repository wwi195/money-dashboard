# 支出・収入ダッシュボード 設計書

作成日: 2026-09-17

## 1. 目的

Googleフォームで記録している「支出」「収入」を、スマホのブラウザで開くだけで
収支バランスが一目で分かる画面にする。`fx-dashboard`/`gambling-dashboard`と
同じ考え方（CSV公開URLをfetchするだけの静的ページ、GitHub Pagesで公開）を
踏襲する。

対象は「支出（回答）」「収入（回答）」の2シート。全期間・年別・月別の3つの
粒度で、収入と支出のバランスを見られるようにする。

## 2. データソース

シート「支出（回答）」「収入（回答）」（いずれもGoogleフォーム回答シート）。

列定義（両シート共通）:

| 列 | 内容 | 例 |
|---|---|---|
| タイムスタンプ | フォーム送信日時 | `2026/07/09 18:36:40` |
| 金額 | 常に正の整数 | `3017` |
| カテゴリ | 支出: 交通費/食費/寄付/外食/趣味・娯楽費/生活用品・効率化/自己投資/生活必需・固定費/投資/株/CCI/FX/その他/医療 など。収入: ありさから/CCI/ギャンブル/その他/投資/FX など。固定リストにせず出現値をそのまま使う | `食費` |
| メモ | 自由記述。空・カンマを含みうる | `クリエイト` |
| 日付（記入日以外の場合） | 実際の支出/収入日がタイムスタンプの日と異なる場合のみ入る | `2026/06/24` |

### 取得方式

`fx-dashboard`/`gambling-dashboard`と同じ。各スプレッドシートを
「ファイル → 共有 → ウェブに公開 → CSV」で公開し、発行されたCSV URLを
`config.js`の`CSV_EXPENSE`/`CSV_INCOME`に書く。GitHub Pages上のHTMLから
`fetch`する（`fx-dashboard`のCSV_ENTRY/CSV_EXITと同型の2URL構成）。

### データの粒度に関する注意

1〜5月分は月次まとめ入力（メモが「1月分」等、月末日に1行としてカテゴリごとに
入っている）、6月以降は日次入力。月別・年別・全期間の合計値には影響しないが、
月別タブで1〜5月を選ぶと日別グラフはその月の最終日に1本だけ大きい棒が出る
（記録の仕方通りにそのまま表示する。データの補正はしない）。

## 3. アーキテクチャ

```
money-dashboard/
├── index.html              画面構造
├── style.css                スタイル（fx-dashboard/gambling-dashboardを流用）
├── config.js                CSV URL 2つ（支出・収入）
├── parse.js                 CSVパース／日付・金額の正規化（純粋関数）
├── aggregate.js              集計（純粋関数）
├── chart-data.js              Chart.js設定オブジェクトの組み立て（純粋関数）
├── render.js                  DOM描画
├── app.js                     起動・fetch・結線
└── test/
    ├── run.js                 Node向けテストランナー
    ├── harness.js              テストハーネス（fx-dashboard/gambling-dashboardと同一）
    ├── index.html              ブラウザ向けテストページ
    └── fixtures/               合成データ（dev.html用）
```

`parse.js` / `aggregate.js` / `chart-data.js` は純粋関数のみ。`render.js`と
`app.js`のみが外部（DOM・fetch）と接する。

データフロー:

```
app.js 起動
  ├→ config.CSV_EXPENSE を fetch ─┐
  └→ config.CSV_INCOME を fetch ──┤
        ↓                          ↓
   parse.parseCsv()（両方に適用）
        ↓
   parse.normalizeRecord(row, kind)   1行 → { date, amount, category, memo, kind, ok }
        kind: 'expense' | 'income'。amountは支出なら負、収入なら正に正規化
        ↓
   両シートの正規化済みレコードを1本の配列にマージ
        ↓
   aggregate.summarize(records, range)   期間を受けて集計
        ↓
   render.draw()
```

## 4. 正規化の仕様

### 4.1 日付 `parse.parseDate(raw)`

「日付（記入日以外の場合）」列があればそれを使い、空ならタイムスタンプ列の
日付部分（時刻は捨てる）を使う。どちらも読めない場合は `{ ok: false }`。

### 4.2 金額 `parse.parseAmount(raw, kind)`

シート上は常に正の整数。`kind === 'expense'` なら符号を反転して負にする、
`kind === 'income'` ならそのまま正。数値化できなければ `{ ok: false, raw: raw }`
とし、要確認件数として画面に出す（gambling-dashboardと同じ方針）。

### 4.3 カテゴリ

固定リストにせず、シートに出現する値をそのまま使う。空文字は「未分類」。
支出用カテゴリ集計と収入用カテゴリ集計は別々に保持する（カテゴリの種類が
シートごとに異なるため）。

## 5. 集計: `aggregate.js`

`summarize(records, range)` は指定範囲内の有効レコード（`amount.ok && date.ok`）
から以下を算出する。

- `incomeSum` / `expenseSum` / `balance`（= incomeSum + expenseSum。expenseSumは負値なので加算でよい）
- `count`
- `byCategoryExpense` / `byCategoryIncome`（各: `{ category, sum, count }` の配列、sum降順）
- `excludedCount`（要確認件数）

粒度別の時系列集計（画面のグラフ用）:

- `seriesByYear(records)` — 年ごとの `{ key: '2026', incomeSum, expenseSum, balance }`
- `seriesByMonth(records, year)` — 指定年の月ごと（1〜12月）の同上
- `seriesByDay(records, year, month)` — 指定年月の日ごとの同上

## 6. 表示: `chart-data.js` / `render.js`

- 上部タブ: `全期間` / `年別` / `月別`。年別・月別選択時はプルダウンで対象年
  （・対象月）を選択する（gambling-dashboardの`genre-select`と同じ見た目）。
- サマリータイル: 収支合計（プラス緑/マイナス赤の`summary-tile`）+ 収入合計・
  支出合計のサブ表示（`summary-sub-stat`）。
- 時系列グラフ: グループ棒グラフ（収入=緑の棒、支出=赤の棒を左右に並べる）。
  全期間タブ→`seriesByYear`、年別タブ→`seriesByMonth`、月別タブ→`seriesByDay`。
  横軸ラベルは既存ダッシュボードの表記規則（年別=年、月別=M月、日別=M/D）を
  流用する。
- カテゴリ別内訳: 支出カテゴリ別・収入カテゴリ別を、それぞれ横棒グラフ+
  リスト（`category-chart`/`category-list`と同じ構造）で2つ並べる。
- 取引一覧: 選択期間内の全件を新しい順に表示。支出は赤字・マイナス表記、
  収入は緑字・プラス表記（`record-card`を流用、`kind`でクラス分岐）。

## 7. テスト

`test/harness.js`（既存2案件と同一のものを流用）+ `test/run.js`（Node向け）。
`parse.js` / `aggregate.js` / `chart-data.js` それぞれにユニットテストを書く。

## 8. デプロイ

新規GitHubリポジトリ `money-dashboard`（public、GitHub Pages有効化）を作成し
push する。README.mdのセットアップ手順はgambling-dashboardのものを流用
（CSV公開URLの発行手順を2シート分に拡張）。
