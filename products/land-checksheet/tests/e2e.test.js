// 画面の確認（完成の条件 1〜10）。ヘッドレスの Chromium + Playwright で改良版HTMLを開いて操作する。
// Firebase は未設定のまま（データは端末内に保存）。使うのはダミーデータだけ。
// 実行: node --test products/land-checksheet/tests/e2e.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { chromium } = require('playwright');

const FILE = 'file://' + path.join(__dirname, '..', 'kawamura_proposal.html');
const LINK_HOSTS = /disaportal\.gsi\.go\.jp|reinfolib\.mlit\.go\.jp|example\.com|google\.com\/maps|maps\.google\.com/;

let ctx, page, userDir;
const linkRequests = [];   // 調べるためのサイトへの通信の記録
const pageErrors = [];

const sel = {
    addr: `input[oninput^="app.updateLandInfo(0, 'address'"]`,
    area: `input[oninput^="app.calcTsubo(0,"]`,
    zoning: `select[onchange^="app.updateLandInfo(0, 'zoning'"]`,
    cov: `input[oninput^="app.updateLandPercent(0, 'coverage'"]`,
    far: `input[oninput^="app.updateLandPercent(0, 'far'"]`,
    restr: `input[oninput^="app.updateLandInfo(0, 'restrictions'"]`,
    traffic: `input[oninput^="app.updateLandInfo(0, 'traffic'"]`,
    school: `input[oninput^="app.updateLandInfo(0, 'school'"]`,
    memo: `textarea[oninput^="app.updateLandInfo(0, 'memo'"]`,
    dir: `select[onchange^="app.updateLandInfo(0, 'roadDir'"]`,
    width: `input[oninput^="app.updateLandInfo(0, 'roadWidth'"]`,
    front: `input[oninput^="app.updateLandInfo(0, 'roadFrontage'"]`,
    type: `select[onchange^="app.updateLandInfo(0, 'roadType'"]`,
    out: '#land-check-out-0',
    intro: '#land-intro-0',
};
const out = () => page.locator(sel.out).innerText();
const clip = () => page.evaluate(() => navigator.clipboard.readText());

async function fillExample1() {
    await page.fill(sel.addr, 'ダミー市ダミー町1丁目2-3');
    await page.selectOption(sel.zoning, '第一種低層住居専用地域');
    await page.fill(sel.area, '165.29');
    await page.fill(sel.cov, '50');
    await page.fill(sel.far, '100');
    await page.selectOption(sel.dir, '南');
    await page.fill(sel.width, '4');
    await page.selectOption(sel.type, '公道');
    await page.fill(sel.front, '10');
    await page.fill(sel.restr, '');
    await page.fill(sel.memo, 'ダミー物件Aの備考');
}

test.before(async () => {
    userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'land-check-e2e-'));
    ctx = await chromium.launchPersistentContext(userDir, { headless: true, viewport: { width: 1400, height: 1000 } });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
    ctx.on('request', r => { if (LINK_HOSTS.test(r.url())) linkRequests.push(r.url()); });
    // テスト中に本物のサイトへは出ない（開いたタブには空のページを返す）
    await ctx.route(LINK_HOSTS, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>stub</p>' }));
    page = ctx.pages()[0] || await ctx.newPage();
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.goto(FILE, { waitUntil: 'load' });
    // 最初の画面で「新しいお客様を作成」→ ダミーのお客様名で新しい案件を作る
    await page.locator('#start-screen button', { hasText: '新しいお客様を作成' }).click();
    await page.fill('#new-client-input', 'ダミー様');
    await page.press('#new-client-input', 'Enter');
    await page.waitForSelector('#start-screen', { state: 'hidden', timeout: 30000 });
    await page.waitForSelector(sel.addr, { timeout: 30000 });
});
test.after(async () => {
    await ctx?.close();
    fs.rmSync(userDir, { recursive: true, force: true });
});

