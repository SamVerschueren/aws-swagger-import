'use strict';
const fs = require('fs');
const pathExists = require('path-exists');
const pify = require('pify');
const APIGateway = require('./lib/apigateway');
const transformer = require('./lib/transformer');
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

			// Transform the definition
			const definition = transformer.transform(contents, options);
			const name = definition.info.title;

			if (!name) {
				// Trow an error if the name could not be determined
				throw utils.createError('No AWS API gateway name provided');
			}

			return gateway.findRestApi(name)
				.then(api => {
					return api.import(definition);
				});
		})
		.catch(err => {
			if (err.name === 'SyntaxError') {
				throw utils.createError('Input file provided is not valid JSON');
			}

			throw err;
		});
};
