'use strict';
function RestAPI(apiGateway, api) {
	this._apiGateway = apiGateway;
	this._api = api;

	this._resources = {};
}

RestAPI.prototype.import = function (content) {
	var params = {
		restApiId: this._api.id,
		body: JSON.stringify(content),
		mode: 'overwrite'
	};

	return this._apiGateway.putRestApi(params);
};

module.exports = RestAPI;
