import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

function getHttpErrorDetail(error: unknown): string {
	if (typeof error === 'object' && error !== null && 'responseData' in error) {
		const rd = (error as { responseData?: { error?: unknown; message?: unknown } }).responseData;
		if (rd?.error != null) return String(rd.error);
		if (rd?.message != null) return String(rd.message);
	}
	if (error instanceof Error) return error.message;
	return 'Unknown error occurred';
}

/** POST JSON using Node's built-in fetch (Node >= 18). */
async function postJson<T>(url: string, body: Record<string, unknown>, timeoutMs: number): Promise<T> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const response = await fetch(url, {
			method: 'POST',
			headers: {
				accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
			signal: controller.signal,
		});
		const text = await response.text();
		let data: unknown;
		if (text) {
			try {
				data = JSON.parse(text) as unknown;
			} catch {
				data = { message: text };
			}
		} else {
			data = {};
		}
		if (!response.ok) {
			const d = data as { error?: string; message?: string };
			const msg =
				(typeof d.error === 'string' ? d.error : undefined) ??
				(typeof d.message === 'string' ? d.message : undefined) ??
				`HTTP ${response.status} ${response.statusText}`;
			const err = new Error(msg);
			(err as Error & { responseData?: unknown }).responseData = data;
			throw err;
		}
		return data as T;
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			throw new Error(`Request timed out after ${timeoutMs}ms`);
		}
		throw error;
	} finally {
		clearTimeout(timeoutId);
	}
}

// Authenticate with Akeyless and get temporary credentials
async function authenticateAkeyless(
	this: IExecuteFunctions,
	credentials: any,
): Promise<string> {
	try {
		// If token is provided directly, use it without calling /auth
		if (credentials.token) {
			return credentials.token;
		}

		// Otherwise, authenticate using Access ID + Access Key
		// Validate that Access ID and Access Key are provided
		if (!credentials.accessId || !credentials.accessKey) {
			throw new NodeOperationError(this.getNode(), 'Access ID and Access Key are required when not using token authentication');
		}

		const authUrl = `${credentials.url}/auth`;
		
		if (credentials.allowUnauthorizedCerts) {
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
		}

		// Trim whitespace from credentials
		const accessId = (credentials.accessId as string).trim();
		const accessKey = (credentials.accessKey as string).trim();

		const authBody: Record<string, unknown> = {
			'access-type': 'access_key',
			'gcp-audience': 'akeyless.io',
			json: false,
			'oci-auth-type': 'apikey',
			'access-id': accessId,
			'access-key': accessKey,
		};

		const data = await postJson<{ token?: string }>(authUrl, authBody, 30000);

		const token = data?.token;

		if (!token) {
			const responseKeys = Object.keys(data || {});
			throw new Error(`Failed to obtain token from Akeyless authentication. Response keys: ${responseKeys.join(', ')}`);
		}

		return token;
	} catch (error: unknown) {
		const errorMessage = getHttpErrorDetail(error);
		throw new NodeOperationError(this.getNode(), `Akeyless authentication failed: ${errorMessage}`);
	}
}