test('条件1: 基本の例', async () => {
    assert.equal(linkRequests.length, 0, '開いただけでサイトに通信している');
    await fillExample1();
    const t = await out();
    assert.match(t, /82\.6㎡（約25\.0坪）/);
    assert.match(t, /165\.3㎡（約50\.0坪）/);
    assert.match(t, /使う容積率は 100%（道路による制限 160% より指定の方が小さいため）/);
    assert.match(t, /平屋なら\s+約25\.0坪まで/);
    assert.match(t, /2階建てなら\s+約50\.0坪まで/);
    assert.match(t, /3台（間口から3台、空き地の広さから5台 → 小さい方）/);
    assert.match(t, /道路斜線/);
    assert.match(t, /北側斜線.*南道路なので.*北側の屋根/);
    assert.match(t, /10mまたは12m/);
    assert.doesNotMatch(t, /隣地斜線/);
    assert.doesNotMatch(t, /セットバック/);
    if (process.env.SHOT_DIR) await page.locator('#land-info-wrapper > div').first().screenshot({ path: path.join(process.env.SHOT_DIR, 'land-check-ex1.png') });
    const box = await page.locator('#land-check-0').innerText();
    assert.match(box, /目安/);
    assert.match(box, /役所・設計担当で確認/);
});

test('条件2: 道路が狭い例', async () => {
    await page.fill(sel.width, '3.6');
    const t = await out();
    assert.match(t, /セットバック約0\.2m、敷地が約2\.0㎡減る/);
    assert.match(t, /81\.6㎡（約24\.7坪）/);
    assert.match(t, /163\.3㎡（約49\.4坪）/);
    assert.match(t, /165\.29㎡/);
    await page.fill(sel.width, '4');
});

test('条件3: 道路で容積率が下がる例', async () => {
    await page.selectOption(sel.zoning, '第一種中高層住居専用地域');
    await page.fill(sel.area, '150');
    await page.fill(sel.cov, '60');
    await page.fill(sel.far, '200');
    await page.selectOption(sel.dir, '北');
    await page.fill(sel.front, '8');
    const t = await out();
    assert.match(t, /90\.0㎡（約27\.2坪）/);
    assert.match(t, /240\.0㎡（約72\.6坪）/);
    assert.match(t, /道路の幅のため 200% → 160% で計算/);
    assert.match(t, /2台（/);
});

test('条件4: 注意が強く出る例', async () => {
    await page.fill(sel.front, '1.8');
    assert.match(await out(), /接道（2m以上）を満たさない恐れ/);
    await page.fill(sel.restr, '準防火地域');
    assert.match(await out(), /防火・準防火/);
    await page.selectOption(sel.zoning, '指定なし（市街化調整区域等）');
    const first = await page.locator(`${sel.out} li`).first().innerText();
    assert.match(first, /家が建てられない場合がある/);
    const t = await out();
    assert.doesNotMatch(t, /建築面積の上限|延床面積の上限|平屋なら/);
});

test('条件5: 未入力のとき', async () => {
    await fillExample1();
    await page.fill(sel.area, '');
    await page.fill(sel.cov, '');
    let t = await out();
    assert.match(t, /建築面積の上限\s+—/);
    await fillExample1();
    await page.fill(sel.width, '3.6');
    await page.fill(sel.front, '');
    t = await out();
    assert.match(t, /駐車台数の目安（並べて止める場合）\s+間口を入れると表示/);
    assert.match(t, /セットバック約0\.2m（減る面積は間口を入れると表示）/);
    assert.deepEqual(pageErrors, []);
    await fillExample1();
});

