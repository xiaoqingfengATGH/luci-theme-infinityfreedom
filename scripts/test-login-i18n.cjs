// Exercise the actual login password handler with translated DOM labels.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const template = fs.readFileSync(path.join(__dirname, '../luci-theme-infinityfreedom-ng/ucode/template/themes/infinityfreedom-ng/footer_login.ut'), 'utf8');
const script = template.match(/<script>([\s\S]*?)<\/script>/)[1];
for (const [show, hide] of [['Show password', 'Hide password'], ['显示密码', '隐藏密码']]) {
  const events = {}, attrs = {'data-show-label': show, 'data-hide-label': hide};
  const input = {type: 'password', value: 'unchanged', form: {addEventListener: (key, fn) => events[key] = fn}};
  const toggle = {classList: {toggle() {}}, setAttribute: (key, value) => attrs[key] = value, getAttribute: key => attrs[key], addEventListener: (key, fn) => events[key] = fn};
  vm.runInNewContext(script, {document: {getElementById: id => id === 'password' ? input : toggle}});
  events.click();
  assert.equal(input.type, 'text');
  assert.equal(attrs['aria-label'], hide);
  assert.equal(attrs['aria-pressed'], 'true');
  events.click();
  assert.equal(input.type, 'password');
  assert.equal(attrs['aria-label'], show);
  events.click(); events.reset();
  assert.equal(input.type, 'password');
  assert.equal(attrs['aria-label'], show);
  assert.equal(attrs['aria-pressed'], 'false');
  assert.equal(input.value, 'unchanged');
}
console.log('PASS: actual login handler toggles/resets English and Chinese accessible labels without changing password');