export class Akeyless implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Akeyless',
		name: 'akeyless',
		icon: 'file:akeyless.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Interact with Akeyless API - Get static, rotated, or dynamic secrets',
		defaults: {
			name: 'Akeyless',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'akeylessApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Get Static Secret Value',
						value: 'getStaticSecret',
						description: 'Get a static secret value',
						action: 'Get static secret value',
					},
					{
						name: 'Get Rotated Secret Value',
						value: 'getRotatedSecret',
						description: 'Get a rotated secret value',
						action: 'Get rotated secret value',
					},
					{
						name: 'Get Dynamic Secret Value',
						value: 'getDynamicSecret',
						description: 'Get a dynamic secret value',
						action: 'Get dynamic secret value',
					},
					{
						name: 'Create Secret',
						value: 'createSecret',
						description: 'Create a new secret in Akeyless',
						action: 'Create secret',
					},
					{
						name: 'Delete Items',
						value: 'deleteItems',
						description: 'Delete items from Akeyless',
						action: 'Delete items',
					},
					{
						name: 'Create Folder',
						value: 'createFolder',
						description: 'Create a folder in Akeyless',
						action: 'Create folder',
					},
					{
						name: 'Delete Folder',
						value: 'deleteFolder',
						description: 'Delete a folder from Akeyless',
						action: 'Delete folder',
					},
				],
				default: 'getStaticSecret',
			},
			{
				displayName: 'Secret Name',
				name: 'secretName',
				type: 'string',
				default: '',
				placeholder: 'item_name',
				description: 'The name/path of the secret in Akeyless',
				required: true,
				displayOptions: {
					show: {
						operation: ['getStaticSecret', 'getRotatedSecret', 'getDynamicSecret', 'createSecret'],
					},
				},
			},
			{
				displayName: 'Accessibility',
				name: 'accessibility',
				type: 'options',
				options: [
					{
						name: 'Regular',
						value: 'regular',
					},
					{
						name: 'Personal',
						value: 'personal',
					},
				],
				default: 'regular',
				description: 'Secret accessibility type',
				displayOptions: {
					show: {
						operation: ['getStaticSecret', 'createSecret'],
					},
				},
			},
			{
				displayName: 'Ignore Cache',
				name: 'ignoreCache',
				type: 'boolean',
				default: false,
				description: 'Whether to ignore cache and fetch fresh value',
				displayOptions: {
					show: {
						operation: ['getStaticSecret', 'getRotatedSecret'],
					},
				},
			},
			{
				displayName: 'Timeout',
				name: 'timeout',
				type: 'number',
				default: 15,
				description: 'Timeout in seconds for dynamic secret generation',
				displayOptions: {
					show: {
						operation: ['getDynamicSecret'],
					},
				},
			},
			{
				displayName: 'Secret Value',
				name: 'secretValue',
				type: 'string',
				typeOptions: {
					password: true,
				},
				default: '',
				description: 'The value of the secret to create (for generic type)',
				displayOptions: {
					show: {
						operation: ['createSecret'],
						secretType: ['generic'],
					},
				},
			},
			{
				displayName: 'Username',
				name: 'username',
				type: 'string',
				default: '',
				description: 'Username for password type secret',
				displayOptions: {
					show: {
						operation: ['createSecret'],
						secretType: ['password'],
					},
				},
			},
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: {
					password: true,
				},
				default: '',
				description: 'Password for password type secret',
				displayOptions: {
					show: {
						operation: ['createSecret'],
						secretType: ['password'],
					},
				},
			},
			{
				displayName: 'Format',
				name: 'format',
				type: 'options',
				options: [
					{
						name: 'Text',
						value: 'text',
					},
					{
						name: 'JSON',
						value: 'json',
					},
				],
				default: 'text',
				description: 'Secret format',
				displayOptions: {
					show: {
						operation: ['createSecret'],
					},
				},
			},
			{
				displayName: 'Type',
				name: 'secretType',
				type: 'options',
				options: [
					{
						name: 'Generic',
						value: 'generic',
					},
					{
						name: 'Password',
						value: 'password',
					},
				],
				default: 'generic',
				description: 'Secret type',
				displayOptions: {
					show: {
						operation: ['createSecret'],
					},
				},
			},
			{
				displayName: 'Secure Access Web Browsing',
				name: 'secureAccessWebBrowsing',
				type: 'boolean',
				default: false,
				description: 'Enable secure access web browsing',
				displayOptions: {
					show: {
						operation: ['createSecret'],
					},
				},
			},
			{
				displayName: 'Secure Access Web Proxy',
				name: 'secureAccessWebProxy',
				type: 'boolean',
				default: false,
				description: 'Enable secure access web proxy',
				displayOptions: {
					show: {
						operation: ['createSecret'],
					},
				},
			},
			{
				displayName: 'Path',
				name: 'path',
				type: 'string',
				default: '',
				placeholder: 'item_name',
				description: 'The path/name of the item(s) to delete',
				required: true,
				displayOptions: {
					show: {
						operation: ['deleteItems'],
					},
				},
			},
			{
				displayName: 'Folder Name',
				name: 'folderName',
				type: 'string',
				default: '',
				placeholder: 'folder_name',
				description: 'The name of the folder',
				required: true,
				displayOptions: {
					show: {
						operation: ['createFolder', 'deleteFolder'],
					},
				},
			},
			{
				displayName: 'Accessibility',
				name: 'folderAccessibility',
				type: 'options',
				options: [
					{
						name: 'Regular',
						value: 'regular',
					},
					{
						name: 'Personal',
						value: 'personal',
					},
				],
				default: 'regular',
				description: 'Folder accessibility type',
				displayOptions: {
					show: {
						operation: ['createFolder', 'deleteFolder'],
					},
				},
			},
			{
				displayName: 'Folder Name',
				name: 'folderName',
				type: 'string',
				default: '',
				placeholder: 'folder_name',
				description: 'The name of the folder',
				required: true,
				displayOptions: {
					show: {
						operation: ['createFolder', 'deleteFolder'],
					},
				},
			},
			{
				displayName: 'Accessibility',
				name: 'folderAccessibility',
				type: 'options',
				options: [
					{
						name: 'Regular',
						value: 'regular',
					},
					{
						name: 'Personal',
						value: 'personal',
					},
				],
				default: 'regular',
				description: 'Folder accessibility type',
				displayOptions: {
					show: {
						operation: ['createFolder', 'deleteFolder'],
					},
				},
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: [
					{
						displayName: 'Timeout',
						name: 'timeout',
						type: 'number',
						default: 30000,
						description: 'Request timeout in milliseconds',
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const credentials = await this.getCredentials('akeylessApi');
				const operation = this.getNodeParameter('operation', i) as string;
				const additionalFields = this.getNodeParameter('additionalFields', i) as any;

				// Authenticate and get token (before each operation as requested)
				const token = await authenticateAkeyless.call(this, credentials);

				const baseUrl = credentials.url as string;
				const requestTimeoutMs = additionalFields.timeout || 30000;

				if (credentials.allowUnauthorizedCerts) {
					process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
				}

				let responseData: any;

				switch (operation) {
					case 'getStaticSecret': {
						const secretName = this.getNodeParameter('secretName', i) as string;
						const accessibility = this.getNodeParameter('accessibility', i, 'regular') as string;
						const ignoreCache = this.getNodeParameter('ignoreCache', i, false) as boolean;

						responseData = await postJson(
							`${baseUrl}/get-secret-value`,
							{
								accessibility: accessibility,
								'ignore-cache': ignoreCache.toString(),
								json: false,
								names: [secretName],
								token: token,
							},
							requestTimeoutMs,
						);
						break;
					}
					case 'getRotatedSecret': {
						const secretName = this.getNodeParameter('secretName', i) as string;
						const ignoreCache = this.getNodeParameter('ignoreCache', i, false) as boolean;

						responseData = await postJson(
							`${baseUrl}/get-rotated-secret-value`,
							{
								'ignore-cache': ignoreCache.toString(),
								json: false,
								names: secretName,
								token: token,
							},
							requestTimeoutMs,
						);
						break;
					}
					case 'getDynamicSecret': {
						const secretName = this.getNodeParameter('secretName', i) as string;
						const timeout = this.getNodeParameter('timeout', i, 15) as number;

						responseData = await postJson(
							`${baseUrl}/get-dynamic-secret-value`,
							{
								json: false,
								timeout: timeout,
								name: secretName,
								token: token,
							},
							requestTimeoutMs,
						);
						break;
					}
					case 'createSecret': {
						const secretName = this.getNodeParameter('secretName', i) as string;
						const accessibility = this.getNodeParameter('accessibility', i, 'regular') as string;
						const format = this.getNodeParameter('format', i, 'text') as string;
						const secretType = this.getNodeParameter('secretType', i, 'generic') as string;
						const secureAccessWebBrowsing = this.getNodeParameter('secureAccessWebBrowsing', i, false) as boolean;
						const secureAccessWebProxy = this.getNodeParameter('secureAccessWebProxy', i, false) as boolean;

						// Build request data based on secret type
						const requestData: any = {
							accessibility: accessibility,
							format: format,
							json: false,
							'secure-access-web-browsing': secureAccessWebBrowsing,
							'secure-access-web-proxy': secureAccessWebProxy,
							type: secretType,
							token: token,
							name: secretName,
						};

						// For password type, use username and password fields
						if (secretType === 'password') {
							const username = this.getNodeParameter('username', i) as string;
							const password = this.getNodeParameter('password', i) as string;
							requestData.username = username;
							requestData.password = password;
						} else {
							// For generic type, use value field
							const secretValue = this.getNodeParameter('secretValue', i) as string;
							requestData.value = secretValue;
						}

						responseData = await postJson(
							`${baseUrl}/create-secret`,
							requestData as Record<string, unknown>,
							requestTimeoutMs,
						);
						break;
					}
					case 'deleteItems': {
						const path = this.getNodeParameter('path', i) as string;

						responseData = await postJson(
							`${baseUrl}/delete-items`,
							{
								json: false,
								token: token,
								path: path,
							},
							requestTimeoutMs,
						);
						break;
					}
					case 'createFolder': {
						const folderName = this.getNodeParameter('folderName', i) as string;
						const folderAccessibility = this.getNodeParameter('folderAccessibility', i, 'regular') as string;

						responseData = await postJson(
							`${baseUrl}/folder-create`,
							{
								accessibility: folderAccessibility,
								json: false,
								name: folderName,
								token: token,
							},
							requestTimeoutMs,
						);
						break;
					}
					case 'deleteFolder': {
						const folderName = this.getNodeParameter('folderName', i) as string;
						const folderAccessibility = this.getNodeParameter('folderAccessibility', i, 'regular') as string;

						responseData = await postJson(
							`${baseUrl}/folder-delete`,
							{
								accessibility: folderAccessibility,
								json: false,
								name: folderName,
								token: token,
							},
							requestTimeoutMs,
						);
						break;
					}
					default:
						throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
				}

				returnData.push({
					json: responseData,
					pairedItem: {
						item: i,
					},
				});
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : 'Unknown error occurred',
						},
						pairedItem: {
							item: i,
						},
					});
					continue;
				}
				throw error;
			}
		}

		// Reset SSL behavior
		if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
			delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
		}

		return [returnData];
	}
}

