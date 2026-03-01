# Guardian Pro — Guia de Configuração de Pagamento

Este guia explica passo a passo como configurar o sistema de pagamento do Guardian Pro,
como os utilizadores pagam, e como você recebe o dinheiro.

---

## Opção Recomendada: ExtensionPay (usa Stripe por baixo)

ExtensionPay é a forma mais simples de monetizar extensões Chrome. Não precisa de backend,
servidor, ou base de dados. Tudo é gerido pela plataforma.

### Passo 1: Criar conta no ExtensionPay

1. Acesse **https://extensionpay.com**
2. Clique em **"Sign up"** e crie uma conta
3. Conecte a sua conta Stripe (siga o wizard — leva ~5 minutos)
   - Se não tem conta Stripe, será criada automaticamente
   - O Stripe é onde o dinheiro entra na sua conta bancária

### Passo 2: Registrar a extensão

1. No dashboard do ExtensionPay, clique em **"New Extension"**
2. Preencha:
   - **Extension ID**: `guardian-pro` (ou outro nome único)
   - **Pricing**: Subscription
   - **Price**: €2.99/month (ou USD $2.99 — o Stripe converte automaticamente)
   - **Free trial**: 7 days (recomendado — permite dar acesso Pro a utilizadores de teste sem cobrança; ver secção "Utilizadores de teste" abaixo)
3. Clique em **"Create"**
4. Copie o **Extension ID** que foi gerado

### Passo 3: Baixar ExtPay.js

1. No dashboard do ExtensionPay, baixe o ficheiro **ExtPay.js**
   - Ou instale via npm: `npm install extpay` e copie o ficheiro
2. Coloque o ficheiro em `shared/ExtPay.js` dentro do projeto Guardian

### Passo 4: Configurar no código

1. Abra `shared/license.js`
2. Altere a constante `EXTPAY_ID`:

```javascript
const EXTPAY_ID = "guardian-pro"; // o ID que criou no passo 2
```

3. Adicione o import do ExtPay no topo de `shared/license.js`:

```javascript
import ExtPay from "./ExtPay.js";
```

4. No `manifest.json`, se necessário, adicione ao `web_accessible_resources`:

```json
"web_accessible_resources": [{
  "resources": ["shared/ExtPay.js"],
  "matches": ["<all_urls>"]
}]
```

### Passo 5: Testar

1. Use o modo sandbox do Stripe (ativado por padrão no ExtensionPay)
2. Carregue a extensão no Chrome (`chrome://extensions` → Load unpacked)
3. Clique em "Subscribe to Pro" e teste com o cartão de teste do Stripe:
   - Número: `4242 4242 4242 4242`
   - Data: qualquer data futura
   - CVC: qualquer 3 dígitos
4. Verifique que as features Pro ficam desbloqueadas

### Passo 6: Publicar

1. No dashboard do ExtensionPay, mude para **modo produção**
2. Publique a extensão na Chrome Web Store
3. Os pagamentos reais começam a entrar na sua conta Stripe

---

## Como o utilizador paga (fluxo do utilizador)

1. Utilizador instala o Guardian (gratuito) na Chrome Web Store
2. No popup ou nas settings, vê o banner "Upgrade to Pro — €2.99/month"
3. Clica em "Upgrade" → abre uma página de checkout segura (Stripe)
4. Preenche o email e dados do cartão
5. Paga €2.99 → recebe confirmação por email
6. A extensão detecta automaticamente que o pagamento foi feito
7. Features Pro ficam imediatamente disponíveis

---

## Como você recebe o dinheiro

### Com ExtensionPay + Stripe:

1. O utilizador paga €2.99/mês
2. O Stripe processa o pagamento
3. O dinheiro vai para a sua conta Stripe (menos taxas)
4. Do Stripe, você transfere para a sua conta bancária

### Taxas:

| Componente | Taxa |
|---|---|
| Stripe | ~2.9% + €0.25 por transação |
| ExtensionPay | ~5% por transação |
| **Você recebe** | **~€2.50 por €2.99 cobrado** |

### Frequência de pagamento:

- Stripe paga automaticamente na sua conta bancária
- Frequência: diária ou semanal (configurável no dashboard Stripe)
- Primeira transferência pode levar 7-14 dias (verificação)

---

## Utilizadores de teste

O Guardian Pro só considera um utilizador "Pro" quando o pagamento é feito via ExtensionPay (Stripe). Não existe ativação por chave de licença na interface.

Para dar acesso Pro a testadores sem cobrança:

1. **Ative o trial de 7 dias** no ExtensionPay (Passo 2 acima: "Free trial: 7 days").
2. Os testadores clicam em "Upgrade to Pro" / "Subscribe to Pro" e completam o checkout com um **cartão de teste** do Stripe (em modo sandbox).
3. Durante os 7 dias de trial não são cobrados; têm acesso completo às funcionalidades Pro.
4. Após o trial, podem cancelar ou passar a pagar.

Cartão de teste Stripe (sandbox): `4242 4242 4242 4242`, data futura, CVC qualquer.

---

## Alternativa: Lemon Squeezy

Se preferir uma plataforma europeia com faturação automática:

1. Crie conta em **https://lemonsqueezy.com**
2. Crie um produto "Guardian Pro" com preço €2.99/mês
3. Configure webhooks para gerar chaves automaticamente
4. O utilizador compra → recebe chave → insere na extensão

---

## Moedas e preços regionais

O preço de €2.99/mês é o base. Em outras moedas (aproximações):

| Moeda | Preço |
|---|---|
| EUR | €2.99 |
| USD | $3.29 |
| GBP | £2.59 |
| BRL | R$16.99 |
| AUD | A$4.99 |

O Stripe converte automaticamente se configurar multi-currency.
No ExtensionPay, defina o preço em USD ou EUR e o Stripe faz a conversão.

---

## Resumo rápido

| Passo | Ação |
|---|---|
| 1 | Criar conta ExtensionPay + conectar Stripe |
| 2 | Registrar extensão com preço €2.99/mês |
| 3 | Baixar ExtPay.js e colocar no projeto |
| 4 | Alterar `EXTPAY_ID` em `shared/license.js` |
| 5 | Testar com cartão sandbox |
| 6 | Publicar na Chrome Web Store |
| 7 | Receber dinheiro via Stripe → conta bancária |
