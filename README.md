# Nutri Flow AI

Você é um arquiteto de software sênior especialista em sistemas médicos, IA generativa, transcrição de voz em tempo real e aplicações SaaS.

Desenvolva um sistema chamado NutriOS, uma plataforma completa para nutricionistas especializada em automatizar toda a consulta clínica.

O objetivo principal é reduzir em mais de 80% o tempo gasto na documentação clínica e na montagem do plano alimentar.

O sistema deve ser moderno, extremamente rápido, minimalista e premium.

Utilize:

• Next.js 15

• React

• TypeScript

• Tailwind

• Shadcn UI

• Supabase

• PostgreSQL

• Prisma

• OpenAI

• Whisper ou Google Speech-to-Text para transcrição

• GPT-5 para organização clínica

• Background Jobs

• WebSocket para transcrição em tempo real

------------------------------------------------

FLUXO DA CONSULTA

Ao iniciar uma consulta, o nutricionista clica em:

"Iniciar Consulta"

Automaticamente:

• inicia gravação

• inicia transcrição ao vivo

• salva tudo continuamente

• exibe um cronômetro

No topo da tela mostrar:

Tempo restante

Consulta: 00:00

Quando faltar:

10 minutos

mostrar amarelo.

Quando faltar

5 minutos

mostrar vermelho.

Quando completar

15 minutos

emitir:

• aviso sonoro discreto

• toast

• vibração (mobile)

"Consulta atingiu 15 minutos."

A gravação continua.

Nunca interromper.

------------------------------------------------

TRANSCRIÇÃO

Durante toda consulta:

converter voz em texto continuamente.

Separar automaticamente:

Nutricionista:

Paciente:

Mostrar em tempo real.

Toda transcrição deve ficar salva.

Se a internet cair:

armazenar localmente.

Sincronizar depois.

------------------------------------------------

EXTRAÇÃO DE DADOS

Enquanto transcreve, uma IA deve identificar automaticamente:

Nome

Idade

Profissão

Queixa principal

História da doença

Sintomas

Uso de medicamentos

Suplementos

Exames

Doenças

Alergias

Intolerâncias

Rotina

Sono

Estresse

Exercício

Água

Evacuação

Objetivos

Motivação

Preferências

Restrições alimentares

Tudo deve preencher automaticamente os campos da anamnese.

O nutricionista apenas revisa.

------------------------------------------------

ESTRUTURA DA CONSULTA

A consulta possui etapas.

Etapa 1

Anamnese

Ao concluir:

IA gera automaticamente um resumo clínico estruturado.

------------------------------------------------

Etapa 2

Antropometria

Campos:

peso

altura

IMC

circunferências

dobras

bioimpedância

gordura corporal

massa muscular

água corporal

A IA interpreta automaticamente evolução e risco.

------------------------------------------------

Etapa 3

Recordatório Alimentar

Registrar:

horário

alimentos

quantidade

modo de preparo

observações

A IA identifica automaticamente:

excesso de açúcar

baixa proteína

baixo consumo de fibras

baixa ingestão hídrica

ultraprocessados

deficiência de vegetais

padrões alimentares

------------------------------------------------

Etapa 4

Diagnóstico Nutricional

A IA sugere hipóteses.

Nunca definir diagnóstico.

Sempre apresentar:

Sugestões para revisão profissional.

------------------------------------------------

Etapa 5

Conduta

O nutricionista informa apenas:

fase do tratamento

meta calórica

proteína

carboidrato

gordura

número de refeições

preferências

restrições

objetivos

A IA monta automaticamente:

plano alimentar

------------------------------------------------

GERADOR DE PLANO ALIMENTAR

O sistema possui um banco de dados interno contendo:

alimentos

substituições

receitas

medidas caseiras

índice glicêmico

macronutrientes

micronutrientes

grupos alimentares

custos

tempo de preparo

compatibilidade com protocolos

Ao informar:

fase do tratamento

kcal

objetivo

restrições

preferências

a IA deve buscar os alimentos da base.

Nunca inventar alimentos.

Sempre utilizar apenas alimentos cadastrados.

Gerar:

café da manhã

lanche

almoço

lanche

jantar

ceia

Cada refeição deve conter:

porção

gramas

medidas caseiras

macros

calorias

substituições

------------------------------------------------

RECEITAS

Gerar receitas automaticamente.

Cada receita deve conter:

ingredientes

modo de preparo

tempo

rendimento

valor nutricional

------------------------------------------------

LISTA DE COMPRAS

Gerar automaticamente.

Agrupar por categorias:

hortifruti

carnes

laticínios

mercearia

temperos

congelados

bebidas

------------------------------------------------

PRONTUÁRIO

Ao finalizar consulta gerar automaticamente:

Resumo Clínico

Anamnese

Antropometria

Recordatório

Hipóteses nutricionais

Objetivos

Conduta

Plano alimentar

Lista de compras

Receitas

Orientações

Pendências

Solicitação de exames

Suplementação

Tudo deve ficar editável.

------------------------------------------------

INTELIGÊNCIA ARTIFICIAL

A IA nunca pode substituir o profissional.

Sempre trabalhar como copiloto.

Todas sugestões precisam poder ser:

editar

aceitar

recusar

------------------------------------------------

INTERFACE

Visual semelhante ao Notion + Linear.

Layout extremamente limpo.

Sem excesso de cores.

Responsivo.

Escuro e claro.

Componentes pequenos.

Atalhos de teclado.

Autosave.

------------------------------------------------

ARQUITETURA

Separar em módulos independentes:

Consulta

Transcrição

IA

Prontuário

Plano Alimentar

Receitas

Lista de Compras

Banco de Alimentos

Protocolos

Pacientes

Relatórios

Cada módulo deve ser desacoplado seguindo SOLID, Clean Architecture e Domain Driven Design.

Não utilizar lógica duplicada.

Criar código altamente reutilizável.

Todo código deve ser documentado e preparado para expansão futura.
não peça para a IA gerar o plano alimentar diretamente.

Em vez disso, faça o fluxo ser:

 A IA extrai os dados clínicos da consulta.

 Ela determina as restrições e critérios (fase, objetivo, kcal, preferências, intolerâncias, tempo disponível, orçamento etc.).

 Um motor de regras busca combinações em uma base de alimentos e receitas previamente cadastrada por você.

 A IA apenas organiza, adapta a linguagem e justifica as escolhas.

Isso traz três vantagens importantes:

 padroniza seus protocolos clínicos;

 reduz "alucinações" da IA ao inventar alimentos ou quantidades;

 permite que o plano reflita exatamente o seu método de atendimento, tornando-o um diferencial difícil de copiar.


não peça para a IA gerar o plano alimentar diretamente.

Em vez disso, faça o fluxo ser:

 A IA extrai os dados clínicos da consulta.

 Ela determina as restrições e critérios (fase, objetivo, kcal, preferências, intolerâncias, tempo disponível, orçamento etc.).

 Um motor de regras busca combinações em uma base de alimentos e receitas previamente cadastrada por você.

 A IA apenas organiza, adapta a linguagem e justifica as escolhas.

Isso traz três vantagens importantes:

 padroniza seus protocolos clínicos;

 reduz "alucinações" da IA ao inventar alimentos ou quantidades;

 permite que o plano reflita exatamente o seu método de atendimento, tornando-o um diferencial difícil de copiar.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c6947c80-24fe-46a2-943a-3d084c589e70).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
