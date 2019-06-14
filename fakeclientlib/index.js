const Me = require('./lib/me');
const Inventory = require('./lib/inventory');

module.exports = (d) => {
    d.me = new Me(d);
    d.inventory = new Inventory(d);
}