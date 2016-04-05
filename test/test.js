import test from 'ava';
import tempWrite from 'temp-write';
import m from '../';

test('incorrect input file', async t => {
	const err = await t.throws(m(4, {}), 'Input file does not exist');
	t.throws(m('./fixtures/swagg.json', {}), 'Input file does not exist');
	t.true(err.friendly);
});

test('input file is not json', async t => {
	const input = await tempWrite('foo', 'swagger.json');
	const err = await t.throws(m(input), 'Input file provided is not valid JSON');
	t.true(err.friendly);
});

test('no API Gateway name found', async t => {
	const input = await tempWrite('{}', 'swagger.json');
	const err = await t.throws(m(input, {}), 'No AWS API gateway name provided');
	t.true(err.friendly);
});
