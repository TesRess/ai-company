"""会社の設定ファイルが揃っていて、必須ルールが書かれているかを確かめる。"""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def frontmatter(path: str) -> dict[str, str]:
    lines = read(path).splitlines()
    if not lines or lines[0].strip() != "---":
        return {}
    result: dict[str, str] = {}
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if ":" in line:
            key, value = line.split(":", 1)
            result[key.strip()] = value.strip()
    return result


class FoundationTest(unittest.TestCase):
    def test_claude_md_rules(self):
        text = read("CLAUDE.md")
        for word in ["ダミーデータ", "外部送信", "マージ", "個人データ", "日本語"]:
            self.assertIn(word, text)

    def test_settings_deny(self):
        deny = json.loads(read(".claude/settings.json"))["permissions"]["deny"]
        for rule in [
            "mcp__Gmail", "mcp__Google_Calendar", "mcp__Google_Drive",
            "mcp__Google_Docs", "mcp__Google_Sheets", "mcp__Notion",
            "mcp__HubSpot", "mcp__Tactiq", "mcp__Metricool_Social_Media_Management",
            "Bash(gh pr merge:*)", "Bash(git push --force:*)", "Bash(git push -f:*)",
        ]:
            self.assertIn(rule, deny)

    def test_state_initial(self):
        self.assertIn("phase: none", read("company/state.md"))

    def test_records_exist(self):
        for path in ["company/problems.md", "company/ideas.md", "products/README.md"]:
            self.assertTrue((ROOT / path).exists(), path)


AGENTS = {"pm": ".claude/agents/pm.md", "engineer": ".claude/agents/engineer.md",
          "reviewer": ".claude/agents/reviewer.md"}


class AgentsTest(unittest.TestCase):
    def test_frontmatter(self):
        for name, path in AGENTS.items():
            fm = frontmatter(path)
            self.assertEqual(fm.get("name"), name)
            self.assertTrue(fm.get("description"))
            self.assertTrue(fm.get("tools"))

    def test_no_personal_data_tools(self):
        for path in AGENTS.values():
            self.assertNotIn("mcp__", frontmatter(path)["tools"])

    def test_pm_rules(self):
        text = read(AGENTS["pm"])
        for word in ["やらないこと", "完成の条件", "1〜2週間", "分割"]:
            self.assertIn(word, text)

    def test_engineer_rules(self):
        text = read(AGENTS["engineer"])
        for word in ["ダミーデータ", "product/", "プルリクエスト", "マージしない", "外部送信"]:
            self.assertIn(word, text)

    def test_reviewer_rules(self):
        text = read(AGENTS["reviewer"])
        for word in ["判定: 合格", "判定: 差し戻し", "ダミーデータ"]:
            self.assertIn(word, text)
        tools = frontmatter(AGENTS["reviewer"])["tools"]
        self.assertNotIn("Write", tools)
        self.assertNotIn("Edit", tools)


COMMAND = ".claude/commands/company.md"


class CompanyCommandTest(unittest.TestCase):
    def setUp(self):
        self.text = read(COMMAND)

    def test_frontmatter(self):
        self.assertTrue(frontmatter(COMMAND).get("description"))

    def test_resume(self):
        self.assertIn("company/state.md", self.text)
        self.assertIn("続き", self.text)

    def test_phases(self):
        for phase in ["interview", "proposal", "spec", "spec_review", "build",
                      "review", "owner_review", "done", "cancelled"]:
            self.assertIn(phase, self.text)

    def test_criteria(self):
        for word in ["毎日または毎週", "困りごと", "1〜2週間", "2〜3案"]:
            self.assertIn(word, self.text)

    def test_checkpoints(self):
        for word in ["確認ポイント①", "確認ポイント②", "確認ポイント③", "返事を待つ"]:
            self.assertIn(word, self.text)

    def test_rejection_and_loop(self):
        for word in ["不採用", "同じ案を再提案しない", "最大3回"]:
            self.assertIn(word, self.text)

    def test_no_personal_data(self):
        self.assertIn("聞き取り", self.text)
        self.assertIn("個人データを読まない", self.text)


class ReviewFixesTest(unittest.TestCase):
    def test_deny_covers_local_connector_names_and_more_servers(self):
        deny = json.loads(read(".claude/settings.json"))["permissions"]["deny"]
        for rule in ["mcp__claude_ai_Gmail", "mcp__claude_ai_Google_Calendar",
                     "mcp__claude_ai_Notion", "mcp__claude_ai_Slack", "mcp__Slack",
                     "mcp__Canva", "mcp__Miro", "mcp__Claude_Docs"]:
            self.assertIn(rule, deny)

    def test_deny_merge_via_api(self):
        deny = json.loads(read(".claude/settings.json"))["permissions"]["deny"]
        self.assertIn("Bash(gh api:*)", deny)

    def test_engineer_uses_worktree_and_stages_only_product(self):
        text = read(".claude/agents/engineer.md")
        self.assertIn("git worktree add", text)
        self.assertIn("git add products/", text)
        self.assertNotIn("git add -A", text)

    def test_engineer_fallback_without_github(self):
        self.assertIn("プッシュできない", read(".claude/agents/engineer.md"))

    def test_review_round_persisted(self):
        self.assertIn("review_round: 0", read("company/state.md"))
        self.assertIn("review_round", read(".claude/commands/company.md"))

    def test_records_committed(self):
        self.assertIn("git add company/", read(".claude/commands/company.md"))

    def test_resume_proposal_reshows_ideas(self):
        self.assertIn("提案中の案をもう一度", read(".claude/commands/company.md"))

    def test_pycache_ignored(self):
        self.assertIn("__pycache__/", read(".gitignore"))


if __name__ == "__main__":
    unittest.main()
