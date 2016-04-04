# aws-swagger-import [![Build Status](https://travis-ci.org/SamVerschueren/aws-swagger-import.svg?branch=master)](https://travis-ci.org/SamVerschueren/aws-swagger-import)

> AWS swagger importer


## Install

```
$ npm install --save aws-swagger-import
```


## Usage

```js
const awsSwaggerImport = require('aws-swagger-import');

awsSwaggerImport('swagger.json', {name: 'foo', profile: 'aws-profile'}).then(() => {
	// done
});
```


## API

### awsSwagger(file, [options])

#### file

Type: `string`

JSON swagger definition file.

#### options

##### name

*Required*  
Type: `string`

Name of the API Gateway to import to.

##### profile

*Required*  
Type: `string`

[AWS Profile](http://docs.aws.amazon.com/AWSJavaScriptSDK/guide/node-configuring.html). The user related to the profile should have
admin access to API Gateway and should be able to invoke `lambda:AddPermission`.

##### region

Type: `string`  
Default: `us-west-1`

AWS region.

##### filename

Type: `string`
Default: `~/.aws/credentials`

Filename used when when loading credentials with AWS.SharedIniFileCredentials. See
[AWS Documentation](http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/SharedIniFileCredentials.html#constructor-property).


## Related

- [aws-swagger-cli](https://github.com/SamVerschueren/aws-swagger-cli) - The CLI of this module


## License

MIT © [Sam Verschueren](https://github.com/SamVerschueren)
