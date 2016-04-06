'use strict';
const objectAssign = require('object-assign');

function transformTitle(def, title) {
	if (!def.info) {
		def.info = {};
	}

	// Overwrite the name
	def.info.title = title || def.info.title;
}

function transformUri(uri, options) {
	uri = uri.split('/');

	// It only supports lambda functions
	if (/^arn:aws:apigateway:(.*?):lambda:path$/.test(uri[0])) {
		let gatewayArn = uri[0].split(':');
		let lambdaArn = uri[3].split(':');
		lambdaArn[4] = options.accountId || lambdaArn[4];

		if (options.awsRegion) {
			gatewayArn[3] = options.awsRegion;
			lambdaArn[3] = options.awsRegion;
		}

		if (options.accountId) {
			lambdaArn[4] = options.accountId;
		}

		if (options.alias) {
			lambdaArn[7] = options.alias;
		}

		uri[0] = gatewayArn.join(':');
		uri[3] = lambdaArn.join(':');
	}

	return uri.join('/');
}

function transformUris(def, options) {
	if (options.alias === undefined && options.accountId === undefined && options.awsRegion === undefined) {
		return;
	}

	Object.keys(def.paths || {}).forEach(path => {
		const methods = def.paths[path];

		Object.keys(methods).forEach(method => {
			const integration = methods[method]['x-amazon-apigateway-integration'];
			integration.uri = transformUri(integration.uri, options);
		});
	});
}

/**
 * Transforms the definition according to the options provided in the importer.
 *
 * @param {object}	definition		The swagger definition object.
 * @param {object}	options			The options object.
 */
exports.transform = function (definition, options) {
	options = options || {};
	const def = objectAssign({}, definition);

	// Transform the title
	transformTitle(def, options.name);

	// Transform all the uris
	transformUris(def, options);

	return def;
};
