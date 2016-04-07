'use strict';
const crypto = require('crypto');
const path = require('path');
const AWS = require('aws-sdk');
const delay = require('delay');
const RestAPI = require('./restapi');
const utils = require('./utils');

function APIGateway(options) {
	AWS.config.region = options.awsRegion || 'us-west-1';

	if (options.awsProfile) {
		// Set the `credentials` property if a profile is provided
		const objectCredentials = {
			profile: options.awsProfile
		};

		if (options.awsFilename) {
			objectCredentials.filename = path.resolve(process.cwd(), options.awsFilename);
		}

		AWS.config.credentials = new AWS.SharedIniFileCredentials(objectCredentials);
	}

	this._apiGateway = utils.pify(new AWS.APIGateway());
	this._lambda = utils.pify(new AWS.Lambda());

	this._exec = function (method, params, retry) {
		retry = retry || 0;

		return method(params)
			.catch(err => {
				if (err.retryable === true && retry < 10) {
					return delay(2000).then(() => this._exec(method, params, retry + 1));
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

			return this._exec(this._apiGateway.createRestApi, {name});
		})
		.then(api => new RestAPI(this, api));
};

APIGateway.prototype.putRestApi = function (params) {
	return this._exec(this._apiGateway.putRestApi, params);
};

APIGateway.prototype.addPermission = function (uri) {
	const parts = uri.split('/');

	if (!/^arn:aws:apigateway:(.*?):lambda:path$/.test(parts[0])) {
		// We can only handle lambda permissions for the moment
		return Promise.resolve();
	}

	if (!/^arn:aws:lambda:(.*?):(.*?):function:(.*?)$/.test(parts[3])) {
		// Do nothing if the arn is not a lambda arn
		return Promise.resolve();
	}

	const FunctionName = parts[3];
	const StatementId = crypto.createHash('md5').update(parts[3]).digest('hex');

	// Construct the permission object
	const permissionParams = {
		Action: 'lambda:InvokeFunction',
		Principal: 'apigateway.amazonaws.com',
		FunctionName,
		StatementId
	};

	return this._exec(this._lambda.addPermission, permissionParams)
		.catch(err => {
			if (err.code === 'ResourceConflictException') {
				// If a conflict occurs, remove the permission and re add it
				return this._exec(this._lambda.removePermission, {FunctionName, StatementId})
					.then(() => this.addPermission(uri));
			}

			throw err;
		});
};

module.exports = APIGateway;
