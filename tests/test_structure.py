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


if __name__ == "__main__":
    unittest.main()
