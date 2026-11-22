# AIカンパニー Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/company` と呼ぶと、社長役が聞き取り→アイデア提案→企画・エンジニア・レビュー役への割り振りまで進める Claude Code 上のAIチームを作る。

**Architecture:** Claude Code ではサブエージェントは他のサブエージェントを呼べず、オーナーと直接対話もできない。そのため**社長役は `/company` コマンドとしてメインのセッションが演じ**、企画・エンジニア・レビューの3役をサブエージェント（`.claude/agents/`）として呼び出す。会社の状態は `company/` のMarkdownファイルに残し、全役共通のルールは `CLAUDE.md` と `.claude/settings.json` の禁止設定で守らせる。

**Tech Stack:** Claude Code（サブエージェント、スラッシュコマンド、settings.json）、Markdown、構造チェック用に Python 3 標準ライブラリ（`unittest`）のみ。

**Spec:** `docs/superpowers/specs/2026-11-22-ai-company-design.md`

## Global Constraints

- 役は4つ: 社長（CEO）・企画（PM）・エンジニア・レビュー。営業役は作らない。
- アイデアの評価基準（この順）: ①オーナーが毎日または毎週使うか ②困りごとがどれだけ減るか（時間・手間・ストレス） ③1〜2週間で使い始められるか。
- 社長役のアイデア提案は2〜3案。オーナーが選ぶまで作り始めない。
- 確認ポイントは3つ（①アイデア選択 ②仕様確認 ③取り込み）。各ポイントでAIは止まってオーナーの返事を待つ。
- 困りごとは聞き取りだけで集める。AIはオーナーのメール・カレンダー・Notionなどの個人データを読まない。
- プロダクトはオーナーのパソコンだけで使う（ローカルのブラウザツールやスクリプト）。Web公開・スマホ対応はしない。完成品はオーナーが動かすとき個人データを扱ってよい。
- 開発とテストはダミーデータのみ。
- 「外部送信」= オーナーに代わって人やサービスへ送ること（メール、SNS投稿、フォーム送信、公開）。パッケージのインストールとWeb調査は含まない。外部送信・公開・デプロイ・課金はしない。
- 同時に進めるプロダクトは1つ。完了か中止をオーナーが決めるまで次を始めない。
- エンジニア役は `product/<名前>` ブランチにコミットし、プルリクエストを作る。メインブランチへの直接コミットとマージはしない。マージするのはオーナー。
- オーナーへの文面はすべて日本語。

## Review Focus

1. **進行中のプロダクトがある状態で `/company` を呼ぶ** → 聞き取りからやり直さず、`company/state.md` の段階から続きを始める。（Task 3 のチェックで固定）
2. **オーナーが提案を全部断る** → 断った案を `company/ideas.md` に「不採用」と理由つきで残し、追加の聞き取りをしてから新しい案を出す。同じ案を再提案しない。（Task 3）
3. **レビューで何度も差し戻しになる** → エンジニアとレビューの往復は最大3回。それでも通らなければ止めて、問題点をオーナーに報告する。（Task 3）
4. **エンジニア役が本物のメールやGmail等のツールを使おうとする** → `settings.json` の deny で個人データ系MCPツールを禁止し、エージェント定義でもダミーデータのみと明記。（Task 1, Task 2）
5. **仕様が膨らむ** → 企画役は「やらないこと」欄を必ず書き、1〜2週間を超える見積もりなら分割案をオーナーに出す。（Task 2）

---

## File Structure

| ファイル | 役割 |
|---|---|
| `CLAUDE.md` | 全役共通の会社ルール（Global Constraints の要約） |
| `.claude/settings.json` | 個人データ系ツール・マージ・強制プッシュの禁止 |
| `.claude/commands/company.md` | `/company`。メインセッションが社長役として動く手順 |
| `.claude/agents/pm.md` | 企画役サブエージェント |
| `.claude/agents/engineer.md` | エンジニア役サブエージェント |
| `.claude/agents/reviewer.md` | レビュー役サブエージェント |
| `company/state.md` | 現在のプロダクトと段階 |
| `company/problems.md` | 聞き取った困りごと |
| `company/ideas.md` | 提案したアイデアと採否 |
| `products/README.md` | プロダクト置き場の説明（各プロダクトは `products/<名前>/`、仕様は `products/<名前>/SPEC.md`） |
| `tests/test_structure.py` | 上記ファイルの構造と必須ルールのチェック |

