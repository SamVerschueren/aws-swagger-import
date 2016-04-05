'use strict';
const uuid = require('uuid');
const AWS = require('aws-sdk');
const RestAPI = require('./restapi');
const APIResource = require('./apiresource');
const utils = require('./utils');

function sleep(s) {
	return new Promise(resolve => {
		setTimeout(resolve, s * 1000);
	});
}

function APIGateway(options) {
	AWS.config.region = options.awsRegion || 'us-west-1';

	// We don't want to use the whole options object in SharedIniFileCredentials so we build up
	// credentialsOptions
	let credentialsOptions = {
		profile: options.awsProfile
	};

	if (options.awsFilename) {
		credentialsOptions.filename = options.awsFilename;
	}
	// Load the config credentials
	AWS.config.credentials = new AWS.SharedIniFileCredentials(credentialsOptions);

	this._apiGateway = utils.pify(new AWS.APIGateway());
	this._lambda = utils.pify(new AWS.Lambda());

	this._exec = function (method, params, retry) {
		retry = retry || 0;

		return method(params)
			.catch(err => {
				if (err.retryable === true && retry < 10) {
					return sleep(2).then(() => this._exec(method, params, retry + 1));
				}

				throw err;
			});
	};
}

APIGateway.prototype.findRestApi = function (name) {
	return this._exec(this._apiGateway.getRestApis)
		.then(res => {
			return res.items.filter(item => item.name === name)[0];
		})
		.then(api => {
			if (api) {
				return api;
			}

			return this._apiGateway.createRestApi({name});
		})
		.then(api => new RestAPI(this, api))
		.then(restApi => {
			return this._apiGateway.getResources({restApiId: restApi.getID()})
				.then(resources => {
					resources.items.forEach(resource => restApi.addResource(new APIResource(resource)));
				})
				.then(() => restApi);
		});
};

APIGateway.prototype.createResource = function (params) {
	return this._exec(this._apiGateway.createResource, params);
};

APIGateway.prototype.putMethod = function (params) {
	return this._exec(this._apiGateway.putMethod, params);
};

APIGateway.prototype.putMethodResponse = function (params) {
	return this._exec(this._apiGateway.putMethodResponse, params);
};

APIGateway.prototype.putIntegration = function (params) {
	return this._exec(this._apiGateway.putIntegration, params);
};

APIGateway.prototype.putIntegrationResponse = function (params) {
	return this._exec(this._apiGateway.putIntegrationResponse, params);
};

APIGateway.prototype.addPermission = function (uri) {
	if (!/^arn:aws:apigateway:(.*?):lambda:path/.test(uri)) {
		// We can only handle lambda permissions for the moment
		return Promise.resolve();
	}

	const match = uri.match(/arn:aws:lambda:(.*?):(.*?):function:(.*?)\/invocations$/);

	if (!match || match.length !== 4) {
		// Do not handle if no match was found
		return Promise.resolve();
	}

	const permissionParams = {
		Action: 'lambda:InvokeFunction',
		FunctionName: match[3],
		Principal: 'apigateway.amazonaws.com',
		StatementId: uuid.v4()
	};

	return this._exec(this._lambda.addPermission, permissionParams);
};

module.exports = APIGateway;
