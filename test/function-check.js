QUnit.test( "测试 encodeHTML", function( assert ) {
  assert.ok( encodeHTML('>') == "&gt;", "通过" );
  assert.ok( encodeHTML('中') == "中", "通过" );
});
QUnit.test( "测试 getTitleAndLevel", function( assert ) {
  assert.ok( getTitleAndLevel('# 第一').level == "1", "通过" );
  assert.ok( getTitleAndLevel('# 第一').title == "第一", "通过" );
  assert.ok( getTitleAndLevel('正文').level == "0", "通过" );
  assert.ok( getTitleAndLevel('正文').title == "正文", "通过" );
});
