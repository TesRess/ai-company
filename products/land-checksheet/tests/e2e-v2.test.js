// 画面の確認（第2版の完成の条件 11〜20）。ヘッドレスの Chromium + Playwright で改良版HTMLを開いて操作する。
// Firebase は未設定のまま（データは端末内に保存）。使うのはダミーデータだけ。
// 条件21（第1版の条件1〜10）は e2e.test.js / logic.test.js で確かめる。
// 実行: node --test products/land-checksheet/tests/e2e-v2.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { chromium } = require('playwright');

const FILE = 'file://' + path.join(__dirname, '..', 'kawamura_proposal.html');
const OUTSIDE = /disaportal\.gsi\.go\.jp|reinfolib\.mlit\.go\.jp|example\.com|google\.com\/maps|maps\.google\.com|gemini\.google\.com/;

let ctx, page, userDir;
const pageErrors = [];

const S = (i) => ({
    addr: `input[oninput^="app.updateLandInfo(${i}, 'address'"]`,
    area: `input[oninput^="app.calcTsubo(${i},"]`,
    zoning: `select[onchange^="app.updateLandInfo(${i}, 'zoning'"]`,
    cov: `input[oninput^="app.updateLandPercent(${i}, 'coverage'"]`,
    far: `input[oninput^="app.updateLandPercent(${i}, 'far'"]`,
    memo: `textarea[oninput^="app.updateLandInfo(${i}, 'memo'"]`,
    dir: `select[onchange^="app.updateLandInfo(${i}, 'roadDir'"]`,
    width: `input[oninput^="app.updateLandInfo(${i}, 'roadWidth'"]`,
    front: `input[oninput^="app.updateLandInfo(${i}, 'roadFrontage'"]`,
    type: `select[onchange^="app.updateLandInfo(${i}, 'roadType'"]`,
    corner: `select[onchange^="app.updateLandInfo(${i}, 'roadCorner'"]`,
    relief: `input[onchange^="app.updateLandInfo(${i}, 'cornerRelief'"]`,
    out: `#land-check-out-${i}`,
    intro: `#land-intro-${i}`,
});
const s0 = S(0);
const out = (i = 0) => page.locator(S(i).out).innerText();
const clip = () => page.evaluate(() => navigator.clipboard.readText());
const roadFields = async (i) => {
    const s = S(i);
    return {
        dir: await page.inputValue(s.dir), width: await page.inputValue(s.width), front: await page.inputValue(s.front),
        type: await page.inputValue(s.type), corner: await page.inputValue(s.corner), relief: await page.isChecked(s.relief),
    };
};
const EMPTY_ROAD = { dir: '', width: '', front: '', type: '', corner: '', relief: false };

const NO_FRONT = '※ 前面道路が4m未満ですが、間口が未入力のため、セットバック分を引かずに計算しています（建てられる大きさの目安がやや大きく出ています）。間口を入れると、セットバック分を引いて計算し直します。';

// 完成の条件14のダミーJSON（1物件）
const rec14 = { '物件名': 'ダミー分譲地A', '所在地': 'ダミー市ダミー町1丁目2-3', '土地面積㎡': '165.29', '価格万円': '1000', '用途地域': '第一種低層住居専用地域', '建蔽率': '50', '容積率': '100', '前面道路の方位': '南', '前面道路の幅m': '4', '間口m': '10', '公道私道': '公道', '角地・二方向道路': '', '備考': '南側 公道 幅員4m' };
const rec17 = { '物件名': 'ダミー分譲地B', '所在地': 'ダミー市ダミー町4丁目5-6', '土地面積㎡': '150', '用途地域': '第一種中高層住居専用地域', '建蔽率': '60', '容積率': '200', '備考': '北側 公道 幅員4m' };
const rec18 = { '物件名': 'ダミー分譲地C', '所在地': 'ダミー市ダミー町7丁目8-9', '土地面積㎡': '200', '用途地域': '第一種住居地域', '建蔽率': '60', '容積率': '200', '前面道路の方位': '北', '前面道路の幅m': '6', '間口m': '8', '公道私道': '私道' };

