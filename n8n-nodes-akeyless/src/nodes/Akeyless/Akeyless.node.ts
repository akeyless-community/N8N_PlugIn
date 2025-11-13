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
		const authUrl = `${credentials.url}/auth`;
		
		if (credentials.allowUnauthorizedCerts) {
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
		}

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
				'access-id': credentials.accessId,
				'access-key': credentials.accessKey,
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

// Read secret from Akeyless (minimal API: /get-secret-value)
async function readSecret(
	this: IExecuteFunctions,
	config: AxiosRequestConfig,
	secretName: string,
	token: string,
	itemIndex: number,
): Promise<any> {
	try {
		const response = await axios({
			...config,
			method: 'POST',
			url: `${config.baseURL}/get-secret-value`,
			headers: {
				'Content-Type': 'application/json',
				'accept': 'application/json',
			},
			data: {
				'accessibility': 'regular',
				'ignore-cache': 'false',
				'json': false,
				'names': [secretName],
				'token': token,
			},
		});

		// Response is a map: { "<name>": "<value>" }
		const data = response.data || {};
		const value = data[secretName] ?? '';
		return { name: secretName, value };
	} catch (error: any) {
		const errorMessage = error.response?.data?.error || 
			error.response?.data?.message || 
			(error instanceof Error ? error.message : 'Unknown error');
		throw new NodeOperationError(this.getNode(), `Failed to read secret: ${errorMessage}`);
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
		description: 'Read a secret from Akeyless using Access ID + Access Key',
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
						name: 'Read Secret',
						value: 'readSecret',
						description: 'Read a secret value from Akeyless',
						action: 'Read a secret value',
					},
				],
				default: 'readSecret',
			},
			{
				displayName: 'Secret Name',
				name: 'secretName',
				type: 'string',
				default: '',
				placeholder: '/myapp/database/password',
				description: 'The full path/name of the secret in Akeyless',
				required: true,
				displayOptions: {
					show: {
						operation: ['readSecret'],
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
					case 'readSecret': {
						const secretName = this.getNodeParameter('secretName', i) as string;
						responseData = await readSecret.call(this, baseConfig, secretName, token, i);
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

