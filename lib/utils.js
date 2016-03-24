'use strict';
const pify = require('pify');

module.exports.pify = function (obj) {
	var result = {};

	for (const key in obj) {
		if (typeof obj[key] === 'function') {
			result[key] = pify(obj[key].bind(obj));
		} else {
			result[key] = obj[key];
		}
	}

	return result;
};
