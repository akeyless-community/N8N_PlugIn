import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class AkeylessApi implements ICredentialType {
	name = 'akeylessApi';
	displayName = 'Akeyless Security';
	documentationUrl = 'https://docs.akeyless.io/';

	properties: INodeProperties[] = [
		{
			displayName: 'Akeyless Vaultless Secrets Management',
			name: 'notice',
			type: 'notice',
			default: '',
		},
		{
			displayName: '📖 For complete setup instructions and troubleshooting guide, <a href="https://docs.akeyless.io/" target="_blank">visit Akeyless documentation</a>',
			name: 'noticeDocs',
			type: 'notice',
			default: '',
		},
		{
			displayName: 'API Base URL',
			name: 'url',
			type: 'string',
			default: 'https://api.akeyless.io',
			placeholder: 'https://api.akeyless.io',
			description: 'Base URL for Akeyless API',
			required: true,
		},
		{
			displayName: 'Authentication Method',
			name: 'authMethod',
			type: 'options',
			options: [
				{
					name: 'Access ID + Access Key',
					value: 'accessKey',
				},
				{
					name: 'Token (t-token)',
					value: 'token',
				},
			],
			default: 'accessKey',
			description: 'Choose authentication method',
		},
		{
			displayName: 'Token (t-token)',
			name: 'token',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			placeholder: 't-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
			description: 'Akeyless token (t-token). If provided, Access ID and Access Key are not required.',
			displayOptions: {
				show: {
					authMethod: ['token'],
				},
			},
		},
		{
			displayName: 'Access ID',
			name: 'accessId',
			type: 'string',
			default: '',
			placeholder: 'p-xxxxxxxxxxxxx',
			description: 'Your Akeyless Access ID (starts with "p-")',
			displayOptions: {
				show: {
					authMethod: ['accessKey'],
				},
			},
			required: true,
		},
		{
			displayName: 'Access Key',
			name: 'accessKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			placeholder: 'Base64 encoded API key',
			description: 'Your Akeyless Access Key (Base64 encoded)',
			displayOptions: {
				show: {
					authMethod: ['accessKey'],
				},
			},
			required: true,
		},
		{
			displayName: 'Ignore SSL Issues',
			name: 'allowUnauthorizedCerts',
			type: 'boolean',
			default: false,
			description: 'Whether to connect even if SSL certificate validation is not possible',
		},
	];
}

