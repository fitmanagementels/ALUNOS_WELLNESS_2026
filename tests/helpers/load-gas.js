const fs = require('node:fs');
const vm = require('node:vm');

function loadGas(files, additions = {}) {
  const context = vm.createContext({ console, ...additions });
  for (const file of files) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  return context;
}

module.exports = { loadGas };
