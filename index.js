'use strict';
const fs = require('fs');
const pathExists = require('path-exists');
const pify = require('pify');
const APIGateway = require('./lib/apigateway');
const utils = require('./lib/utils');

const fsP = pify(fs);

module.exports = function (filePath, options) {
	options = options || {};

	if (typeof filePath !== 'string' || !pathExists.sync(filePath)) {
		return Promise.reject(utils.createError('Input file does not exist'));
	}

	// Initialize the gateway
	const gateway = new APIGateway(options);

	return fsP.readFile(filePath, 'utf8')
		.then(contents => {
			// Parse the contents
			contents = JSON.parse(contents.toString());

			// Determine the name
			let name = options.name || (contents.info && contents.info.title);

			if (!name) {
				throw utils.createError('No AWS API gateway name provided');
			}

			if (contents.info) {
				// Make sure to overwrite the title
				contents.info.title = name;
			}

			return gateway.findRestApi(name)
				.then(api => {
					return api.import(contents);
				});
		})
		.catch(err => {
			if (err.name === 'SyntaxError') {
				throw utils.createError('Input file provided is not valid JSON');
			}

			throw err;
		});
};
