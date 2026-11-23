// テスト用のダミー土地情報（実在の物件・お客様とは関係ありません）
const base = {
    address: 'ダミー市ダミー町1丁目2-3', area: '165.29 ㎡ (約 50.00 坪)', price: '1,500万円',
    zoning: '第一種低層住居専用地域', coverage: '50%', far: '100%', restrictions: '',
    traffic: '', school: '', memo: 'ダミー物件A',
    roadDir: '南', roadWidth: '4', roadFrontage: '10', roadType: '公道', cornerRelief: false, intro: '',
};
const ex1 = { ...base };
const ex2 = { ...base, roadWidth: '3.6' };
const ex3 = { ...base, zoning: '第一種中高層住居専用地域', area: '150 ㎡ (約 45.38 坪)', coverage: '60%', far: '200%', roadDir: '北', roadWidth: '4', roadFrontage: '8' };
module.exports = { base, ex1, ex2, ex3 };
