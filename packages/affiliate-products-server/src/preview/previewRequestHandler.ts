//import type { DynamoService } from '../../../common/src/database-service';
import { PreviewRequestSchema } from './requestSchema';

type HandlerResult =
	| { ok: true; productPrice?: string }
	| { ok: false; status: 400 | 404 | 409; error: string };

export async function handlePreviewRequest(
	request: unknown,
	previewCapiBaseUrl: string,
	//dynamoService: DynamoService,
): Promise<HandlerResult> {
	const parsedRequest = PreviewRequestSchema.safeParse(request);

	if (!parsedRequest.success) {
		return { ok: false, status: 400, error: parsedRequest.error.message };
	}
	const { productMerchantUrl, region } = parsedRequest.data;
}
