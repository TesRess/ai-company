// 計算部分のテスト（完成の条件 1〜5・7 の数字と文言）
// 実行: node --test products/land-checksheet/tests/logic.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadLandCheck } = require('./load-logic');
const { ex1, ex2, ex3 } = require('./dummy-lands');

const LC = loadLandCheck();
const rowMap = (land) => Object.fromEntries(LC.rows(LC.calc(land)));
const noteKeys = (land) => LC.calc(land).notes.map(n => n.key);
const notesText = (land) => LC.calc(land).notes.map(n => n.text).join('\n');

test('条件1: 基本の例', () => {
    const c = LC.calc(ex1);
    assert.equal(LC.r1(c.building), '82.6');
    assert.equal(LC.r1(LC.tsubo(c.building)), '25.0');
    assert.equal(LC.r1(c.total), '165.3');
    assert.equal(LC.r1(LC.tsubo(c.total)), '50.0');
    assert.equal(c.far, 100);
    assert.equal(c.farRoad, 160);
    const r = rowMap(ex1);
    assert.match(r['建築面積の上限'], /82\.6㎡（約25\.0坪）/);
    assert.match(r['延床面積の上限'], /165\.3㎡（約50\.0坪）/);
    assert.match(r['延床面積の上限'], /使う容積率は 100%（道路による制限 160% より指定の方が小さいため）/);
    assert.match(r['平屋なら'], /約25\.0坪まで/);
    assert.match(r['2階建てなら'], /約50\.0坪まで/);
    assert.equal(c.parking, 3);
    assert.match(r['駐車台数の目安（並べて止める場合）'], /3台（間口から3台、空き地の広さから5台 → 小さい方）/);
    const keys = noteKeys(ex1);
    assert.ok(keys.includes('road-slope'));
    assert.ok(keys.includes('north-slope'));
    assert.ok(keys.includes('height'));
    assert.ok(!keys.includes('neighbor-slope'));
    assert.ok(!keys.includes('setback'));
    const t = notesText(ex1);
    assert.match(t, /道路斜線/);
    assert.match(t, /北側斜線.*南道路なので.*北側の屋根の形に影響が出やすい/);
    assert.match(t, /10mまたは12m/);
    assert.match(LC.toText(ex1), /目安/);
    assert.match(LC.toText(ex1), /役所・設計担当で確認/);
});

test('条件2: 道路が狭い例（セットバック）', () => {
    const c = LC.calc(ex2);
    const r = rowMap(ex2);
    assert.equal(r['セットバック'], 'セットバック約0.2m、敷地が約2.0㎡減る');
    assert.match(r['セットバック後の面積'], /元の面積 165\.29㎡/);
    assert.equal(LC.r1(c.building), '81.6');
    assert.equal(LC.r1(LC.tsubo(c.building)), '24.7');
    assert.equal(LC.r1(c.total), '163.3');
    assert.equal(LC.r1(LC.tsubo(c.total)), '49.4');
    assert.match(r['建築面積の上限'], /81\.6㎡（約24\.7坪）/);
    assert.match(r['延床面積の上限'], /163\.3㎡（約49\.4坪）/);
    assert.ok(noteKeys(ex2).includes('setback'));
});

test('条件3: 道路で容積率が下がる例', () => {
    const c = LC.calc(ex3);
    const r = rowMap(ex3);
    assert.match(r['建築面積の上限'], /90\.0㎡（約27\.2坪）/);
    assert.match(r['延床面積の上限'], /240\.0㎡（約72\.6坪）/);
    assert.match(r['延床面積の上限'], /道路の幅のため 200% → 160% で計算/);
    assert.equal(c.parking, 2);
    assert.match(notesText(ex3), /北側が道路なので、北側斜線は比較的ゆるい/);
    assert.ok(noteKeys(ex3).includes('neighbor-slope'));
});