test('条件6: 調べるためのリンク', async () => {
    assert.equal(linkRequests.length, 0, 'ボタンを押す前にサイトに通信している');
    const btn = page.locator('#land-check-0 button', { hasText: '重ねるハザードマップ' });
    const [popup] = await Promise.all([ctx.waitForEvent('page'), btn.click()]);
    assert.match(popup.url(), /disaportal\.gsi\.go\.jp\/maps/);
    await popup.close();
    assert.match(await page.locator('#toast-container').innerText(), /所在地「ダミー市ダミー町1丁目2-3」をコピーしました/);
    assert.equal(await clip(), 'ダミー市ダミー町1丁目2-3');
    // 所在地が空
    await page.fill(sel.addr, '');
    const [p2] = await Promise.all([ctx.waitForEvent('page'), btn.click()]);
    await p2.close();
    assert.match(await page.locator('#toast-container').innerText(), /所在地が未入力/);
    await page.fill(sel.addr, 'ダミー市ダミー町1丁目2-3');
    // 都市計画図のリンクを登録
    assert.equal(await page.locator('#land-check-0 button', { hasText: 'ダミー市の都市計画図' }).count(), 0);
    await page.locator('#land-check-0 summary').click();
    await page.fill('#land-city-name-0', 'ダミー市');
    await page.fill('#land-city-url-0', 'https://example.com/dummy-cityplan');
    await page.locator('#land-check-0 button', { hasText: '登録' }).click();
    const cityBtn = page.locator('#land-check-0 button', { hasText: 'ダミー市の都市計画図' });
    assert.equal(await cityBtn.count(), 1);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('kw_cityplan_links'))[0].url), 'https://example.com/dummy-cityplan');
    const [p3] = await Promise.all([ctx.waitForEvent('page'), cityBtn.click()]);
    assert.equal(p3.url(), 'https://example.com/dummy-cityplan');
    await p3.close();
    // 別の市では出ない
    await page.fill(sel.addr, 'ほか市ほか町1');
    assert.equal(await page.locator('#land-check-0 button', { hasText: 'ダミー市の都市計画図' }).count(), 0);
    await page.fill(sel.addr, 'ダミー市ダミー町1丁目2-3');
});

test('条件7: 土地紹介文の下書き', async () => {
    await page.fill(sel.traffic, 'ダミー線ダミー駅 徒歩10分');
    await page.fill(sel.school, 'ダミー小学校 徒歩5分');
    await page.locator('#land-check-0 button', { hasText: '下書きを作る' }).click();
    const t = await page.inputValue(sel.intro);
    for (const w of ['第一種低層住居専用地域', '約50.0坪（165.29㎡）', '南側の4m道路', '日当たり', '建ぺい率50%・容積率100%', '2階建てなら延床約50.0坪', '目安', 'ダミー駅', 'ダミー小学校']) {
        assert.ok(t.includes(w), `「${w}」が入っていない`);
    }
    // 自由に直せる
    await page.fill(sel.intro, 'ダミーの紹介文（手で直した）');
    // 上書きの確認が出る → やめる → 残る
    await page.locator('#land-check-0 button', { hasText: '下書きを作る' }).click();
    await page.waitForSelector('#confirm-modal:not(.hidden)');
    assert.match(await page.locator('#confirm-modal').innerText(), /上書き/);
    await page.locator('#confirm-modal button', { hasText: 'キャンセル' }).click();
    assert.equal(await page.inputValue(sel.intro), 'ダミーの紹介文（手で直した）');
});

async function overviewText() {
    await page.evaluate(() => app.showPreview());
    await page.waitForTimeout(800);
    const txt = await page.evaluate(() => {
        const pages = [...document.querySelectorAll('#view-preview *')].filter(el => el.children.length === 0 && /土地紹介/.test(el.textContent));
        const pg = pages.length ? pages[pages.length - 1].closest('[data-key]') || pages[pages.length - 1].parentElement.parentElement.parentElement : null;
        return pg ? pg.innerText : document.getElementById('view-preview')?.innerText || '';
    });
    await page.evaluate(() => app.showForm());
    await page.waitForSelector(sel.intro);
    return txt;
}

