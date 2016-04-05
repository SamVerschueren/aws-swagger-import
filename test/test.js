import test from 'ava';
import m from '../';

test('incorrect input file', async t => {
	const err = await t.throws(m(4, {}), 'Input file does not exist');
	t.throws(m('./fixtures/swagg.json', {}), 'Input file does not exist');
	t.true(err.friendly);
});

test('no API Gateway name', async t => {
	const err = await t.throws(m('./fixtures/swagger.json', {}), 'No AWS API Gateway name');
	t.true(err.friendly);
});
