import {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import axios, { AxiosRequestConfig } from 'axios';

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

		const config: AxiosRequestConfig = {
			method: 'POST',
			url: authUrl,
			headers: {
				'Content-Type': 'application/json',
			},
			data: {
				'access-type': 'access_key',
				'gcp-audience': 'akeyless.io',
				'json': false,
				'oci-auth-type': 'apikey',
				'access-id': accessId,
				'access-key': accessKey,
			},
		};
		
		const response = await axios(config);

		// Akeyless returns token in different possible fields
		const token = response.data?.token;

		if (!token) {
			const responseKeys = Object.keys(response.data || {});
			throw new Error(`Failed to obtain token from Akeyless authentication. Response keys: ${responseKeys.join(', ')}`);
		}

		return token;
	} catch (error: any) {
		const errorMessage = error.response?.data?.error || 
			error.response?.data?.message || 
			(error instanceof Error ? error.message : 'Unknown error occurred');
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
						operation: ['getStaticSecret', 'getRotatedSecret', 'getDynamicSecret'],
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
						operation: ['getStaticSecret'],
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

				// Base configuration for axios
				// API Gateway uses query parameters, not Authorization header
				const baseConfig: AxiosRequestConfig = {
					baseURL: credentials.url as string,
					timeout: additionalFields.timeout || 30000,
					headers: {
						'Content-Type': 'application/json',
					},
				};

				if (credentials.allowUnauthorizedCerts) {
					process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
				}

				let responseData: any;

				switch (operation) {
					case 'getStaticSecret': {
						const secretName = this.getNodeParameter('secretName', i) as string;
						const accessibility = this.getNodeParameter('accessibility', i, 'regular') as string;
						const ignoreCache = this.getNodeParameter('ignoreCache', i, false) as boolean;

						const response = await axios({
							...baseConfig,
							method: 'POST',
							url: `${baseConfig.baseURL}/get-secret-value`,
							headers: {
								'accept': 'application/json',
								'Content-Type': 'application/json',
							},
							data: {
								accessibility: accessibility,
								'ignore-cache': ignoreCache.toString(),
								json: false,
								names: [secretName],
								token: token,
							},
						});

						// Return raw response data
						responseData = response.data;
						break;
					}
					case 'getRotatedSecret': {
						const secretName = this.getNodeParameter('secretName', i) as string;
						const ignoreCache = this.getNodeParameter('ignoreCache', i, false) as boolean;

						const response = await axios({
							...baseConfig,
							method: 'POST',
							url: `${baseConfig.baseURL}/get-rotated-secret-value`,
							headers: {
								'accept': 'application/json',
								'Content-Type': 'application/json',
							},
							data: {
								'ignore-cache': ignoreCache.toString(),
								json: false,
								names: secretName,
								token: token,
							},
						});

						// Return raw response data
						responseData = response.data;
						break;
					}
					case 'getDynamicSecret': {
						const secretName = this.getNodeParameter('secretName', i) as string;
						const timeout = this.getNodeParameter('timeout', i, 15) as number;

						const response = await axios({
							...baseConfig,
							method: 'POST',
							url: `${baseConfig.baseURL}/get-dynamic-secret-value`,
							headers: {
								'accept': 'application/json',
								'Content-Type': 'application/json',
							},
							data: {
								json: false,
								timeout: timeout,
								name: secretName,
								token: token,
							},
						});

						// Return raw response data
						responseData = response.data;
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