test('条件8: 提案書の「土地紹介」ページ', async () => {
    let t = await overviewText();
    assert.match(t, /ダミーの紹介文（手で直した）/);
    assert.doesNotMatch(t, /ダミー物件Aの備考/);
    await page.fill(sel.intro, '');
    t = await overviewText();
    assert.match(t, /ダミー物件Aの備考/);
});

test('条件10: 文章でコピー', async () => {
    await page.locator('#land-check-0 button', { hasText: '文章でコピー' }).click();
    await page.waitForTimeout(200);
    const t = await clip();
    assert.match(t, /土地チェックシート（目安）/);
    assert.match(t, /建築面積の上限：82\.6㎡（約25\.0坪）/);
    assert.match(t, /■ 注意点/);
    assert.match(t, /役所・設計担当で確認/);
});

test('条件9: 既存の動き（古い案件・取り込み・ほかのページ）', async () => {
    // 改良前の形（道路欄・紹介文なし）の案件を端末内の保存場所に置いて開く
    const old = {
        id: 'dummy-old-1', clientName: 'ダミー旧案件', proposalDate: '2026-01-01', updatedAt: Date.now() + 1000,
        landInfos: [{ address: 'ダミー県ダミー市旧町1', area: '200 ㎡ (約 60.50 坪)', price: '1,000万円', current: '', category: '', delivery: '', zoning: '第一種住居地域', gas: '', terrain: '', water: '', coverage: '60%', conditions: '', far: '200%', restrictions: '', traffic: '', school: '', access: '', memo: '旧案件の備考' }],
    };
    await page.evaluate((rec) => new Promise((res, rej) => {
        const r = indexedDB.open('kawamura-proposal-local', 1);
        r.onsuccess = () => { const tx = r.result.transaction('proposals', 'readwrite'); tx.objectStore('proposals').put(rec, rec.id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); };
        r.onerror = () => rej(r.error);
    }), old);
    await page.waitForTimeout(500);
    await page.evaluate(() => app.loadProposal('dummy-old-1'));
    await page.waitForTimeout(800);
    assert.equal(await page.inputValue(sel.addr), 'ダミー県ダミー市旧町1');
    assert.equal(await page.inputValue(sel.width), '');
    assert.match(await out(), /120\.0㎡（約36\.3坪）/);   // 200㎡ × 60%
    assert.match(await out(), /間口を入れると表示/);
    // 資金計画などほかの欄が出ている
    assert.ok(await page.locator('#view-form').innerText().then(t => /資金計画/.test(t)));
    // 道路欄を入れてから「販売資料から自動入力」で取り込む → 道路欄と紹介文は空になる
    await page.fill(sel.width, '6');
    await page.fill(sel.intro, '消えるはずの紹介文');
    await page.evaluate(() => app.openLandImport(0));
    await page.fill('#li-paste-text', JSON.stringify({ '物件名': 'ダミー物件B', '所在地': 'ダミー市取込町5-6', '土地面積㎡': 180, '価格万円': 1200, '用途地域': '第二種住居地域', '建蔽率': 60, '容積率': 200, '備考': '南側4m道路' }));
    await page.evaluate(() => app.previewLandPaste());
    await page.evaluate(() => app.runLandPaste());
    await page.waitForTimeout(300);
    assert.equal(await page.inputValue(sel.addr), 'ダミー市取込町5-6');
    assert.equal(await page.inputValue(sel.width), '');
    assert.equal(await page.inputValue(sel.intro), '');
    assert.match(await page.inputValue(sel.memo), /ダミー物件B/);
    // プレビュー全体が作れる（資金計画・マイホームロボ等のページを含めてエラーなし）
    await page.evaluate(() => app.showPreview());
    await page.waitForTimeout(800);
    assert.match(await page.locator('#view-preview').innerText(), /土地紹介/);
    await page.evaluate(() => app.showForm());
    assert.deepEqual(pageErrors, []);
});
