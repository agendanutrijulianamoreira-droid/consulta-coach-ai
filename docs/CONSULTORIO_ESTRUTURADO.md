# Consultório Estruturado — Sprint 90

## Escopo

O módulo organiza seis blocos de 15 minutos: diagnóstico, ofertas, jornada, CRM,
financeiro e ativação. O wizard salva respostas, pendências “Não sei”, checklist e
etapa atual em `sprint_progress`.

## Regras de negócio

- Contrato, recebimento e reconhecimento são lançamentos distintos.
- Uma consulta só entra como paga quando existe um lançamento `recebimento` com
  `status = ok` vinculado ao lead; estar em `confirmada` não representa pagamento.
- Mudanças de estágio geram eventos em `crm_lead_events`.
- Aprovação e rejeição de uma proposta geram eventos append-only em
  `ai_proposal_events`.
- Ofertas, leads e templates são editáveis; duplicidade de telefone/e-mail é
  bloqueada por proprietário.
- As relações entre ofertas, leads, lançamentos e auditoria usam chaves compostas
  com `owner_id`, impedindo referências cruzadas entre contas.

## KPIs

O painel separa contratado, recebido e reconhecido, calcula ticket, agendamento,
comparecimento, conversão de protocolo, renovações, inadimplência e margem. O
denominador zero é exibido como `N/D`. A simulação de mix permanece disponível no
domínio puro (`simulateMix`) para metas mensais, incluindo a meta padrão de R$ 30.000.

## Operação e segurança

Aplicar as migrações em ordem (`0000`, `0001`, `0002`) antes de habilitar o módulo.
As políticas RLS restringem cada tabela ao `auth.uid()`; eventos de lead e IA são
somente leitura/inserção e os FKs de auditoria usam `RESTRICT` para preservar o
histórico.
