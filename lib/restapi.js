'use strict';
function RestAPI(apiGateway, api) {
	this._apiGateway = apiGateway;
	this._api = api;

	this._resources = {};
}

RestAPI.prototype._addPermissions = function (content) {
	const promises = [];
	const paths = content.paths;

	Object.keys(paths).forEach(path => {
		const methods = paths[path];
		Object.keys(methods).forEach(method => {
			const integration = methods[method]['x-amazon-apigateway-integration'];
			promises.push(this._apiGateway.addPermission(integration.uri));
		});
	});

	return Promise.all(promises);
};

RestAPI.prototype.import = function (content) {
	var params = {
		restApiId: this._api.id,
		body: JSON.stringify(content),
		mode: 'overwrite'
	};

	return this._apiGateway.putRestApi(params)
		.then(result => {
			return this._addPermissions(content).then(() => result);
		});
};

module.exports = RestAPI;