test('条件4: 注意が強く出る例', () => {
    assert.match(notesText({ ...ex1, roadFrontage: '1.8' }), /接道（2m以上）を満たさない恐れ.*建て替えできない土地の可能性/);
    assert.match(notesText({ ...ex1, restrictions: '準防火地域' }), /防火/);
    assert.ok(!noteKeys(ex1).includes('fire'));
    const none = { ...ex1, zoning: '指定なし（市街化調整区域等）' };
    const c = LC.calc(none);
    assert.equal(c.notes[0].key, 'chosei');
    assert.match(c.notes[0].text, /家が建てられない場合がある/);
    const r = rowMap(none);
    assert.equal(r['建築面積の上限'], undefined);
    assert.equal(r['延床面積の上限'], undefined);
    assert.equal(r['平屋なら'], undefined);
    // その他の注意
    assert.match(notesText({ ...ex1, roadType: '私道' }), /私道の持ち分/);
    assert.match(notesText({ ...ex1, restrictions: '北側斜線制限・高度地区' }), /高度地区/);
    assert.match(notesText({ ...ex1, restrictions: '景観法' }), /届出/);
    assert.match(notesText({ ...ex1, restrictions: '宅地造成等規制法' }), /擁壁/);
});

test('条件5: 未入力でも止まらない', () => {
    const empty = LC.calc({});
    assert.ok(Array.isArray(empty.notes));
    const r0 = rowMap({});
    assert.equal(r0['敷地面積'], '—');
    assert.equal(r0['建築面積の上限'], '—');
    const r = rowMap({ ...ex1, area: '', coverage: '' });
    assert.equal(r['建築面積の上限'], '—');
    assert.equal(r['延床面積の上限'], '—');
    const r2 = rowMap({ ...ex2, roadFrontage: '' });
    assert.equal(r2['駐車台数の目安（並べて止める場合）'], '間口を入れると表示');
    assert.match(r2['セットバック'], /間口を入れると表示/);
    assert.doesNotThrow(() => LC.toText({}));
    assert.doesNotThrow(() => LC.introDraft({}));
    // 最後は必ず自治体ごとの確認
    const n = LC.calc({}).notes;
    assert.equal(n[n.length - 1].key, 'local');
});

test('角地の緩和と住居系以外の係数', () => {
    const c = LC.calc({ ...ex1, cornerRelief: true });
    assert.equal(c.coverage, 60);
    const s = LC.calc({ ...ex3, zoning: '近隣商業地域', far: '300%', roadWidth: '4' });
    assert.equal(s.farRoad, 240);
    assert.equal(s.far, 240);
    assert.match(s.notes.map(n => n.text).join(), /勾配1\.5/);
    const wide = LC.calc({ ...ex3, roadWidth: '12' });
    assert.equal(wide.far, 200);
    assert.equal(wide.farRoad, null);
});

test('条件7: 土地紹介文の下書き', () => {
    const t = LC.introDraft({ ...ex1, traffic: 'ダミー線ダミー駅 徒歩10分', school: 'ダミー小学校 徒歩5分' });
    for (const w of ['第一種低層住居専用地域', '約50.0坪（165.29㎡）', '南側の4m道路', '日当たり', '建ぺい率50%・容積率100%', '2階建てなら延床約50.0坪', '目安', 'ダミー駅', 'ダミー小学校']) {
        assert.ok(t.includes(w), `「${w}」が入っていない: ${t}`);
    }
});

test('条件6: 都市計画図リンクの一致', () => {
    const links = [{ city: 'ダミー市', url: 'https://example.com/dummy-cityplan' }, { city: 'ほか市', url: 'https://example.com/x' }];
    assert.equal(JSON.stringify(LC.matchCityLinks('ダミー市ダミー町1丁目2-3', links).map(l => l.city)), '["ダミー市"]');
    assert.equal(LC.matchCityLinks('', links).length, 0);
});

test('条件10: 文章でコピーの中身', () => {
    const t = LC.toText(ex2);
    assert.match(t, /土地チェックシート（目安）/);
    assert.match(t, /セットバック約0\.2m、敷地が約2\.0㎡減る/);
    assert.match(t, /■ 注意点/);
    assert.match(t, /日影規制/);
});
