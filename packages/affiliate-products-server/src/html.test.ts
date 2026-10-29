import { decodeEntities, stripTags } from './html';

describe('decodeEntities', () => {
	it('decodes the entities found in names and headlines', () => {
		expect(
			decodeEntities('&quot;Fish&quot; &amp; chips&#39; &lt;b&gt;&nbsp;x'),
		).toBe(`"Fish" & chips' <b> x`);
	});

	it('decodes an escaped entity only once', () => {
		expect(decodeEntities('&amp;lt;')).toBe('&lt;');
	});
});

describe('stripTags', () => {
	it('removes tags, keeping their text', () => {
		expect(stripTags('<strong>Pasta</strong><strong> maker</strong>')).toBe(
			'Pasta maker',
		);
	});

	it('leaves an unclosed angle bracket', () => {
		expect(stripTags('<<b>script>alert(1) <i')).toBe('script>alert(1) <i');
	});
});
