# 模擬国連トレーニング(独立版)

Claudeのアカウントがなくても、URLを開くだけで使える模擬国連の練習サイトです。
リサーチ、スピーチ、アンモデ連続練習、1対1交渉、決議案、手続きクイズ、用語集が入っています。

## しくみ

```
スマホ・PC(index.html) ──▶ /api/ai(Vercelのサーバー) ──▶ Claude または Gemini
                              ↑ APIキーはここにだけ置く
```

APIキーはサーバー側の「環境変数」に入れるので、サイトを見た人にはキーが見えません。
さらに合言葉(ACCESS_CODE)を設定すると、合言葉を知らない人はAIを使えません。

## 最初に決めること(大事)

- **APIキーは大人の名義で作ってください。** AnthropicもGoogleも、APIの利用は18歳以上が条件です。顧問の先生や保護者にアカウントを作ってもらい、キーを受け取る形にします。
- **使いすぎ防止の上限を設定してください。** Anthropicなら Console の Billing で月の上限額、Googleなら課金上限やアラートを設定できます。
- サービスごとの利用規約(未成年が使うサイトでの利用条件など)を、キーの持ち主が確認してください。

## APIキーがなくても公開できます

環境変数を何も入れずに公開すると、AIを使う機能(リサーチ・アンモデ・1対1交渉・講評・問題作成)は「準備中」と表示されて押せなくなります。
タイマー、原稿の時間計算、決議案の組み立て、手続きクイズ、用語集はそのまま使えます。
あとからAPIキーを入れて Redeploy すれば、AIの機能が自動で使えるようになります。

## 公開の手順(30分くらい)

1. **GitHub** にログインし、新しいリポジトリ(例: `mun-trainer`)を作る。
   「uploading an existing file」から、このフォルダの中身(`index.html`, `package.json`, `api/ai.js`, `README.md`)をそのままアップロード。`api` フォルダの構造は崩さないこと。
2. **Vercel**(vercel.com)に GitHub でログインし、「Add New → Project」で 1 のリポジトリを選ぶ。
   Framework Preset は「Other」のままでOK。
3. デプロイ前に「Environment Variables」で次を入れる。

   | 名前 | 値 |
   |---|---|
   | `ANTHROPIC_API_KEY` | Claude のAPIキー(Gemini を使うなら代わりに `GEMINI_API_KEY`) |
   | `ACCESS_CODE` | 部員に教える合言葉(例: `yamato2026`) |
   | `RATE_PER_MIN` | 1人1分あたりの上限回数。省略すると 12 |

4. 「Deploy」を押す。`https://mun-trainer-xxxx.vercel.app` のようなURLができる。
5. サイトを開き、上の「合言葉」欄に合言葉を入れれば使える。

あとから環境変数を変えたら、Vercel の Deployments から「Redeploy」してください。

## 中身を変えたいとき

- 画面や問題の中身: `index.html` を編集して GitHub に上げ直すと、Vercel が自動で更新します。
  クイズは `const QUIZ=[` 、用語は `const TERMS=[` のところです。
- 使うモデルを変える: 環境変数 `ANTHROPIC_MODEL`(普段用)、`ANTHROPIC_MODEL_COMPLEX`(講評・リサーチ用)、`GEMINI_MODEL` を設定。
  既定は `claude-haiku-5-5` / `claude-sonnet-5-5` / `gemini-2.5-flash`。モデル名が古くなって動かなくなったら、ここを最新の名前に変えてください。

## v0 で作り直したい場合

v0 も最終的には同じく Vercel に公開します。v0 に「この index.html と api/ai.js を Next.js のアプリにして」と頼み、
環境変数(`ANTHROPIC_API_KEY`, `ACCESS_CODE`)を同じように設定すれば動きます。キーをブラウザ側のコードに書かせないことだけ注意してください。

## 注意

- 入力した内容(メモ・原稿・決議案)は、その端末のブラウザに保存されます。別の端末には引き継がれません。
- AIの答えには誤りがあります。数字・発言・投票記録は国連の一次資料で確認してください。