`company/state.md` の段階（`phase`）は次の値に固定: `none`, `interview`, `proposal`, `spec`, `spec_review`, `build`, `review`, `owner_review`, `done`, `cancelled`。

---

### Task 1: 会社の土台（共通ルール・禁止設定・記録ファイル・チェック）

**Files:**
- Create: `CLAUDE.md`, `.claude/settings.json`, `company/state.md`, `company/problems.md`, `company/ideas.md`, `products/README.md`
- Test: `tests/test_structure.py`

**Interfaces:**
- Produces: `tests/test_structure.py` 内のヘルパー `read(path: str) -> str`（リポジトリルート基準で読む）と `frontmatter(path: str) -> dict[str, str]`（`---` で囲まれた先頭の `key: value` を辞書で返す）。Task 2, 3 のテストが使う。
- Produces: `company/state.md` の書式。先頭に `phase: none` と `product: (なし)` の2行。

- [ ] **Step 1: Write the failing tests** — `tests/test_structure.py` に `class FoundationTest(unittest.TestCase)`:
  - `test_claude_md_rules`: `CLAUDE.md` に `ダミーデータ`, `外部送信`, `マージ`, `個人データ`, `日本語` を含む。
  - `test_settings_deny`: `.claude/settings.json` を `json.loads` し、`permissions.deny` に `mcp__Gmail`, `mcp__Google_Calendar`, `mcp__Google_Drive`, `mcp__Google_Docs`, `mcp__Google_Sheets`, `mcp__Notion`, `mcp__HubSpot`, `mcp__Tactiq`, `mcp__Metricool_Social_Media_Management`, `Bash(gh pr merge:*)`, `Bash(git push --force:*)`, `Bash(git push -f:*)` をすべて含む。
  - `test_state_initial`: `company/state.md` に `phase: none` を含む。
  - `test_records_exist`: `company/problems.md`, `company/ideas.md`, `products/README.md` が存在する。
- [ ] **Step 2: Run** `python3 -m unittest tests/test_structure.py -v` → Expected: FAIL（ファイルが無い）
- [ ] **Step 3: Create the files.** `CLAUDE.md` は Global Constraints を日本語の箇条書きで。`ideas.md` は見出し `## 提案中` `## 採用` `## 不採用`（不採用には理由欄）。`problems.md` は1件ごとに「困りごと / 頻度 / いま困っていること / 聞いた日」。
- [ ] **Step 4: Run** 同じコマンド → Expected: PASS
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: add company foundation, rules and records"`

### Task 2: 企画・エンジニア・レビューのサブエージェント

**Files:**
- Create: `.claude/agents/pm.md`, `.claude/agents/engineer.md`, `.claude/agents/reviewer.md`
- Test: `tests/test_structure.py`（`class AgentsTest` を追加）

**Interfaces:**
- Consumes: `read`, `frontmatter`（Task 1）
- Produces: サブエージェント名 `pm`, `engineer`, `reviewer`。入出力の約束:
  - `pm`: 入力=選ばれたアイデアと関連する困りごと。出力=`products/<名前>/SPEC.md`（見出し `## 誰のため` `## 作るもの` `## やらないこと` `## 完成の条件` `## 見積もり`）。
  - `engineer`: 入力=SPEC.md のパス（と差し戻し時はレビュー指摘）。出力=`product/<名前>` ブランチ上のコミット、起動方法を書いた `products/<名前>/README.md`、テスト結果の要約。
  - `reviewer`: 入力=SPEC.md とブランチ名。出力=先頭行が `判定: 合格` または `判定: 差し戻し` の報告と、指摘の箇条書き。

- [ ] **Step 1: Write the failing tests** — `class AgentsTest`:
  - `test_frontmatter`: 3ファイルとも `frontmatter()` に `name`（それぞれ `pm` / `engineer` / `reviewer`）、`description`、`tools` がある。
  - `test_no_personal_data_tools`: 3ファイルの `tools` に `mcp__` を含まない。
  - `test_pm_rules`: `pm.md` に `やらないこと`, `完成の条件`, `1〜2週間`, `分割` を含む。
  - `test_engineer_rules`: `engineer.md` に `ダミーデータ`, `product/`, `プルリクエスト`, `マージしない`, `外部送信` を含む。
  - `test_reviewer_rules`: `reviewer.md` に `判定: 合格`, `判定: 差し戻し`, `ダミーデータ` を含み、`tools` に `Write` と `Edit` を含まない。
