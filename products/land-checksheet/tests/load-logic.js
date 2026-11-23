// 改良版HTMLから「土地チェックシートの計算部分」だけを取り出して Node で動かす
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadLandCheck() {
    const html = fs.readFileSync(path.join(__dirname, '..', 'kawamura_proposal.html'), 'utf8');
    const m = html.match(/<script id="land-checksheet-logic">([\s\S]*?)<\/script>/);
    if (!m) throw new Error('計算部分の <script id="land-checksheet-logic"> が見つかりません');
    const ctx = { window: {} };
    vm.createContext(ctx);
    vm.runInContext(m[1], ctx);
    return ctx.window.LandCheck;
}
module.exports = { loadLandCheck };
