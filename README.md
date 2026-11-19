# Cisco Business Dashboard MCP

Servidor MCP (Model Context Protocol) para o **Cisco Business Dashboard** em `https://cisco.capricornio.corp.br`.

Permite que o Cursor (e outros clientes MCP) consultem inventário, redes, dispositivos, hosts e eventos via a API v2 do CBD — a mesma superfície que aparece no dashboard (AP / Switch / Router / Endpoints / alertas).

## O que você precisa

1. Acesso ao Dashboard: `https://cisco.capricornio.corp.br`
2. Access Key (ID + Secret):
   - Login no CBD → **Administration → Users** (ou **My Profile**)
   - **Generate Access Key**
   - Guarde o **Key ID** e o **Secret** (o secret só aparece uma vez)

> Use uma conta com o mínimo de privilégio necessário. As tools deste MCP são de leitura; a key herda as permissões do usuário.

## Setup rápido

```bash
npm install
npm run build
cp .env.example .env
# edite .env com CBD_KEY_ID e CBD_KEY_SECRET
```

Variáveis principais:

| Variável | Descrição |
| --- | --- |
| `CBD_BASE_URL` | URL do Dashboard (default: `https://cisco.capricornio.corp.br`) |
| `CBD_KEY_ID` | Access Key ID |
| `CBD_KEY_SECRET` | Access Key Secret |
| `CBD_ORG_ID` | (opcional) organização padrão (`x-ctx-org-id`) |
| `CBD_TLS_INSECURE` | `true` se o certificado for interno/self-signed |

## Configurar no Cursor

Adicione em `~/.cursor/mcp.json` (ou use `mcp.json.example` como base):

```json
{
  "mcpServers": {
    "cisco-business-dashboard": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/dist/index.js"],
      "env": {
        "CBD_BASE_URL": "https://cisco.capricornio.corp.br",
        "CBD_KEY_ID": "YOUR_ACCESS_KEY_ID",
        "CBD_KEY_SECRET": "YOUR_ACCESS_KEY_SECRET",
        "CBD_TLS_INSECURE": "true"
      }
    }
  }
}
```

Alternativa em desenvolvimento (sem build):

```json
{
  "mcpServers": {
    "cisco-business-dashboard": {
      "command": "npx",
      "args": ["tsx", "/ABSOLUTE/PATH/TO/src/index.ts"],
      "env": {
        "CBD_BASE_URL": "https://cisco.capricornio.corp.br",
        "CBD_KEY_ID": "YOUR_ACCESS_KEY_ID",
        "CBD_KEY_SECRET": "YOUR_ACCESS_KEY_SECRET",
        "CBD_TLS_INSECURE": "true"
      }
    }
  }
}
```

Reinicie o Cursor / recarregue os MCP servers depois de salvar.

## Tools disponíveis

| Tool | Uso |
| --- | --- |
| `test_connection` | Valida autenticação JWT + lista orgs |
| `list_organizations` | Organizações (`/api/v2/orgs`) |
| `list_networks` | Sites/redes (`/api/v2/networks`) |
| `list_devices` | Infraestrutura: Router / Switch / WAP |
| `list_hosts` | Endpoints (hosts, phones, cameras) |
| `get_node` | Detalhe de um device/host por ID |
| `inventory_summary` | Resumo no estilo do widget Inventory |
| `list_events` | Histórico de eventos/alertas |
| `list_groups` | Device groups |
| `cbd_api_get` | GET genérico em qualquer path `/api/v2/...` |

Autenticação: o servidor gera um JWT HS256 com `kid` = Key ID e assina com o Secret, conforme a [documentação oficial](https://developer.cisco.com/docs/business-dashboard/how-to-authenticate/).

## Testes locais

```bash
npm run typecheck
npm run smoke
```

`smoke` valida a geração/assinatura do JWT **sem** falar com o Dashboard.

Para testar ao vivo (na rede que alcança `cisco.capricornio.corp.br`):

```bash
export CBD_BASE_URL=https://cisco.capricornio.corp.br
export CBD_KEY_ID=...
export CBD_KEY_SECRET=...
export CBD_TLS_INSECURE=true
npm run dev
```

Documentação interativa da sua instância: `https://cisco.capricornio.corp.br/api/`

## Exemplos de prompts no Cursor

- “Lista as organizações e redes do Cisco Business Dashboard”
- “Monta um resumo de inventário (AP, switch, router, hosts)”
- “Procura o switch SCL-CPD-SW01 e mostra status/IP/serial”
- “Quais alertas/eventos recentes temos?”

## Segurança

- Não commite `.env` nem keys no git
- Prefira key de usuário read-only / least privilege
- `CBD_TLS_INSECURE=true` desativa verificação de certificado — use só em redes internas confiáveis