- [ ] **Step 2: Run** `python3 -m unittest tests/test_structure.py -v` → Expected: AgentsTest FAIL
- [ ] **Step 3: Write the three agent definitions.** `tools`: pm=`Read, Write, Edit, Glob, Grep, WebSearch, WebFetch`、engineer=`Read, Write, Edit, Glob, Grep, Bash`、reviewer=`Read, Glob, Grep, Bash`。本文は各役の仕事・やらないこと（設計書 6.1）と上の入出力の約束。エンジニアはローカルで動く形（設計書 6.6）を選び、Web公開の仕組みを入れない。
- [ ] **Step 4: Run** 同じコマンド → Expected: PASS
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: add pm, engineer and reviewer agents"`

### Task 3: `/company` コマンド（社長役）

**Files:**
- Create: `.claude/commands/company.md`
- Test: `tests/test_structure.py`（`class CompanyCommandTest` を追加）

**Interfaces:**
- Consumes: `company/state.md` の `phase` 値（Task 1）、サブエージェント `pm` / `engineer` / `reviewer` と各出力（Task 2）

- [ ] **Step 1: Write the failing tests** — `class CompanyCommandTest`:
  - `test_frontmatter`: `frontmatter()` に `description` がある。
  - `test_resume`: `company/state.md` を最初に読む指示と、`phase` が `none`/`done`/`cancelled` 以外なら続きから始める指示を含む（文字列 `company/state.md` と `続き` を含む）。
  - `test_phases`: 段階値 `interview`, `proposal`, `spec`, `spec_review`, `build`, `review`, `owner_review`, `done`, `cancelled` をすべて含む。
  - `test_criteria`: 評価基準3つ（`毎日または毎週`, `困りごと`, `1〜2週間`）と `2〜3案` を含む。
  - `test_checkpoints`: `確認ポイント①`, `確認ポイント②`, `確認ポイント③` と `返事を待つ` を含む。
  - `test_rejection_and_loop`: `不採用`, `同じ案を再提案しない`, `最大3回` を含む。
  - `test_no_personal_data`: `聞き取り` を含み、`個人データを読まない` を含む。
- [ ] **Step 2: Run** `python3 -m unittest tests/test_structure.py -v` → Expected: CompanyCommandTest FAIL
- [ ] **Step 3: Write `.claude/commands/company.md`.** 手順: state を読む → 段階ごとの動き（設計書 6.3 の流れ）→ 段階が変わるたびに `company/state.md` を更新。聞き取りは一度に1問ずつ。提案は各案に3基準の評価をつける。`$ARGUMENTS` があればオーナーからの指示として最初に扱う。報告の最後には、オーナーが次に何をすればよいかを書く（PRのURL、起動コマンド）。
- [ ] **Step 4: Run** 同じコマンド → Expected: PASS
- [ ] **Step 5: Commit** `git add -A && git commit -m "feat: add /company command as CEO"`

### Task 4: 通しの動作確認とプッシュ

**Files:** なし（確認のみ）。必要ならテストで見つかった修正。

- [ ] **Step 1: Run** `python3 -m unittest discover -s tests -v` → Expected: 全テスト PASS
- [ ] **Step 2: Trace the flow.** `.claude/commands/company.md` を読み、`phase` を `none` → `interview` → `proposal` → `spec` → `spec_review` → `build` → `review` → `owner_review` → `done` と順にたどり、各段階で「次に何をするか」と「state をどう更新するか」が書かれていることを確認する。抜けがあれば修正してテストを再実行。
- [ ] **Step 3: Push and open a PR.** 作業はすべて `setup/ai-company` ブランチで行う（Task 1 の前に `git checkout -b setup/ai-company`）。`git -c push.negotiate=true push -u origin setup/ai-company` のあと、`main` 向けのプルリクエストを作る。マージはオーナーが行う。
