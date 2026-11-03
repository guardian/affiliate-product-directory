import { composerContentFixture } from '@mocks/ComposerContentFixture';

// Plays Composer's part for embed-harness.html: sends the content message after every
// ready, and again after each edit, and sizes the iframe to the embed's height.

const textarea = document.querySelector<HTMLTextAreaElement>('#content');
const iframe = document.querySelector<HTMLIFrameElement>('#embed');
const log = document.querySelector<HTMLOListElement>('#log');
const reload = document.querySelector<HTMLButtonElement>('#reload');

if (!textarea || !iframe || !log || !reload) {
	throw new Error('The harness page is missing an element');
}

const logMessage = (text: string) => {
	const item = document.createElement('li');
	item.textContent = `${new Date().toLocaleTimeString()} ${text}`;
	log.prepend(item);
};

textarea.value = JSON.stringify(composerContentFixture, null, 2);

const sendContent = () => {
	try {
		const content: unknown = JSON.parse(textarea.value);
		iframe.contentWindow?.postMessage(content, window.location.origin);
		logMessage('Composer → embed: content');
	} catch {
		logMessage('Not sent: the content message is not valid JSON');
	}
};

let timer: number | undefined;
textarea.addEventListener('input', () => {
	window.clearTimeout(timer);
	timer = window.setTimeout(sendContent, 1000);
});

reload.addEventListener('click', () => {
	iframe.src = '/embed';
});

window.addEventListener('message', (event: MessageEvent) => {
	const message = event.data as {
		source?: string;
		type?: string;
		height?: number;
	};
	if (
		event.source !== iframe.contentWindow ||
		event.origin !== window.location.origin ||
		message.source !== 'affiliate-products'
	) {
		return;
	}
	logMessage(
		`embed → Composer: ${message.type}${message.height ? ` ${message.height}px` : ''}`,
	);
	if (message.type === 'ready') {
		sendContent();
	}
	if (message.type === 'height' && message.height) {
		iframe.style.height = `${Math.min(Math.max(message.height, 120), 900)}px`;
	}
});