async function fillExample1() {
    await page.fill(s0.addr, 'ダミー市ダミー町1丁目2-3');
    await page.selectOption(s0.zoning, '第一種低層住居専用地域');
    await page.fill(s0.area, '165.29');
    await page.fill(s0.cov, '50');
    await page.fill(s0.far, '100');
    await page.selectOption(s0.dir, '南');
    await page.fill(s0.width, '4');
    await page.selectOption(s0.type, '公道');
    await page.fill(s0.front, '10');
}
// 「販売資料から自動入力」を開いて貼り付ける（取り込みボタンはまだ押さない）
async function openAndPaste(i, payload) {
    await page.locator(`#land-info-wrapper > div:nth-child(${i + 1}) button`, { hasText: '販売資料から自動入力' }).click();
    await page.waitForSelector('#land-import-modal:not(.hidden)');
    await page.fill('#li-paste-text', typeof payload === 'string' ? payload : JSON.stringify(payload));
}
async function importLand(i, payload) {
    await openAndPaste(i, payload);
    await page.locator('#li-paste-run').click();
    await page.waitForSelector('#land-import-modal', { state: 'hidden' });
    await page.waitForSelector(S(i).addr);
}

test.before(async () => {
    userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'land-check-e2e-v2-'));
    ctx = await chromium.launchPersistentContext(userDir, { headless: true, viewport: { width: 1400, height: 1000 } });
    await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
    await ctx.route(OUTSIDE, route => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>stub</p>' }));
    page = ctx.pages()[0] || await ctx.newPage();
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.goto(FILE, { waitUntil: 'load' });
    await page.locator('#start-screen button', { hasText: '新しいお客様を作成' }).click();
    await page.fill('#new-client-input', 'ダミー様2');
    await page.press('#new-client-input', 'Enter');
    await page.waitForSelector('#start-screen', { state: 'hidden', timeout: 30000 });
    await page.waitForSelector(s0.addr, { timeout: 30000 });
});
test.after(async () => {
    await ctx?.close();
    fs.rmSync(userDir, { recursive: true, force: true });
});

test('条件11: 4m未満・間口が空', async () => {
    await fillExample1();
    await page.fill(s0.width, '3.6');
    await page.fill(s0.front, '');
    let t = await out();
    assert.match(t, /建築面積の上限\s+82\.6㎡/);
    assert.match(t, /延床面積の上限\s+165\.3㎡/);
    assert.ok(t.includes(NO_FRONT), t);
    // 文章でコピーにも入る
    await page.locator('#land-check-0 button', { hasText: '文章でコピー' }).click();
    await page.waitForTimeout(200);
    assert.ok((await clip()).includes(NO_FRONT.replace(/^※ /, '')));
    // 間口を入れると文が消えて引いた数字になる
    await page.fill(s0.front, '10');
    t = await out();
    assert.ok(!t.includes('間口が未入力のため'), t);
    assert.match(t, /81\.6㎡（約24\.7坪）/);
    assert.match(t, /163\.3㎡（約49\.4坪）/);
});

test('条件12: セットバックの意味', async () => {
    let t = await out();
    assert.match(t, /セットバック\s+セットバック約0\.2m、敷地が約2\.0㎡減る（セットバック：道路の幅4mを確保するため、道路の中心から2mの線まで敷地を下げること。下げた部分には建物も塀も建てられません）/);
    await page.fill(s0.width, '4');
    t = await out();
    assert.doesNotMatch(t, /セットバック/);
    assert.doesNotMatch(t, /建物も塀も建てられません/);
});

test('条件13: 用途地域が空の道路斜線', async () => {
    await page.selectOption(s0.zoning, '');
    let t = await out();
    assert.match(t, /道路斜線.*用途地域によって1\.25または1\.5/);
    assert.doesNotMatch(t, /北側斜線|高さの制限|隣地斜線/);
    await page.selectOption(s0.zoning, '第一種低層住居専用地域');
    t = await out();
    assert.match(t, /道路斜線：道路の反対側から勾配1\.25/);
    assert.doesNotMatch(t, /1\.25または1\.5/);
    await page.selectOption(s0.zoning, '指定なし（市街化調整区域等）');
    assert.doesNotMatch(await out(), /道路斜線/);
    await page.selectOption(s0.zoning, '第一種低層住居専用地域');
});

