import {
	ComposerContentMessageSchema,
	composerOriginsForHost,
	embedMessageVersion,
} from '@common/embed';
import type { ComposerContentMessage, EmbedMessage } from '@common/embed';
import { css, Global } from '@emotion/react';
import { semanticColors, semanticSpacing } from '@guardian/stand';
import { InlineMessage } from '@guardian/stand/InlineMessage';
import { Link } from '@guardian/stand/Link';
import { Typography } from '@guardian/stand/Typography';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EmbedProductsState } from './api/embedProducts';
import { fetchEmbedProducts } from './api/embedProducts';
import { globalStyles } from './App';
import { PriceEditingContext } from './PriceEditing';
import type { PriceEditing } from './PriceEditing';
import { ProductList } from './ProductList';

type State = { status: 'waiting' } | { status: 'loading' } | EmbedProductsState;

const rootStyles = css`
	display: grid;
	gap: ${semanticSpacing.stackSm};
	padding: ${semanticSpacing.stackSm};
`;

const weakText = { color: semanticColors.text.weak };

// The room a dialog needs around it, so the iframe is tall enough to show it whole.
const dialogMargin = 32;

/**
 * Composer's panel of the products in the draft it has open, with their prices in the
 * directory. Composer shows this page in an iframe and sends it the article with
 * postMessage, as the tool can't read drafts itself.
 */
export const Embed = () => {
	const [state, setState] = useState<State>({ status: 'waiting' });
	const rootRef = useRef<HTMLDivElement>(null);
	// Fetches the prices for the latest article again, once one has been sent.
	const reloadRef = useRef<() => void>(() => undefined);

	useEffect(() => {
		const origins = composerOriginsForHost(window.location);
		// Composer's origin, once it has sent an article, which is the only place messages go.
		let composerOrigin: string | undefined;
		const post = (message: EmbedMessage) => {
			window.parent.postMessage(message, composerOrigin ?? '*');
		};

		// Each article aborts the request for the one before, so an older response can't
		// replace a newer one.
		let request: AbortController | undefined;
		const load = (content: ComposerContentMessage) => {
			request?.abort();
			const controller = new AbortController();
			request = controller;
			setState((previous) =>
				previous.status === 'loaded' ? previous : { status: 'loading' },
			);
			fetchEmbedProducts(content, controller.signal)
				.then((next) => {
					if (!controller.signal.aborted) {
						setState(next);
					}
				})
				.catch((error: unknown) => {
					if (!controller.signal.aborted) {
						console.error(error);
						setState({ status: 'error' });
					}
				});
		};
		const onMessage = (event: MessageEvent) => {
			if (event.source !== window.parent || !origins.includes(event.origin)) {
				return;
			}
			const content = ComposerContentMessageSchema.safeParse(event.data);
			if (!content.success) {
				return;
			}
			composerOrigin = event.origin;
			reloadRef.current = () => load(content.data);
			load(content.data);
		};
		window.addEventListener('message', onMessage);

		// The panel's height, or a dialog's with room around it if that's taller, as dialogs
		// are drawn over the page rather than in it.
		const root = rootRef.current;
		let lastHeight = 0;
		const sendHeight = () => {
			const dialog = document.querySelector('[role="dialog"]');
			const height = Math.ceil(
				Math.max(
					root?.getBoundingClientRect().height ?? 0,
					dialog ? dialog.getBoundingClientRect().height + 2 * dialogMargin : 0,
				),
			);
			if (height !== lastHeight) {
				lastHeight = height;
				post({
					source: 'affiliate-products',
					type: 'height',
					version: embedMessageVersion,
					height,
				});
			}
		};
		const resizeObserver = new ResizeObserver(sendHeight);
		if (root) {
			resizeObserver.observe(root);
		}
		// Dialogs are added to the end of the body, outside the panel.
		const dialogObserver = new MutationObserver(() => {
			const dialog = document.querySelector('[role="dialog"]');
			if (dialog) {
				resizeObserver.observe(dialog);
			}
			sendHeight();
		});
		dialogObserver.observe(document.body, { childList: true, subtree: true });

		// Composer's origin isn't known yet, but ready says nothing about the article.
		window.parent.postMessage(
			{
				source: 'affiliate-products',
				type: 'ready',
				version: embedMessageVersion,
			},
			'*',
		);

		return () => {
			window.removeEventListener('message', onMessage);
			resizeObserver.disconnect();
			dialogObserver.disconnect();
			request?.abort();
		};
	}, []);

	const region = state.status === 'loaded' ? state.response.region : undefined;
	const priceEditing = useMemo<PriceEditing>(
		() => ({
			canEdit: true,
			onPriceEdit: () => reloadRef.current(),
			draftRegion: region,
		}),
		[region],
	);

	const render = () => {
		switch (state.status) {
			case 'waiting':
				return (
					<Typography element="p" variant="bodySm" theme={weakText}>
						Waiting for the article from Composer…
					</Typography>
				);
			case 'loading':
				return (
					<Typography element="p" variant="bodySm" theme={weakText}>
						Finding the products and their prices…
					</Typography>
				);
			case 'unauthenticated':
				return (
					<InlineMessage level="information">
						Your login to the affiliate products tool has expired.{' '}
						<Link href="/" target="_blank" rel="noreferrer">
							Log in again
						</Link>
						, then reload this panel.
					</InlineMessage>
				);
			case 'error':
				return (
					<InlineMessage level="error">
						The prices couldn’t be loaded. Edit the article or reload this panel
						to try again.
					</InlineMessage>
				);
			case 'loaded':
				return (
					<ProductList
						products={state.response.products}
						articleCurrency={state.response.region === 'US' ? 'USD' : 'GBP'}
						compact
					/>
				);
		}
	};

	return (
		<>
			<Global styles={globalStyles} />
			<PriceEditingContext.Provider value={priceEditing}>
				<div ref={rootRef} css={rootStyles}>
					{render()}
				</div>
			</PriceEditingContext.Provider>
		</>
	);
};
