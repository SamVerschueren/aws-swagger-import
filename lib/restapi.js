'use strict';
const path = require('path');
const objectAssign = require('object-assign');
const logSymbols = require('log-symbols');
const APIResource = require('./apiresource');
const patch = require('./utils').patch;

function RestAPI(apiGateway, api) {
	this._apiGateway = apiGateway;
	this._api = api;

	this._resources = {};
}

RestAPI.prototype.getID = function () {
	return this._api.id;
};

RestAPI.prototype.getName = function () {
	return this._api.name;
};

RestAPI.prototype.addResource = function (resource) {
	this._resources[resource.path] = resource;
};

RestAPI.prototype.createResource = function (parent, pathPart) {
	if (pathPart[0] === '/') {
		pathPart = pathPart.substring(1);
	}

	return this._apiGateway.createResource({restApiId: this._api.id, parentId: parent.id, pathPart});
};

RestAPI.prototype.addMethod = function (path, httpMethod, descriptor) {
	const base = {
		restApiId: this._api.id,
		resourceId: this._resources[path].id,
		httpMethod: httpMethod.toUpperCase()
	};

	const methodParams = objectAssign({
		authorizationType: (descriptor.security || []).find(e => e.sigv4) ? 'AWS_IAM' : 'NONE',
		apiKeyRequired: Boolean((descriptor.security || []).find(e => e.api_key)),
		requestParameters: {}
	}, base);

	(descriptor.parameters || []).forEach(param => {
		methodParams.requestParameters[`method.request.${param.in}.${param.name}`] = param.required;
	});

	return this._apiGateway.putMethod(methodParams)
		.then(() => {
			const integration = descriptor['x-amazon-apigateway-integration'];

			const integrationParams = objectAssign({
				type: integration.type.toUpperCase(),
				uri: integration.uri,
				requestTemplates: integration.requestTemplates,
				integrationHttpMethod: integration.httpMethod
			}, base);

			return this._apiGateway.putIntegration(integrationParams)
				.then(() => {
					return this._apiGateway.addPermission(integration.uri);
				});
		})
		.then(() => {
			let promise = Promise.resolve();

			Object.keys(descriptor.responses).forEach(statusCode => {
				const methodResponseParams = objectAssign({
					statusCode,
					responseModels: {},
					responseParameters: {}
				}, base);

				// Add the responseModel
				if (descriptor.responses[statusCode].schema) {
					const ref = descriptor.responses[statusCode].schema.$ref.replace('#/definitions/', '');
					methodResponseParams.responseModels[descriptor.produces[0]] = ref;
				}

				// Add the responseParameters
				Object.keys(descriptor.responses[statusCode].headers || {}).forEach(header => {
					methodResponseParams.responseParameters[`method.response.header.${header}`] = true;
				});

				promise = promise.then(() => this._apiGateway.putMethodResponse(methodResponseParams));
			});

			return promise;
		})
		.then(() => {
			let promise = Promise.resolve();

			Object.keys(descriptor['x-amazon-apigateway-integration'].responses).forEach(selectionPattern => {
				const value = descriptor['x-amazon-apigateway-integration'].responses[selectionPattern];

				const obj = objectAssign(value, {
					selectionPattern: selectionPattern === 'default' ? '-' : selectionPattern
				}, base);

				// Add an output passthrough response template if the selection pattern is the default
				if (selectionPattern === 'default' && !obj.responseTemplates) {
					obj.responseTemplates = {};
					obj.responseTemplates[descriptor.produces[0]] = '';
				}

				promise = promise.then(() => this._apiGateway.putIntegrationResponse(obj));
			});

			return promise;
		});
};

RestAPI.prototype.updateMethod = function (path, httpMethod, descriptor) {
	const base = {
		restApiId: this._api.id,
		resourceId: this._resources[path].id,
		httpMethod: httpMethod.toUpperCase()
	};

	return this._apiGateway.getMethod(base)
		.then(methodDescriptor => {
			// Define the basic patch operations
			const patchOperations = [
				patch.replace('/authorizationType', (descriptor.security || []).find(e => e.sigv4) ? 'AWS_IAM' : 'NONE'),
				patch.replace('/apiKeyRequired', Boolean((descriptor.security || []).find(e => e.api_key)))
			];

			const methodRequestParams = methodDescriptor.requestParameters || {};
			const requestParams = {};

			// Create a key-value map
			(descriptor.parameters || []).forEach(param => {
				requestParams[`method.request.${param.in}.${param.name}`] = param.required;
			});

			// Remove the `requestParameters` that are not defined anymore
			Object.keys(methodRequestParams || {}).forEach(key => {
				if (requestParams[key] === undefined) {
					patchOperations.push(patch.remove(`/requestParameters/${key}`));
				}
			});

			// Add or replace the `requestParameters` of they where newly added or changed
			Object.keys(requestParams).forEach(key => {
				const value = requestParams[key];

				if (methodRequestParams[key] === undefined) {
					patchOperations.push(patch.add(`/requestParameters/${key}`, value));
				} else if (value !== methodRequestParams[key]) {
					patchOperations.push(patch.replace(`/requestParameters/${key}`, value));
				}
			});

			// Update the method
			return this._apiGateway.updateMethod(objectAssign({patchOperations}, base));
		});
};

RestAPI.prototype.import = function (content) {
	let promise = Promise.resolve()
		.then(() => {
			console.log('Creating all the resources...');
		});

	// Step 1: Create all the resources
	Object.keys(content.paths).forEach(resourcePath => {
		promise = promise
			.then(() => {
				const resourcePaths = resourcePath.split('/').map(el => `/${el}`);

				let parent;
				let pathUrl = resourcePaths[0];

				// Search the parent resource
				while (this._resources[pathUrl] && resourcePaths.length > 0) {
					console.log(`    ${logSymbols.success}  ${pathUrl}`);
					parent = this._resources[pathUrl];
					resourcePaths.shift();

					if (resourcePaths.length > 0) {
						pathUrl = path.join(parent ? parent.path : '', resourcePaths[0]);
					}
				}

				let innerPromise = Promise.resolve(parent);

				// Iterate over the resource paths and create them accordingly
				resourcePaths.forEach(resourcePath => {
					innerPromise = innerPromise.then(parent => {
						return this.createResource(parent, resourcePath)
							.then(resource => new APIResource(resource))
							.then(resource => {
								console.log(`    ${logSymbols.success}  ${resource.path}`);
								this.addResource(resource);
								return resource;
							});
					});
				});

				return innerPromise;
			});
	});

	promise = promise.then(() => console.log('\nCreating all the methods...'));

	// Step 2: Create all the methods
	Object.keys(content.paths).forEach(path => {
		promise = promise
			.then(() => {
				const methods = content.paths[path];

				let promise = Promise.resolve();

				Object.keys(content.paths[path]).forEach(method => {
					promise = promise
						.then(() => {
							return this.addMethod(path, method, methods[method])
								.catch(err => {
									if (err.name === 'ConflictException') {
										return this.updateMethod(path, method, methods[method]);
									}

									throw err;
								});
						})
						.then(() => console.log(`    ${logSymbols.success}  ${method.toUpperCase()} ${path}`));
				});

				return promise;
			});
	});

	return promise;
};

module.exports = RestAPI;