test('条件20: プロンプトに道路の5項目とルールが入る', async () => {
    await page.locator('#land-info-wrapper > div:nth-child(1) button', { hasText: '販売資料から自動入力' }).click();
    await page.waitForSelector('#land-import-modal:not(.hidden)');
    await page.locator('#land-import-modal button', { hasText: '内容を表示' }).click();
    const p = await page.locator('#li-prompt-view').innerText();
    for (const k of ['"前面道路の方位"', '"前面道路の幅m"', '"間口m"', '"公道私道"', '"角地・二方向道路"']) assert.ok(p.includes(k), k);
    assert.match(p, /道路が複数ある場合、前面道路の方位・幅・間口は一番広い道路のものにし、ほかの道路の方位と幅は備考に書いてください/);
    assert.ok(p.indexOf('"角地・二方向道路"') < p.indexOf('"備考"'), '道路の項目は備考の前');
    assert.match(p, /接道状況/);
    // 「プロンプトをコピー」でも同じ文が入る
    await page.locator('#land-import-modal button', { hasText: 'プロンプトをコピー' }).click();
    await page.waitForTimeout(200);
    assert.equal((await clip()).trim(), p.trim());
    await page.locator('#land-import-modal button', { hasText: '閉じる' }).click();
});

test('条件14: 道路項目入りのダミーJSONの取り込み', async () => {
    await page.fill(s0.intro, '');
    await openAndPaste(0, [rec14]);
    const prev = await page.locator('#li-paste-preview').innerText();
    assert.match(prev, /道路/);
    assert.match(prev, /南 4m 間口10m 公道/);
    await page.locator('#li-paste-run').click();
    await page.waitForSelector('#land-import-modal', { state: 'hidden' });
    assert.equal(await page.locator('#confirm-modal:not(.hidden)').count(), 0, '紹介文が空なのに確認が出た');
    assert.deepEqual(await roadFields(0), { dir: '南', width: '4', front: '10', type: '公道', corner: '', relief: false });
    const t = await out();
    assert.match(t, /建築面積の上限\s+82\.6㎡（約25\.0坪）/);
    assert.match(t, /延床面積の上限\s+165\.3㎡（約50\.0坪）/);
    assert.match(t, /3台（間口から3台、空き地の広さから5台 → 小さい方）/);
});

test('条件15: 表記ゆれ', async () => {
    await importLand(0, [{ ...rec14, '前面道路の方位': '南側', '前面道路の幅m': '4.0m', '間口m': '約10m', '公道私道': '市道' }]);
    assert.deepEqual(await roadFields(0), { dir: '南', width: '4', front: '10', type: '公道', corner: '', relief: false });
    // 方位が「NE」なら方位だけ空
    await importLand(0, [{ ...rec14, '前面道路の方位': 'NE' }]);
    assert.deepEqual(await roadFields(0), { dir: '', width: '4', front: '10', type: '公道', corner: '', relief: false });
    // キーの別名（幅員・間口・道路方位）
    const alt = { ...rec14 };
    delete alt['前面道路の方位']; delete alt['前面道路の幅m']; delete alt['間口m'];
    Object.assign(alt, { '道路方位': '南', '幅員': '4', '間口': '10' });
    await importLand(0, [alt]);
    assert.deepEqual(await roadFields(0), { dir: '南', width: '4', front: '10', type: '公道', corner: '', relief: false });
    // 英語の内部名・「NE」以外のあいまいな値・崩れた数字
    await importLand(0, [{ '所在地': 'ダミー市ダミー町1丁目2-3', road_dir: '南・西', road_width: '3,6', road_frontage: '0', road_type: '位置指定道路', road_corner: '2方向' }]);
    assert.deepEqual(await roadFields(0), { dir: '', width: '', front: '', type: '私道', corner: '二方向道路', relief: false });
});

