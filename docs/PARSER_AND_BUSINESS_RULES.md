---

### `PARSER_AND_BUSINESS_RULES.md`

```markdown
# Regras de Negócio e Especificação do Parser de Texto

## 1. Separação Patrimonial e Regra de Transferência (PF vs. PJ)

### Princípio da Não-Confusão Patrimonial
- Recursos da Pessoa Jurídica não devem liquidar despesas classificadas como Pessoais sem a devida escrituração de transferência.
- Quando dinheiro sai da conta PJ para a PF, a transação deve ser classificada como `TRANSFER`:
  - **Conta de Origem:** Conta Bancária PJ.
  - **Conta de Destino:** Conta Bancária PF.
  - **Classificação PJ:** Saída como "Distribuição de Lucros" ou "Pró-labore".
  - **Classificação PF:** Entrada como "Rendimento de Pró-labore/Lucro".
  - O sistema abate o saldo da conta PJ e adiciona no saldo da conta PF simultaneamente em uma transação atômica (`database transaction`).

---

## 2. Motor de Dívidas e Parcelamentos

1. **Geração Automática de Grade:** Ao cadastrar uma dívida de $N$ parcelas com data de início $D$, o sistema insere $N$ registros em `debt_installments` incrementando mensalmente a data de vencimento.
2. **Liquidação Vinculada:** Ao pagar uma parcela da dívida via extrato ou quick input:
   - Uma despesa (`EXPENSE`) é criada em `transactions` vinculada ao `debt_installment_id`.
   - A parcela em `debt_installments` muda o status para `PAID` e preenche `paid_date`.
   - Se todas as parcelas forem pagas, `debts.status` é atualizado para `PAID_OFF`.

---

## 3. Planejado vs. Realizado (Budgets)

- O cálculo de consumo do orçamento é derivado sob demanda via aggregation:
  $$\text{Consumido} = \sum \text{transactions.amount} \quad \text{onde} \begin{cases} \text{category\_id} = \text{budget.category\_id} \\ \text{status} = \text{'PAID'} \\ \text{type} = \text{'EXPENSE'} \\ \text{transaction\_date} \in \text{month\_year} \end{cases}$$
- **Estados Visuais da Barra de Progresso:**
  - `Verde`: Consumo $\le 75\%$ da meta.
  - `Amarelo`: Consumo entre $76\%$ e $99\%$ da meta.
  - `Vermelho`: Consumo $\ge 100\%$ (Estouro de orçamento).

---

## 4. Especificação do Algoritmo Quick Input (Zero Tokens)

O componente processa frases de linguagem natural no navegador sem chamadas de API de LLM.

### Pipeline de Execução Linear

```text
Entrada Bruta: "gastei 50 reais com gasolina - cartao nubank"
                      │
                      ▼
[Passo 1: Normalização]
  - Lowercase, remove diacríticos (acentos).
  - Texto limpo: "gastei 50 reais com gasolina - cartao nubank"
                      │
                      ▼
[Passo 2: Extração Temporal]
  - Regex para "ontem", "anteontem", "hoje".
  - Extrai: Data calculada | Remove termos do buffer.
                      │
                      ▼
[Passo 3: Detecção de Natureza]
  - Match contra lista de receitas: ["recebi", "ganhei", "vendi", "salario", "entrada"].
  - Match contra lista de despesas: ["gastei", "paguei", "comprei", "saida"].
  - Extrai: 'INCOME' ou 'EXPENSE'.
                      │
                      ▼
[Passo 4: Extração Numérica (BRL)]
  - Regex: /(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)(?:\s*reais)?/i
  - Converte "50" ou "50,00" para float 50.00.
                      │
                      ▼
[Passo 5: Resolução de Entidades (Fuzzy Match / Substring)]
  - Compara texto restante contra `accounts.name` do banco (ex: "nubank").
  - Compara texto restante contra `categories.name` do banco (ex: "gasolina" -> categoria "Combustível").
                      │
                      ▼
[Passo 6: Limpeza Residual da Descrição]
  - Remove preposições comuns: ["com", "no", "na", "de", "do", "da", "em", "cartao"].
  - Resultado: "Gasolina".
                      │
                      ▼
[Saída Estruturada para o Card de Confirmação]
{
  type: 'EXPENSE',
  amount: 50.00,
  description: 'Gasolina',
  accountId: 'uuid-conta-nubank',
  categoryId: 'uuid-cat-combustivel',
  date: '2026-09-08'
}