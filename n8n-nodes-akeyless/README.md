# n8n-nodes-akeyless

A secure n8n community node for integrating with Akeyless Vaultless Secrets Management. This node allows you to retrieve, create, and manage secrets from Akeyless directly in your n8n workflows.

## Purpose

This node provides seamless integration between n8n and Akeyless, enabling you to:
- **Retrieve secrets** (static, rotated, or dynamic) from Akeyless
- **Create secrets** in Akeyless
- **Delete items** and **manage folders** in Akeyless
- Use secrets dynamically in your workflows without hardcoding sensitive values

## Installation

### For n8n SaaS (Cloud)

1. Open your n8n instance
2. Go to **Settings** → **Community Nodes**
3. Search for `n8n-nodes-akeyless`
4. Click **Install**
5. Restart your workflow editor

### For Self-Hosted n8n (Local Development)

```bash
# 1. Clone or download this repository
cd /path/to/n8n-nodes-akeyless

# 2. Install dependencies
npm install

# 3. Build the plugin
npm run build

# 4. Link it to n8n
npm link
mkdir -p ~/.n8n/nodes/node_modules
cd ~/.n8n/nodes/node_modules
npm link n8n-nodes-akeyless

# 5. Restart n8n
```

## Configuration

### Credentials Setup

1. **Create New Credential** → Select **Akeyless Security**
2. Choose authentication method:

   **Option A: Access ID + Access Key**
   - API Base URL: `https://api.akeyless.io` (or your instance)
   - Access ID: Your Akeyless Access ID (starts with `p-`)
   - Access Key: Your Base64 encoded API key

   **Option B: Token (t-token)**
   - API Base URL: `https://api.akeyless.io`
   - Token: Your Akeyless token (starts with `t-`)

## Available Operations

### 1. Get Static Secret Value
Retrieves a static secret from Akeyless.

**Parameters:**
- Secret Name (required)
- Accessibility (regular/personal)
- Ignore Cache (boolean)

**Output:** Returns raw API response: `{ "/secret/name": "secret_value" }`

### 2. Get Rotated Secret Value
Retrieves a rotated secret from Akeyless.

**Parameters:**
- Secret Name (required)
- Ignore Cache (boolean)

**Output:** Returns raw API response

### 3. Get Dynamic Secret Value
Retrieves a dynamic secret from Akeyless.

**Parameters:**
- Secret Name (required)
- Timeout (seconds, default: 15)

**Output:** Returns raw API response

### 4. Create Secret
Creates a new secret in Akeyless.

**Parameters:**
- Secret Name (required)
- Secret Value (for generic type) OR Username + Password (for password type)
- Type: Generic or Password
- Format: Text or JSON
- Accessibility (regular/personal)
- Secure Access options

**Output:** Returns raw API response

### 5. Delete Items
Deletes items from Akeyless.

**Parameters:**
- Path (required) - The path/name of the item(s) to delete

**Output:** Returns raw API response

### 6. Create Folder
Creates a folder in Akeyless.

**Parameters:**
- Folder Name (required)
- Accessibility (regular/personal)

**Output:** Returns raw API response

### 7. Delete Folder
Deletes a folder from Akeyless.

**Parameters:**
- Folder Name (required)
- Accessibility (regular/personal)

**Output:** Returns raw API response

## Usage Examples

### Example 1: Get Secret and Use in HTTP Request

1. Add **Akeyless** node
   - Operation: **Get Static Secret Value**
   - Secret Name: `/myapp/api-key` (your secret path)

2. Add **HTTP Request** node
   - URL: `https://api.example.com/endpoint`
   - Header: `X-API-Key: {{$node["Akeyless"].json["/myapp/api-key"]}}`

**Note:** Use the exact secret name (with leading `/`) as the key to access the value.

### Example 2: Using Set Node for Cleaner Workflow

1. **Akeyless** → **Set** → **HTTP Request**

2. **Set Node:**
   - Field: `apiKey`
   - Value: `={{$json["/myapp/api-key"]}}` (use your secret name)

3. **HTTP Request:**
   - Header: `X-API-Key: {{$json.apiKey}}`

### Example 3: Create Secret

1. Add **Akeyless** node
   - Operation: **Create Secret**
   - Secret Name: `/myapp/database/password` (your desired path)
   - Type: **Generic**
   - Secret Value: `your-secret-value`
   - Accessibility: **Regular**

## Response Format

All operations return the **raw API response** from Akeyless. For `get-secret-value`, the response format is:

```json
{
  "/your/secret/name": "secret_value"
}
```

To access the value, use: `{{$node["Akeyless"].json["/your/secret/name"]}}` (replace with your actual secret name)

## Authentication

The node supports two authentication methods:

1. **Access ID + Access Key**: Automatically authenticates via `/auth` endpoint and uses the returned token
2. **Token (t-token)**: Uses the provided token directly (no authentication call)

Authentication happens **before each operation** to ensure fresh tokens.

## Troubleshooting

### "API key not valid" Error
- Verify your Access ID and Access Key are correct
- Ensure Access Key is properly Base64 encoded
- Check that credentials don't have extra whitespace

### Expression Not Working
- Use the exact secret name as the key: `{{$node["Akeyless"].json["/exact/secret/name"]}}`
- Consider using a Set node to extract the value first

### 403/401 Errors
- Verify your token is valid and not expired
- Check that your Access ID has permissions for the requested operations

## License

MIT

## Support

For Akeyless documentation, visit: https://docs.akeyless.io/

