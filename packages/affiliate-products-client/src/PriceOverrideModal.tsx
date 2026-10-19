import type { ProductLink } from '@common/tool-models';
import { css } from '@emotion/react';
import { semanticColors, semanticSpacing } from '@guardian/stand';
import { Button } from '@guardian/stand/Button';
import { DatePicker } from '@guardian/stand/DatePicker';
import { InlineMessage } from '@guardian/stand/InlineMessage';
import { Dialog, Modal } from '@guardian/stand/Modal';
import { Option, Select } from '@guardian/stand/Select';
import { TextInput } from '@guardian/stand/TextInput';
import { Typography } from '@guardian/stand/Typography';
import { parseDate } from '@internationalized/date';
import { type FormEvent, useContext, useId, useState } from 'react';
import type { DateValue } from 'react-aria-components';
import { removePriceOverride, setPriceOverride } from './api/manualOverride';
import { formatDate } from './formatDate';
import { formatPrice } from './formatPrice';
import { PriceEditingContext } from './PriceEditing';

type Currency = 'GBP' | 'USD';

// The currencies the directory prices products in. Any other is shown by its code.
const currencySymbols: Record<string, string | undefined> = {
	GBP: '£',
	USD: '$',
};

/** The link's current currency, or else the one its base price is written in. */
const defaultCurrency = ({ currency, basePrice }: ProductLink): Currency => {
	if (currency === 'GBP' || currency === 'USD') {
		return currency;
	}
	return basePrice?.currencySymbol === '$' ? 'USD' : 'GBP';
};

/** Today as a date such as 2026-10-16, in the user's time zone. */
const today = () => new Date().toLocaleDateString('en-CA');

/** The day a manual price is kept until, in the user's time zone, if that's still to come. */
const savedExpiry = ({
	updatedBy,
	expiresAt,
}: ProductLink): DateValue | null =>
	updatedBy === 'manualOverride' &&
	expiresAt !== undefined &&
	expiresAt > Date.now()
		? parseDate(new Date(expiresAt).toLocaleDateString('en-CA'))
		: null;

/** The last moment of a day in the user's time zone, so a price is kept through that day. */
const endOfDay = ({ year, month, day }: DateValue) =>
	new Date(new Date(year, month - 1, day + 1).getTime() - 1);

const fieldsStyles = css`
	display: grid;
	gap: ${semanticSpacing.stackMd};
`;

const priceRowStyles = css`
	display: grid;
	grid-template-columns: 7rem minmax(0, 1fr);
	gap: ${semanticSpacing.stackSm};
	align-items: start;
`;

const summaryStyles = css`
	margin: 0 0 ${semanticSpacing.stackMd};
	padding: ${semanticSpacing.stackSm};
	background-color: ${semanticColors.bg.raisedLevel1};
	overflow-wrap: anywhere;
`;

const removeStyles = css`
	margin-right: auto;
`;

const weakText = { color: semanticColors.text.weak };

// Stand's overlay is sized to the page's body, which here is only as tall as the window,
// so on a scrolled page the dialog was drawn above the view and cut off. Fixed to the
// window instead, as Dispatch does, it covers whatever is on screen.
const modalTheme = {
	overlay: { position: 'fixed', overflow: 'auto' },
};

/**
 * A form to set a product link's price by hand, or to remove a price set by hand. The
 * price providers leave a manual price as it is until it expires or is removed.
 */
