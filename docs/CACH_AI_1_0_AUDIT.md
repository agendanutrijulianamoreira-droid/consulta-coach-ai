# Cach AI — auditoria de prontidão para 1.0

Data: 2026-09-01

## Estágio real

O Cach AI está em **MVP clínico funcional avançado / pré-1.0**.

Já existe um fluxo de ponta a ponta utilizável em ambiente controlado:

- cadastro e histórico de pacientes;
- criação de consultas;
- autenticação do profissional;
- RLS por proprietário dos dados clínicos;
- gravação de áudio e transcrição em janelas;
- separação de falas por IA;
- extração estruturada da anamnese;
- antropometria e cálculos energéticos;
- recordatório alimentar;
- sinalizações e hipóteses para revisão profissional;
- motor determinístico de cardápio baseado apenas na base cadastrada;
- lista de compras;
- geração de resumo, parecer e prontuário;
- CRUD de alimentos;
- CRUD de receitas (adicionado neste hardening).

Isso é suficiente para demonstração e testes internos, mas ainda não atende ao nível de confiabilidade esperado para consulta real sem supervisão técnica.

## Bloqueadores para Cach AI 1.0

### P0 — segurança e integridade clínica

1. **Validar a migration de RLS no Supabase real.**
   A proteção por `professional_id` foi implementada, mas a migration precisa ser comprovada no banco conectado, inclusive INSERT/SELECT/UPDATE/DELETE de todas as tabelas clínicas e isolamento entre dois usuários de teste.

2. **Fechar o cadastro público após o bootstrap da conta profissional.**
   O login está protegido, porém a rota de primeiro acesso continua permitindo signup. Para consultório individual, o 1.0 deve operar com criação de novas contas desabilitada ou com convite explícito.

3. **Impedir perda de áudio/transcrição quando a rede ou a IA falhar.**
   Atualmente cada janela de áudio é enviada e, se a chamada falhar, o erro é mostrado, mas o WAV não fica numa fila durável para retransmissão. O requisito original de armazenamento local + sincronização posterior ainda não está cumprido.

4. **Garantir persistência do último trecho ao encerrar a gravação.**
   O `stop()` dispara o flush final, mas o callback de transcrição não é aguardado pelo gravador. O fechamento da consulta pode ocorrer antes da confirmação do último trecho.

### P1 — consistência funcional do fluxo clínico

5. **Autosave real das etapas editáveis.**
   Anamnese, antropometria e cálculos ainda dependem parcialmente de ações explícitas de salvar. O 1.0 deve persistir alterações com debounce e indicador de estado (`salvando`, `salvo`, `erro/offline`).

6. **Fazer o motor de cardápio respeitar metas de macronutrientes.**
   A conduta recebe proteína, carboidrato e gordura, mas o motor atual usa essencialmente calorias, número de refeições, preferências e restrições. As metas de macros ainda não participam da seleção/otimização das porções.

7. **Integrar receitas ao motor de cardápio.**
   O domínio `MealPlan` prevê receitas e a biblioteca agora é editável, porém `buildMealPlan()` retorna `recipes: []`. O 1.0 precisa selecionar receitas cadastradas de forma determinística e compatível com refeição/restrições.

8. **Validar consistência de restrições e tags da base alimentar.**
   A regra é conservadora: quando uma restrição é marcada, o alimento só entra se possuir a tag correspondente. A base precisa ter cobertura suficiente de tags para não gerar refeições incompletas.

9. **Bloquear finalização incompleta ou mostrar checklist clínico explícito.**
   Hoje é possível chegar à etapa final com dados ausentes. O sistema deve diferenciar campo opcional de pré-requisito clínico e pedir revisão antes de marcar a consulta como finalizada.

### P1 — qualidade e operação

10. **CI obrigatório antes de merge.**
    Este hardening adiciona lint, typecheck e build no GitHub Actions. Depois de estabilizado, o branch protection do `main` deve exigir o workflow verde.

11. **Testes automatizados do domínio.**
    Prioridade para antropometria, energia, motor de cardápio, escalonamento de porções, restrições e lista de compras. São funções puras e devem ser cobertas antes de mudanças de regra clínica.

12. **Teste E2E do caminho crítico.**
    Fluxo mínimo: login → paciente → consulta → gravação → anamnese → antropometria → cálculo → recordatório → hipótese → cardápio → parecer → reabertura do prontuário.

13. **Observabilidade de produção.**
    Registrar erros de transcrição/IA/banco com correlation id por consulta, sem colocar dados clínicos sensíveis em logs externos.

### P2 — produto e acabamento

14. **Concluir a identidade Cach AI.**
    Há textos, títulos e comentários ainda usando `NutriOS`. A troca deve ser cosmética e centralizada, sem renomear módulos internos só por estética.

15. **Atalhos de teclado e estados de conectividade.**
    Foram pedidos no escopo original, mas ainda não formam uma experiência completa.

16. **Importação/curadoria da base alimentar.**
    O CRUD existe; ainda falta pipeline controlado para TBCA/Tucunduva/fabricantes, origem do dado, versão e rastreabilidade nutricional.

## O que não deve ser reconstruído

- TanStack Start + React + TypeScript + Supabase/Lovable Cloud;
- estrutura modular de domínio já existente;
- `repository.ts` como camada de acesso aos dados;
- domínio puro de antropometria, energia e cardápio;
- autenticação/RLS já implementadas — devem ser testadas e endurecidas, não substituídas;
- motor determinístico baseado na base cadastrada;
- fluxo em etapas da consulta;
- componentes atuais de parecer/prontuário, salvo correções incrementais.

## Ordem recomendada de execução

1. comprovar RLS/auth no ambiente real;
2. fila durável de áudio + confirmação do flush final;
3. autosave com estado e retry;
4. testes do domínio + CI obrigatório;
5. metas de macros no motor;
6. integração de receitas ao motor;
7. checklist de finalização;
8. E2E do fluxo crítico;
9. observabilidade;
10. acabamento de marca e UX.

## Alterações iniciadas neste branch

- CRUD completo da biblioteca de receitas;
- workflow de CI com lint, typecheck e build;
- documentação explícita do gap para 1.0.

As próximas alterações devem continuar incrementais e protegidas por testes, especialmente no arquivo da consulta, que hoje concentra grande parte da orquestração clínica.
