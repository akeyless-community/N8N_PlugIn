# N8N Akeyless Plugin

This repository contains the n8n community node for integrating with [Akeyless Vaultless Secrets Management](https://www.akeyless.io/).

## Package

The n8n node package lives in the [`n8n-nodes-akeyless`](./n8n-nodes-akeyless/) directory.

**npm package name:** [`n8n-nodes-akeyless-io`](https://www.npmjs.com/package/n8n-nodes-akeyless-io) — n8n’s Community Nodes UI only accepts names that start with `n8n-nodes-`, so this is the name to install or search for. Source code lives in the [`n8n-nodes-akeyless`](./n8n-nodes-akeyless/) directory.

👉 **[Full package documentation →](./n8n-nodes-akeyless/README.md)**

## Installation

### n8n Cloud (SaaS)

1. Open your n8n instance
2. Go to **Settings** → **Community Nodes**
3. Enter **`n8n-nodes-akeyless-io`** as the npm package name (or search/browse the registry)
4. Accept the risk notice and click **Install**
5. Reload or restart the editor if prompted

### Self-hosted n8n (install from npm)

From the machine where n8n runs (or where custom nodes are installed):

```bash
cd ~/.n8n/nodes && npm install n8n-nodes-akeyless-io
```

Restart n8n afterward.

## Features

- 🔐 Retrieve secrets (static, rotated, or dynamic) from Akeyless
- ✏️ Create and manage secrets in Akeyless
- 🗂️ Manage folders and delete items
- 🔑 Support for Access ID/Key and Token authentication
- 🔄 Use secrets dynamically in your n8n workflows

## Repository

- **GitHub**: [akeyless-community/N8N_PlugIn](https://github.com/akeyless-community/N8N_PlugIn)
- **npm**: [n8n-nodes-akeyless-io](https://www.npmjs.com/package/n8n-nodes-akeyless-io)

## License

MIT

## Support

For Akeyless documentation, visit: https://docs.akeyless.io/