export const PriceOverrideModal = ({
	link,
	productName,
	isOpen,
	onOpenChange,
}: {
	link: ProductLink;
	productName?: string;
	isOpen: boolean;
	onOpenChange: (isOpen: boolean) => void;
}) => {
	const { reload } = useContext(PriceEditingContext);
	const formId = useId();
	const isOverridden = link.updatedBy === 'manualOverride';
	const [currency, setCurrency] = useState<Currency>(defaultCurrency(link));
	const [price, setPrice] = useState(
		link.price !== undefined ? String(link.price) : '',
	);
	const [expiry, setExpiry] = useState<DateValue | null>(savedExpiry(link));
	const [submitted, setSubmitted] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string>();

	const amount = Number(price.trim());
	const priceError =
		price.trim() === '' || !Number.isFinite(amount) || amount <= 0
			? 'Enter a price above 0, such as 24.99'
			: undefined;
	const expiryError =
		expiry && expiry.toString() < today()
			? 'Choose today or a later date'
			: undefined;

	const finish = (result: { error: string } | undefined) => {
		setSaving(false);
		if (result) {
			setError(result.error);
			return;
		}
		onOpenChange(false);
		reload();
	};

	const save = async (event: FormEvent) => {
		event.preventDefault();
		setSubmitted(true);
		if (priceError || expiryError) {
			return;
		}
		setSaving(true);
		setError(undefined);
		finish(
			await setPriceOverride({
				productMerchantUrl: link.url,
				currency,
				price: amount,
				expiryDate: expiry ? endOfDay(expiry).toISOString() : undefined,
			}).catch(() => ({ error: 'The price couldn’t be saved.' })),
		);
	};

	const remove = async () => {
		setSaving(true);
		setError(undefined);
		finish(
			await removePriceOverride(link.url).catch(() => ({
				error: 'The manual price couldn’t be removed.',
			})),
		);
	};

	return (
		<Modal
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			isDismissable={!saving}
			theme={modalTheme}
		>
			<Dialog>
				<Dialog.Dismiss ariaLabel="Close" />
				<Dialog.Header element="h2" variant="headingMd">
					{isOverridden ? 'Change manual price' : 'Set price manually'}
				</Dialog.Header>
				<Dialog.Content>
					{/* The dialog lays out its parts itself, so the form is inside its content and
					    the submit button, in the dialog's buttons, is tied to it by its id. */}
					<form id={formId} onSubmit={(event) => void save(event)} noValidate>
						<div css={summaryStyles}>
							{productName && (
								<Typography element="div" variant="bodyBoldSm">
									{productName}
								</Typography>
							)}
							<Typography element="div" variant="bodySm">
								{link.retailer ?? link.label}
							</Typography>
							<Typography element="div" variant="bodyXs" theme={weakText}>
								{link.url}
							</Typography>
							<Typography element="div" variant="bodyXs" theme={weakText}>
								In the article:{' '}
								{link.basePrice
									? `${link.basePrice.currencySymbol}${formatPrice(link.basePrice.amount)}`
									: 'no price'}
								{' · '}Current:{' '}
								{link.currency !== undefined && link.price !== undefined
									? `${currencySymbols[link.currency] ?? `${link.currency} `}${formatPrice(link.price)}${isOverridden ? ', set by hand' : link.updatedBy ? ` by ${link.updatedBy}` : ''}`
									: 'no price'}
								{isOverridden &&
									link.expiresAt !== undefined &&
									`, until ${formatDate(link.expiresAt)}`}
							</Typography>
						</div>
						<div css={fieldsStyles}>
							<div css={priceRowStyles}>
								<Select
									label="Currency"
									selectedKey={currency}
									onSelectionChange={(key) => {
										if (key === 'GBP' || key === 'USD') {
											setCurrency(key);
										}
									}}
									fluid
								>
									<Option id="GBP">£ GBP</Option>
									<Option id="USD">$ USD</Option>
								</Select>
								<TextInput
									label="Price"
									value={price}
									onChange={setPrice}
									inputMode="decimal"
									autoFocus
									error={submitted ? priceError : undefined}
									fluid
								/>
							</div>
							<DatePicker
								label="Keep until (optional)"
								description="The price providers won’t change this price until then. Leave it empty to keep it until it’s removed."
								value={expiry}
								onChange={setExpiry}
								error={submitted ? expiryError : undefined}
							/>
							{error && <InlineMessage level="error">{error}</InlineMessage>}
						</div>
					</form>
				</Dialog.Content>
				<Dialog.Buttons>
					{isOverridden && (
						<Button
							variant="secondary"
							onPress={() => void remove()}
							isDisabled={saving}
							cssOverrides={removeStyles}
						>
							Remove manual price
						</Button>
					)}
					<Button
						variant="tertiary"
						onPress={() => onOpenChange(false)}
						isDisabled={saving}
					>
						Cancel
					</Button>
					<Button type="submit" form={formId} isDisabled={saving}>
						{saving ? 'Saving…' : 'Save price'}
					</Button>
				</Dialog.Buttons>
			</Dialog>
		</Modal>
	);
};