test('条件16: 角地', async () => {
    await importLand(0, [{ ...rec14, '角地・二方向道路': '角地' }]);
    assert.deepEqual(await roadFields(0), { dir: '南', width: '4', front: '10', type: '公道', corner: '角地', relief: false });
    const t = await out();
    assert.match(t, /建築面積の上限\s+82\.6㎡/);
    assert.match(t, /もう一方の道路の幅も確認/);
    assert.match(t, /役所で確認できたら『角地の緩和あり』にチェック/);
    // 手でも直せる
    await page.selectOption(s0.corner, '');
    assert.doesNotMatch(await out(), /もう一方の道路の幅も確認/);
});

test('条件17: 古い形式のJSON', async () => {
    await importLand(0, [rec17]);
    assert.equal(await page.inputValue(s0.addr), 'ダミー市ダミー町4丁目5-6');
    assert.equal(await page.inputValue(s0.area), '150');
    assert.equal(await page.inputValue(s0.zoning), '第一種中高層住居専用地域');
    assert.equal(await page.inputValue(s0.cov), '60');
    assert.equal(await page.inputValue(s0.far), '200');
    assert.match(await page.inputValue(s0.memo), /北側 公道 幅員4m/);
    assert.deepEqual(await roadFields(0), EMPTY_ROAD);
    assert.deepEqual(pageErrors, []);
});

test('条件19: 紹介文が入った候補への取り込み', async () => {
    await page.fill(s0.intro, 'ダミーの紹介文');
    await page.fill(s0.memo, '手で入れた備考');
    await openAndPaste(0, [rec14]);
    await page.locator('#li-paste-run').click();
    await page.waitForSelector('#confirm-modal:not(.hidden)');
    assert.match(await page.locator('#confirm-modal').innerText(), /この候補の土地紹介文（と手で入れた内容）は、取り込んだ内容で置き換わります。取り込みますか？/);
    // やめる → 何も変わらない
    await page.locator('#confirm-modal button', { hasText: 'やめる' }).click();
    await page.waitForSelector('#confirm-modal', { state: 'hidden' });
    await page.locator('#land-import-modal button', { hasText: '閉じる' }).click();
    assert.equal(await page.inputValue(s0.intro), 'ダミーの紹介文');
    assert.equal(await page.inputValue(s0.memo), '手で入れた備考');
    assert.equal(await page.inputValue(s0.addr), 'ダミー市ダミー町4丁目5-6');
    assert.deepEqual(await roadFields(0), EMPTY_ROAD);
    assert.equal(await page.evaluate(() => document.querySelectorAll('#land-info-wrapper > div').length), 1);
    // 取り込む → 紹介文は空、道路欄が入る
    await openAndPaste(0, [rec14]);
    await page.locator('#li-paste-run').click();
    await page.waitForSelector('#confirm-modal:not(.hidden)');
    await page.locator('#confirm-modal button', { hasText: '取り込む' }).click();
    await page.waitForSelector('#land-import-modal', { state: 'hidden' });
    assert.equal(await page.inputValue(s0.intro), '');
    assert.deepEqual(await roadFields(0), { dir: '南', width: '4', front: '10', type: '公道', corner: '', relief: false });
    // ほかの確認（削除など）のボタン名は今まで通り
    assert.equal(await page.evaluate(() => { app.addLandInfo(); return true; }), true);
    await page.waitForSelector(S(1).addr);
    await page.locator('#land-info-wrapper > div:nth-child(2) button', { hasText: '削除' }).click();
    await page.waitForSelector('#confirm-modal:not(.hidden)');
    assert.equal(await page.locator('#confirm-cancel').innerText(), 'キャンセル');
    await page.locator('#confirm-ok').click();
    await page.waitForSelector('#confirm-modal', { state: 'hidden' });
    await page.waitForFunction(() => document.querySelectorAll('#land-info-wrapper > div').length === 1);
});

test('条件18: 複数物件', async () => {
    await importLand(0, [rec14, rec18]);
    await page.waitForSelector(S(1).addr);
    assert.equal(await page.inputValue(S(1).addr), 'ダミー市ダミー町7丁目8-9');
    assert.deepEqual(await roadFields(0), { dir: '南', width: '4', front: '10', type: '公道', corner: '', relief: false });
    assert.deepEqual(await roadFields(1), { dir: '北', width: '6', front: '8', type: '私道', corner: '', relief: false });
    assert.match(await out(1), /私道の持ち分/);
    assert.deepEqual(pageErrors, []);
});
